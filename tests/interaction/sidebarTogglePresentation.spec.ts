import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { hydrate } from "./rendererHarness";

const uiUrl = `/@fs/${path.resolve("packages/ui/src/index.ts")}`;

async function ready(page: Page) {
  await page.goto("/");
  await hydrate(page, "# Sidebar toggle\n\nA short document.");
  await page.evaluate(async (url) => {
    const { usePlumaStore } = await import(/* @vite-ignore */ url);
    const state = usePlumaStore.getState();
    state.setCommandHandlers({ updatePaneSizes: () => {} });
    usePlumaStore.setState({
      workspace: {
        ...state.workspace,
        hasWorkspace: true,
        workspacePath: "/tmp/sidebar-toggle-presentation",
        workspaceLabel: "Sidebar toggle"
      },
      layout: {
        ...state.layout,
        isSidebarVisible: true,
        paneSizes: [260, innerWidth - 260]
      }
    });
  }, uiUrl);
  await expect(
    page.getByRole("button", { name: "Hide sidebar", exact: true })
  ).toBeVisible();
  await expect(page.locator(".pane-layout")).not.toHaveAttribute(
    "data-primary-animating",
    "true"
  );
}

async function toggleFrames(page: Page, opening: boolean) {
  return page.evaluate(async (opening) => {
    const layout = document.querySelector(".pane-layout")!;
    const button =
      document.querySelector<HTMLButtonElement>(".sidebar-toggle")!;
    const sample = () => {
      const rect = button.getBoundingClientRect();
      const style = getComputedStyle(button);
      const hit = document.elementFromPoint(
        rect.x + rect.width / 2,
        rect.y + rect.height / 2
      );
      return {
        x: rect.x,
        y: rect.y,
        layoutX: layout.getBoundingClientRect().x,
        sidebarWidth: document
          .querySelector(".primary")!
          .getBoundingClientRect().width,
        opacity: Number(style.opacity),
        visible: style.visibility === "visible" && style.display !== "none",
        clickable:
          !button.disabled &&
          style.pointerEvents !== "none" &&
          !!hit &&
          button.contains(hit),
        sameButton: document.querySelector(".sidebar-toggle") === button,
        focused: document.activeElement === button,
        label: button.getAttribute("aria-label")
      };
    };
    const frames = [sample()];
    button.click();
    let settledFrames = 0;
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      if (layout.getAttribute("data-primary-visible") !== String(opening))
        continue;
      frames.push(sample());
      if (layout.getAttribute("data-primary-animating") !== "true") {
        if (++settledFrames === 4) break;
      } else {
        settledFrames = 0;
      }
    }
    return { frames, settledFrames };
  }, opening);
}

for (const resized of [false, true]) {
  test(`sidebar toggle travels continuously and stays available at ${resized ? "resized" : "default"} width`, async ({
    page
  }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await ready(page);
    if (resized) {
      const pane = (await page.locator(".primary").boundingBox())!;
      await page.mouse.move(pane.x + pane.width, pane.y + pane.height / 2);
      await page.mouse.down();
      await page.mouse.move(
        pane.x + pane.width + 80,
        pane.y + pane.height / 2,
        { steps: 8 }
      );
      await page.mouse.up();
      await expect
        .poll(() =>
          page
            .locator(".primary")
            .evaluate((element) => element.getBoundingClientRect().width)
        )
        .toBeGreaterThan(pane.width + 40);
    }
    const toggle = page.locator(".sidebar-toggle");
    await expect(toggle).toHaveCount(1);
    await toggle.focus();
    const original = await toggle.elementHandle();
    let expandedWidth = 0;
    for (const opening of [false, true]) {
      const { frames, settledFrames } = await toggleFrames(page, opening);
      expect(settledFrames).toBe(4);
      const first = frames[0];
      const last = frames[frames.length - 1];
      if (!opening) expandedWidth = first.sidebarWidth;
      expect(last.sidebarWidth).toBeCloseTo(opening ? expandedWidth : 0, 0);
      const restX = first.layoutX + 84;
      const moving = frames.filter(
        (frame) => frame.x > restX + 1 && frame.sidebarWidth < expandedWidth - 1
      );
      const pinned = frames.filter(
        (frame) =>
          Math.abs(frame.x - restX) < 0.5 &&
          frame.sidebarWidth > 1 &&
          frame.sidebarWidth < 110
      );
      expect(moving.length).toBeGreaterThan(0);
      expect(pinned.length).toBeGreaterThan(0);
      for (const [index, frame] of frames.entries()) {
        expect(frame.sameButton).toBe(true);
        expect(frame.focused).toBe(true);
        expect(frame.visible).toBe(true);
        expect(frame.clickable).toBe(true);
        expect(frame.opacity).toBe(1);
        expect(frame.x).toBeGreaterThanOrEqual(restX - 0.5);
        expect(frame.x).toBeCloseTo(
          frame.layoutX + Math.max(84, frame.sidebarWidth - 30),
          0
        );
        expect(frame.y).toBeCloseTo(first.y, 3);
        if (index === 0) continue;
        expect(frame.label).toBe(opening ? "Hide sidebar" : "Show sidebar");
        const delta = frame.x - frames[index - 1].x;
        expect(opening ? delta : -delta).toBeGreaterThanOrEqual(-0.5);
      }
      expect(
        await original!.evaluate(
          (element) => element === document.querySelector(".sidebar-toggle")
        )
      ).toBe(true);
      await expect(toggle).toHaveCount(1);
      await expect(toggle).toBeFocused();
    }
  });
}
