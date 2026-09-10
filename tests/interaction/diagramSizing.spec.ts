import path from "node:path";
import { expect, test } from "@playwright/test";
import { hydrate, insertAt, setSurface } from "./rendererHarness";

for (const theme of ["light", "dark"] as const) {
  for (const surface of ["rich", "preview"] as const) {
    test(`${theme} ${surface} diagrams fit their reading column without growing small diagrams`, async ({
      page
    }) => {
      await page.goto("/");
      await hydrate(
        page,
        "# Diagram sizing\n\n```mermaid\ngraph LR\n" +
          Array.from(
            { length: 12 },
            (_, i) => `A${i}[Step ${i}] --> A${i + 1}`
          ).join("\n") +
          "\n```\n\n```mermaid\ngraph TD\nA[Small]\n```\n\n```mermaid\ngraph TD\nA --> B --> C --> D\n```\n\nFollowing diagrams stays editable.\n"
      );
      await setSurface(page, surface);
      await setSurface(page, theme);
      await page.evaluate(
        async (url) => {
          const { usePlumaStore } = await import(/* @vite-ignore */ url);
          const state = usePlumaStore.getState();
          state.setCommandHandlers({ updatePaneSizes: () => {} });
          usePlumaStore.setState({
            workspace: { ...state.workspace, hasWorkspace: true },
            layout: {
              ...state.layout,
              isSidebarVisible: true,
              paneSizes: [300, innerWidth - 300]
            }
          });
        },
        `/@fs/${path.resolve("packages/ui/src/index.ts")}`
      );
      const diagrams = page.locator(".cm-draftly-mermaid-rendered svg");
      await expect(diagrams).toHaveCount(3);
      for (const width of [1440, 960, 1200]) {
        await page.setViewportSize({ width, height: 1000 });
        await page
          .getByRole("button", {
            name: width === 960 ? "Show sidebar" : "Hide sidebar",
            exact: true
          })
          .click();
        await expect(page.locator(".pane-layout")).not.toHaveAttribute(
          "data-primary-animating",
          "true"
        );
        if (width === 960) {
          const pane = await page.locator(".primary").boundingBox();
          expect(pane).not.toBeNull();
          await page.mouse.move(
            pane!.x + pane!.width,
            pane!.y + pane!.height / 2
          );
          await page.mouse.down();
          await page.mouse.move(
            pane!.x + pane!.width + 60,
            pane!.y + pane!.height / 2,
            { steps: 8 }
          );
          await page.mouse.up();
          await expect
            .poll(
              async () => (await page.locator(".primary").boundingBox())!.width
            )
            .toBeGreaterThan(pane!.width + 20);
        }
        for (const diagram of await diagrams.all()) {
          await expect(async () => {
            const geometry = await diagram.evaluate((element) => {
              const svg = element as SVGSVGElement;
              const wrapper = svg.parentElement!;
              const pane = svg.closest(".rich-pane, .preview-pane")!;
              const bounds = svg.getBoundingClientRect();
              const wrapperBounds = wrapper.getBoundingClientRect();
              const paneBounds = pane.getBoundingClientRect();
              return {
                width: bounds.width,
                height: bounds.height,
                naturalWidth: svg.viewBox.baseVal.width,
                naturalHeight: svg.viewBox.baseVal.height,
                wrapperWidth: wrapperBounds.width,
                left: bounds.left,
                right: bounds.right,
                paneLeft: paneBounds.left,
                paneRight: paneBounds.right,
                overflow: wrapper.scrollWidth - wrapper.clientWidth,
                verticalOverflow: wrapper.scrollHeight - wrapper.clientHeight
              };
            });
            expect(geometry.width).toBeGreaterThan(0);
            expect(geometry.width).toBeLessThanOrEqual(
              geometry.wrapperWidth + 1
            );
            expect(geometry.width).toBeLessThanOrEqual(
              geometry.naturalWidth + 1
            );
            expect(geometry.left).toBeGreaterThanOrEqual(geometry.paneLeft);
            expect(geometry.right).toBeLessThanOrEqual(geometry.paneRight + 1);
            expect(geometry.overflow).toBeLessThanOrEqual(1);
            expect(geometry.verticalOverflow).toBeLessThanOrEqual(1);
            expect(
              Math.abs(
                geometry.width -
                  Math.min(geometry.naturalWidth, geometry.wrapperWidth)
              )
            ).toBeLessThanOrEqual(1);
            expect(
              Math.abs(
                geometry.height -
                  (geometry.width * geometry.naturalHeight) /
                    geometry.naturalWidth
              )
            ).toBeLessThanOrEqual(1);
          }).toPass({ timeout: 5000 });
        }
      }
      if (surface === "rich") {
        await insertAt(
          page,
          page.locator(".cm-line").filter({ hasText: /^Following diagrams/ }),
          10,
          "MARKER "
        );
      }
    });
  }
}
