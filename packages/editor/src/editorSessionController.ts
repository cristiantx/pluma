import { history } from "@codemirror/commands";
import {
  Compartment,
  EditorSelection,
  EditorState,
  type Extension
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

type DocumentSession = {
  state: EditorState;
  configuration: Compartment;
  baselineRevision: number;
};

/** Runtime editing state belongs to a document, independently of its mounted view. */
export class EditorSessionController {
  private sessions = new Map<string, DocumentSession>();

  acquire(
    documentId: string,
    text: string,
    extensions: Extension,
    baselineRevision = 0
  ): EditorState {
    const existing = this.sessions.get(documentId);
    if (
      existing &&
      existing.baselineRevision === baselineRevision &&
      existing.state.doc.toString() === text
    ) {
      existing.state = existing.state.update({
        effects: existing.configuration.reconfigure(extensions)
      }).state;
      return existing.state;
    }
    const configuration = existing?.configuration ?? new Compartment();
    const state = EditorState.create({
      doc: text,
      extensions: [
        history(),
        EditorState.allowMultipleSelections.of(true),
        configuration.of(extensions)
      ]
    });
    this.sessions.set(documentId, { state, configuration, baselineRevision });
    return state;
  }

  capture(documentId: string, state: EditorState): void {
    const session = this.sessions.get(documentId);
    if (session) session.state = state;
  }

  configure(documentId: string, view: EditorView, extensions: Extension): void {
    const session = this.sessions.get(documentId);
    if (session)
      view.dispatch({ effects: session.configuration.reconfigure(extensions) });
  }

  /** Disk reloads establish a new undo baseline, while retaining clamped source selection. */
  reload(
    documentId: string,
    view: EditorView,
    text: string,
    extensions: Extension,
    baselineRevision = 0
  ): void {
    const previous = view.state.selection;
    this.sessions.delete(documentId);
    const state = this.acquire(documentId, text, extensions, baselineRevision);
    const clamp = (position: number) => Math.min(position, state.doc.length);
    const selection = EditorSelection.create(
      previous.ranges.map((range) =>
        EditorSelection.range(clamp(range.anchor), clamp(range.head))
      ),
      previous.mainIndex
    );
    view.setState(state.update({ selection }).state);
    this.capture(documentId, view.state);
  }

  retain(documentIds: readonly string[]): void {
    const open = new Set(documentIds);
    for (const id of this.sessions.keys())
      if (!open.has(id)) this.sessions.delete(id);
  }
}
