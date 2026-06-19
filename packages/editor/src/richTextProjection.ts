import type { Node as ProseMirrorNode } from "@milkdown/prose/model";
import type { EditorView } from "@milkdown/prose/view";

import type { TextSearchMatch } from "./editorSearch.js";

export type RichTextProjection = {
  positions: Array<number | null>;
  text: string;
};

export function projectRichText(view: EditorView): RichTextProjection {
  return projectRichTextDocument(view.state.doc);
}

export function projectRichTextDocument(
  doc: ProseMirrorNode
): RichTextProjection {
  const positions: Array<number | null> = [];
  let text = "";

  doc.descendants((node, position) => {
    if (!node.isTextblock) {
      return true;
    }

    node.descendants((child, childOffset) => {
      if (!child.isText || !child.text) {
        return true;
      }

      const textStart = position + 1 + childOffset;

      for (let index = 0; index < child.text.length; index += 1) {
        text += child.text[index] ?? "";
        positions.push(textStart + index);
      }

      return true;
    });

    text += "\n";
    positions.push(null);

    return false;
  });

  return { positions, text };
}

export function toProseMirrorRange(
  projection: RichTextProjection,
  match: TextSearchMatch
): { from: number; to: number } | null {
  const from = projection.positions[match.from];
  const endPosition = projection.positions[match.to - 1];

  if (
    from === null ||
    from === undefined ||
    endPosition === null ||
    endPosition === undefined
  ) {
    return null;
  }

  return {
    from,
    to: endPosition + 1
  };
}

export function textIndexFromProseMirrorPosition(
  projection: RichTextProjection,
  position: number
): number {
  const index = projection.positions.findIndex(
    (candidate) => candidate !== null && candidate >= position
  );

  return index >= 0 ? index : projection.text.length;
}

export function getLineStarts(text: string): number[] {
  const starts = [0];

  for (let index = 0; index < text.length; index += 1) {
    if (text[index] === "\n") {
      starts.push(index + 1);
    }
  }

  return starts;
}
