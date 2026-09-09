import { undo, undoDepth } from "@codemirror/commands";
import {
  EditorSelection,
  EditorState,
  type TransactionSpec
} from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import { describe, expect, it } from "vitest";

import { EditorSessionController } from "../src/editorSessionController.js";

function undoState(state: EditorState): EditorState {
  let result = state;
  expect(
    undo({
      state,
      dispatch: (transaction) => {
        result = transaction.state;
      }
    })
  ).toBe(true);
  return result;
}

function createView(initialState: EditorState) {
  return {
    state: initialState,
    dispatch(spec: TransactionSpec) {
      this.state = this.state.update(spec).state;
    },
    setState(state: EditorState) {
      this.state = state;
    }
  };
}

describe("EditorSessionController", () => {
  it("preserves undo history and directional multiple selections across reacquisition", () => {
    const sessions = new EditorSessionController();
    let state = sessions.acquire("first", "abcdefghij", []);
    state = state.update({ changes: { from: 10, insert: "!" } }).state;
    state = state.update({
      selection: EditorSelection.create(
        [EditorSelection.range(4, 1), EditorSelection.range(7, 9)],
        1
      )
    }).state;
    sessions.capture("first", state);
    const restored = sessions.acquire(
      "first",
      "abcdefghij!",
      EditorState.tabSize.of(8)
    );
    expect(restored.facet(EditorState.tabSize)).toBe(8);
    expect(restored.selection.toJSON()).toEqual(state.selection.toJSON());
    expect(undoState(restored).doc.toString()).toBe("abcdefghij");
  });

  it("keeps document histories isolated during live reconfiguration", () => {
    const sessions = new EditorSessionController();
    const first = sessions.acquire("first", "one", []);
    sessions.capture(
      "first",
      first.update({ changes: { from: 3, insert: "!" } }).state
    );
    const second = sessions.acquire("second", "two", []);
    sessions.capture(
      "second",
      second.update({ changes: { from: 0, insert: "?" } }).state
    );
    const view = createView(sessions.acquire("first", "one!", []));
    sessions.configure(
      "first",
      view as unknown as EditorView,
      EditorState.tabSize.of(2)
    );
    sessions.capture("first", view.state);
    expect(view.state.facet(EditorState.tabSize)).toBe(2);
    expect(undoState(view.state).doc.toString()).toBe("one");
    expect(
      undoState(sessions.acquire("second", "?two", [])).doc.toString()
    ).toBe("two");
  });

  it("discards closed documents while preserving retained history", () => {
    const sessions = new EditorSessionController();
    for (const id of ["first", "second"]) {
      const state = sessions.acquire(id, "text", []);
      sessions.capture(
        id,
        state.update({ changes: { from: 4, insert: "!" } }).state
      );
    }
    sessions.retain(["second"]);
    expect(undoDepth(sessions.acquire("first", "text!", []))).toBe(0);
    expect(
      undoState(sessions.acquire("second", "text!", [])).doc.toString()
    ).toBe("text");
  });

  it("clears same-text history on a new baseline revision without resetting other documents", () => {
    const sessions = new EditorSessionController();
    for (const id of ["first", "second"]) {
      const state = sessions.acquire(id, "text", [], 0);
      sessions.capture(
        id,
        state.update({ changes: { from: 4, insert: "!" } }).state
      );
    }
    expect(undoDepth(sessions.acquire("first", "text!", [], 0))).toBe(1);
    expect(undoDepth(sessions.acquire("first", "text!", [], 1))).toBe(0);
    expect(
      undoState(sessions.acquire("second", "text!", [], 0)).doc.toString()
    ).toBe("text");
  });

  it("remembers an explicit same-text reload revision for subsequent edits and remounts", () => {
    const sessions = new EditorSessionController();
    const initial = sessions.acquire("first", "text", []);
    const edited = initial.update({ changes: { from: 4, insert: "!" } }).state;
    sessions.capture("first", edited);
    const view = createView(edited);
    sessions.reload("first", view as unknown as EditorView, "text!", [], 1);
    expect(undoDepth(view.state)).toBe(0);
    view.dispatch({ changes: { from: 5, insert: "?" } });
    sessions.capture("first", view.state);
    expect(
      undoState(sessions.acquire("first", "text!?", [], 1)).doc.toString()
    ).toBe("text!");
  });

  it("reloads into a clean history baseline and clamps directional selection", () => {
    const sessions = new EditorSessionController();
    let state = sessions.acquire("first", "abcdefghij", []);
    state = state.update({ changes: { from: 10, insert: "!" } }).state;
    state = state.update({ selection: EditorSelection.range(10, 3) }).state;
    sessions.capture("first", state);
    const view = createView(state);
    sessions.reload(
      "first",
      view as unknown as EditorView,
      "short",
      EditorState.tabSize.of(8)
    );
    expect(view.state.doc.toString()).toBe("short");
    expect(view.state.selection.main.anchor).toBe(5);
    expect(view.state.selection.main.head).toBe(3);
    expect(undoDepth(view.state)).toBe(0);
    const restored = sessions.acquire("first", "short", []);
    expect(restored.selection.toJSON()).toEqual(view.state.selection.toJSON());
    expect(undoDepth(restored)).toBe(0);
  });
});
