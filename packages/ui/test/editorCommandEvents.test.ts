import { describe, expect, it } from "vitest";

import { addEditorCommandEventListener } from "../src/shell/editorCommandEvents";

describe("addEditorCommandEventListener", () => {
  it("passes editor command event details to the command handler", () => {
    const target = new EventTarget();
    const commands: unknown[] = [];

    const removeListener = addEditorCommandEventListener(
      (command) => commands.push(command),
      target
    );

    target.dispatchEvent(
      new CustomEvent("pluma:editor-command", { detail: "find" })
    );

    expect(commands).toEqual(["find"]);

    removeListener();
    target.dispatchEvent(
      new CustomEvent("pluma:editor-command", { detail: "find-next" })
    );

    expect(commands).toEqual(["find"]);
  });
});
