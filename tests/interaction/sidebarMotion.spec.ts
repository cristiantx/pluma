import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { selectionSnapshot } from "./editorStateHarness";
import { documentSnapshot, hydrate, insertAt } from "./rendererHarness";

const uiUrl = `/@fs/${path.resolve("packages/ui/src/index.ts")}`;
const markdown = Array.from(
  { length: 100 },
  (_, index) => `Paragraph ${index}: Alpha beta gamma delta.`
).join("\n\n");

async function ready(page: Page, visible = true) {
  await page.goto("/");
  await hydrate(page, markdown);
  await page.evaluate(
    async ({ url, visible }) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ url);
      const state = usePlumaStore.getState();
      state.setCommandHandlers({ updatePaneSizes: () => {} });
      usePlumaStore.setState({
        workspace: {
          ...state.workspace,
          hasWorkspace: true,
          workspacePath: "/tmp/sidebar-motion",
          workspaceLabel: "Sidebar motion"
        },
        layout: {
          ...state.layout,
          isSidebarVisible: visible,
          paneSizes: [260, innerWidth - 260]
        }
      });
    },
    { url: uiUrl, visible }
  );
  await expect(
    page.getByRole("button", {
      name: visible ? "Hide sidebar" : "Show sidebar",
      exact: true
    })
  ).toBeVisible();
  await settled(page);
}

async function settled(page: Page) {
  await expect(page.locator(".pane-layout")).not.toHaveAttribute(
    "data-primary-animating",
    "true"
  );
}

async function width(page: Page) {
  return page
    .locator(".primary")
    .evaluate((element) => element.getBoundingClientRect().width);
}

async function toggle(page: Page, name: "Hide sidebar" | "Show sidebar") {
  await page.getByRole("button", { name, exact: true }).click();
  await settled(page);
}

test("sidebar slides at a stable content width and reverses continuously", async ({
  page
}) => {
  await ready(page);
  const expanded = await width(page);
  expect(expanded).toBeGreaterThanOrEqual(200);
  const samples = await page.evaluate(async () => {
    const primary = document.querySelector(".primary")!;
    const slide = document.querySelector(".primary-slide")!;
    const layout = document.querySelector(".pane-layout")!;
    const hide = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Hide sidebar"]'
    )!;
    const result: {
      width: number;
      contentWidth: number;
      offset: number;
      reversing: boolean;
    }[] = [];
    let reversing = false;
    hide.click();
    for (let frame = 0; frame < 120; frame++) {
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => resolve())
      );
      const rect = primary.getBoundingClientRect();
      const content = slide.getBoundingClientRect();
      result.push({
        width: rect.width,
        contentWidth: content.width,
        offset: content.x - rect.x,
        reversing
      });
      if (!reversing && rect.width > 20 && rect.width < content.width - 20) {
        document
          .querySelector<HTMLButtonElement>(
            'button[aria-label="Show sidebar"]'
          )!
          .click();
        reversing = true;
      }
      if (reversing && layout.getAttribute("data-primary-animating") !== "true")
        break;
    }
    return result;
  });
  expect(
    samples.some((sample) => sample.width > 20 && sample.width < expanded - 20)
  ).toBe(true);
  expect(samples.some((sample) => sample.offset < -5)).toBe(true);
  for (const sample of samples)
    expect(sample.contentWidth).toBeCloseTo(expanded, 0);
  const reversal = samples.findIndex((sample) => sample.reversing);
  expect(reversal).toBeGreaterThan(0);
  expect(
    Math.abs(samples[reversal].width - samples[reversal - 1].width)
  ).toBeLessThan(expanded / 2);
  await settled(page);
  expect(await width(page)).toBeCloseTo(expanded, 0);
});

test("collapse preserves editor identity, selection, scrolling and undo history", async ({
  page
}) => {
  await ready(page);
  const editor = await page.locator(".rich-editor .cm-editor").elementHandle();
  await insertAt(
    page,
    page.locator(".cm-line").filter({ hasText: /^Paragraph 0:/ }),
    13,
    "MARKER "
  );
  await page.keyboard.press("Shift+ArrowLeft");
  const selection = await selectionSnapshot(page);
  await page.locator(".rich-editor .cm-scroller").evaluate((element) => {
    element.scrollTop = 500;
  });
  const scrollTop = await page
    .locator(".rich-editor .cm-scroller")
    .evaluate((element) => element.scrollTop);
  expect(scrollTop).toBeGreaterThan(100);
  await toggle(page, "Hide sidebar");
  await expect.poll(() => width(page)).toBeLessThan(1);
  await toggle(page, "Show sidebar");
  expect(
    await editor!.evaluate(
      (element) => element === document.querySelector(".rich-editor .cm-editor")
    )
  ).toBe(true);
  expect(await selectionSnapshot(page)).toEqual(selection);
  expect(
    await page
      .locator(".rich-editor .cm-scroller")
      .evaluate((element) => element.scrollTop)
  ).toBeCloseTo(scrollTop, 0);
  await page.locator(".rich-editor .cm-content").focus();
  await page.keyboard.press(
    process.platform === "darwin" ? "Meta+z" : "Control+z"
  );
  await expect
    .poll(async () => (await documentSnapshot(page)).rawText)
    .toBe(markdown);
});

test("keyboard toggle transfers focus to the available sidebar toggle", async ({
  page
}) => {
  await ready(page);
  const hide = page.getByRole("button", { name: "Hide sidebar", exact: true });
  await hide.focus();
  await hide.press("Enter");
  await settled(page);
  const show = page.getByRole("button", { name: "Show sidebar", exact: true });
  await expect(show).toBeFocused();
  await show.press("Enter");
  await settled(page);
  await expect(
    page.getByRole("button", { name: "Hide sidebar", exact: true })
  ).toBeFocused();
});

test("resized sidebar width survives repeated toggles without persisting animation frames", async ({
  page
}) => {
  await ready(page);
  const initial = await width(page);
  const pane = await page.locator(".primary").boundingBox();
  await page.mouse.move(pane!.x + pane!.width, pane!.y + pane!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    pane!.x + pane!.width + 80,
    pane!.y + pane!.height / 2,
    { steps: 8 }
  );
  await page.mouse.up();
  await expect.poll(() => width(page)).toBeGreaterThan(initial + 40);
  const resized = await width(page);
  const saved = await page.evaluate(async (url) => {
    const { usePlumaStore } = await import(/* @vite-ignore */ url);
    return [...usePlumaStore.getState().layout.paneSizes];
  }, uiUrl);
  await page.evaluate(async (url) => {
    const { usePlumaStore } = await import(/* @vite-ignore */ url);
    const scope = window as Window & { sidebarSavedSizes: number[][] };
    scope.sidebarSavedSizes = [];
    usePlumaStore.getState().setCommandHandlers({
      updatePaneSizes: (sizes: number[]) =>
        scope.sidebarSavedSizes.push([...sizes])
    });
  }, uiUrl);
  for (let cycle = 0; cycle < 2; cycle++) {
    await toggle(page, "Hide sidebar");
    await toggle(page, "Show sidebar");
    expect(await width(page)).toBeCloseTo(resized, 0);
  }
  expect(
    await page.evaluate(async (url) => {
      const { usePlumaStore } = await import(/* @vite-ignore */ url);
      return usePlumaStore.getState().layout.paneSizes;
    }, uiUrl)
  ).toEqual(saved);
  expect(
    await page.evaluate(
      () =>
        (window as Window & { sidebarSavedSizes: number[][] }).sidebarSavedSizes
    )
  ).toEqual([]);
});

test("reduced motion collapses and expands without intermediate animation", async ({
  page
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await ready(page);
  const expanded = await width(page);
  for (const name of ["Hide sidebar", "Show sidebar"] as const) {
    const result = await page.evaluate(async (name) => {
      document
        .querySelector<HTMLButtonElement>(`button[aria-label="${name}"]`)!
        .click();
      const layout = document.querySelector(".pane-layout")!;
      const target = name === "Hide sidebar" ? "false" : "true";
      for (
        let frame = 0;
        frame < 120 && layout.getAttribute("data-primary-visible") !== target;
        frame++
      ) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve())
        );
      }
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );
      return {
        animating: document
          .querySelector(".pane-layout")!
          .getAttribute("data-primary-animating"),
        width: document.querySelector(".primary")!.getBoundingClientRect().width
      };
    }, name);
    expect(result.animating).not.toBe("true");
    expect(result.width).toBeCloseTo(name === "Hide sidebar" ? 0 : expanded, 0);
  }
});

test("initially hidden sidebar restores remembered width after a window resize", async ({
  page
}) => {
  await ready(page, false);
  await expect.poll(() => width(page)).toBeLessThan(1);
  await page.setViewportSize({ width: 1240, height: 900 });
  await expect.poll(() => width(page)).toBeLessThan(1);
  await toggle(page, "Show sidebar");
  expect(await width(page)).toBeCloseTo(260, 0);
  await toggle(page, "Hide sidebar");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await toggle(page, "Show sidebar");
  expect(await width(page)).toBeCloseTo(260, 0);
});

test("manual dragging cannot shrink the expanded sidebar below 200 pixels", async ({
  page
}) => {
  await ready(page);
  const pane = await page.locator(".primary").boundingBox();
  await page.mouse.move(pane!.x + pane!.width, pane!.y + pane!.height / 2);
  await page.mouse.down();
  await page.mouse.move(pane!.x + 80, pane!.y + pane!.height / 2, { steps: 8 });
  await page.mouse.up();
  await expect.poll(() => width(page)).toBeCloseTo(200, 0);
  await toggle(page, "Hide sidebar");
  await toggle(page, "Show sidebar");
  expect(await width(page)).toBeCloseTo(200, 0);
});
