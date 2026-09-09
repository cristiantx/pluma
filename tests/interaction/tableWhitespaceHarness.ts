import { expect, type Locator } from "@playwright/test";

export const cancelledCell = "Cancelled by card?";
export const tableWhitespaceMarkdown = `| Status | Description | Follow-up | Owner |
| --- | --- | --- | --- |
| ${cancelledCell} | A payment with several details that must be reviewed by the customer service team. | Contact the customer to confirm the cancellation and complete the follow-up process. | Customer service handles this request and informs the account owner when it is resolved. |

After the table.
`;

export async function cellLineEnd(cell: Locator, lineIndex = -1) {
  await cell.scrollIntoViewIfNeeded();
  return cell.evaluate((element, lineIndex) => {
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
    const lines: {
      left: number;
      right: number;
      top: number;
      bottom: number;
      end: number;
    }[] = [];
    let offset = 0;
    while (walker.nextNode()) {
      const node = walker.currentNode;
      const text = node.textContent!;
      for (let index = 0; index < text.length; index++) {
        const range = document.createRange();
        range.setStart(node, index);
        range.setEnd(node, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        let line = lines.find((line) => Math.abs(line.top - rect.top) < 2);
        if (!line) {
          line = {
            left: rect.left,
            right: rect.right,
            top: rect.top,
            bottom: rect.bottom,
            end: 0
          };
          lines.push(line);
        }
        line.right = Math.max(line.right, rect.right);
        line.end = offset + index + 1;
      }
      offset += text.length;
    }
    const line = lines.at(lineIndex)!;
    const cell = element.getBoundingClientRect();
    return {
      lineCount: lines.length,
      end: line.end,
      x: cell.right - 5,
      y: (line.top + line.bottom) / 2,
      bottomY: cell.bottom - 4,
      textRight: line.right,
      lineTop: line.top,
      lineBottom: line.bottom
    };
  }, lineIndex);
}

export function expectWrappedBlankSpace(
  point: Awaited<ReturnType<typeof cellLineEnd>>
) {
  expect(point.lineCount).toBeGreaterThan(1);
  expect(point.x - point.textRight).toBeGreaterThan(25);
}
