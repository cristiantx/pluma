import { expect, test, type Locator } from "@playwright/test";
import {
  documentSnapshot,
  hydrate,
  insertAt,
  setSurface,
  textPoint
} from "./rendererHarness";

const numbers = [1, 9, 10, 99, 100, 999999999];
const markdown =
  "# Numbered lists\n\n" +
  numbers
    .map(
      (number) =>
        `${number}. Item ${number} has enough text to wrap onto another visual line while keeping its number separate from the content.`
    )
    .join("\n") +
  "\n\n1. Parent item\n\n   10. Nested item with multiple digits\n   100. Another nested item\n\n- Bullet stays aligned\n";

async function markerBounds(line: Locator) {
  return line.evaluate((element) => {
    const marker = element.querySelector(".cm-draftly-list-mark-ol")!;
    const content = element.querySelector(".cm-draftly-list-content")!;
    const markerRange = document.createRange();
    markerRange.selectNodeContents(marker);
    const firstCharacter = document.createRange();
    firstCharacter.setStart(content.firstChild!, 0);
    firstCharacter.setEnd(content.firstChild!, 1);
    return {
      markerRight: markerRange.getBoundingClientRect().right,
      contentLeft: firstCharacter.getBoundingClientRect().left,
      markerWidth: marker.getBoundingClientRect().width,
      textWidth: markerRange.getBoundingClientRect().width,
      contentLines: (() => {
        const range = document.createRange();
        range.selectNodeContents(content);
        return Array.from(range.getClientRects(), ({ left }) => left);
      })()
    };
  });
}

for (const theme of ["light", "dark"] as const) {
  test(`numbered markers fit without overlapping list text in ${theme}`, async ({
    page
  }, testInfo) => {
    await page.setViewportSize({ width: 960, height: 820 });
    await page.goto("/");
    await hydrate(page, markdown);
    await setSurface(page, theme);
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    for (const number of numbers) {
      const line = page
        .locator(".cm-draftly-list-line-ol")
        .filter({ hasText: `Item ${number} has` });
      await line.scrollIntoViewIfNeeded();
      for (const activeMarker of [false, true]) {
        const target = line.locator(
          activeMarker ? ".cm-draftly-list-mark-ol" : ".cm-draftly-list-content"
        );
        const point = await textPoint(target, activeMarker ? 1 : 5);
        await page.mouse.click(point.x, point.y);
        const bounds = await markerBounds(line);
        expect(
          bounds.markerRight,
          `${number}. marker must end before its text`
        ).toBeLessThanOrEqual(bounds.contentLeft + 0.5);
        expect(bounds.markerWidth).toBeGreaterThanOrEqual(
          bounds.textWidth - 0.5
        );
        expect(bounds.contentLines.length).toBeGreaterThan(1);
        for (const left of bounds.contentLines)
          expect(Math.abs(left - bounds.contentLeft)).toBeLessThan(1);
      }
    }
    const nested = page
      .locator(".cm-draftly-list-line-ol")
      .filter({ hasText: "Nested item with" });
    await nested.scrollIntoViewIfNeeded();
    const bounds = await markerBounds(nested);
    expect(bounds.markerRight).toBeLessThanOrEqual(bounds.contentLeft + 0.5);
    expect(await documentSnapshot(page)).toEqual({
      rawText: markdown,
      saveState: "idle"
    });
    const ninth = page
      .locator(".cm-draftly-list-line-ol")
      .filter({ hasText: "Item 9 has" });
    const numberPoint = await textPoint(
      ninth.locator(".cm-draftly-list-mark-ol"),
      1
    );
    await page.mouse.click(numberPoint.x, numberPoint.y);
    await page.keyboard.insertText("0");
    expect((await documentSnapshot(page)).rawText).toBe(
      markdown.replace("9. Item 9", "90. Item 9")
    );
    const editedBounds = await markerBounds(ninth);
    expect(editedBounds.markerRight).toBeLessThanOrEqual(
      editedBounds.contentLeft + 0.5
    );
    await insertAt(
      page,
      nested.locator(".cm-draftly-list-content"),
      7,
      "MARKER"
    );
    await page.screenshot({
      path: testInfo.outputPath(`numbered-list-${theme}.png`)
    });
    expect(errors).toEqual([]);
  });
}
