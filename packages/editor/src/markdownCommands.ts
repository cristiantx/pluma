import { EditorSelection } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import type { MarkdownCommandId } from "@pluma/commands";

export type MarkdownCommandName = MarkdownCommandId;

export function runMarkdownCommand(
  view: EditorView,
  command: MarkdownCommandName
): boolean {
  switch (command) {
    case "toggle-bold":
      return wrapSelection("**")(view);
    case "toggle-italic":
      return wrapSelection("_")(view);
    case "toggle-heading-1":
      return toggleLinePrefix("# ")(view);
    case "toggle-heading-2":
      return toggleLinePrefix("## ")(view);
    case "toggle-heading-3":
      return toggleLinePrefix("### ")(view);
  }
}

function wrapSelection(marker: string): (view: EditorView) => boolean {
  return (view) => {
    const changes = view.state.changeByRange((range) => {
      if (range.empty) {
        return {
          changes: { from: range.from, insert: `${marker}${marker}` },
          range: EditorSelection.cursor(range.from + marker.length)
        };
      }

      const selectedText = view.state.sliceDoc(range.from, range.to);
      const wrappedText = `${marker}${selectedText}${marker}`;

      return {
        changes: { from: range.from, to: range.to, insert: wrappedText },
        range: EditorSelection.range(
          range.from + marker.length,
          range.from + marker.length + selectedText.length
        )
      };
    });

    view.dispatch(changes);

    return true;
  };
}

function toggleLinePrefix(prefix: string): (view: EditorView) => boolean {
  return (view) => {
    const changes = view.state.changeByRange((range) => {
      const line = view.state.doc.lineAt(range.from);
      const lineText = view.state.sliceDoc(line.from, line.to);
      const existingHeading = /^(#{1,6}\s+)/.exec(lineText);

      if (existingHeading?.[0] === prefix) {
        return {
          changes: {
            from: line.from,
            to: line.from + prefix.length,
            insert: ""
          },
          range: EditorSelection.cursor(
            Math.max(line.from, range.head - prefix.length)
          )
        };
      }

      if (existingHeading) {
        return {
          changes: {
            from: line.from,
            to: line.from + existingHeading[0].length,
            insert: prefix
          },
          range: EditorSelection.cursor(
            range.head + prefix.length - existingHeading[0].length
          )
        };
      }

      return {
        changes: {
          from: line.from,
          insert: prefix
        },
        range: EditorSelection.cursor(range.head + prefix.length)
      };
    });

    view.dispatch(changes);

    return true;
  };
}
