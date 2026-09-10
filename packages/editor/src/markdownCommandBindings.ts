import type { Extension } from "@codemirror/state";
import { keymap, type KeyBinding } from "@codemirror/view";
import {
  getCodeMirrorBinding,
  type CommandPlatform,
  type MarkdownCommandId
} from "@pluma/commands";

import { runMarkdownCommand } from "./markdownCommands.js";

const markdownCommandIds = [
  "toggle-bold",
  "toggle-italic",
  "toggle-heading-1",
  "toggle-heading-2",
  "toggle-heading-3"
] as const satisfies readonly MarkdownCommandId[];

export function createMarkdownCommandKeymap(
  platform: CommandPlatform = "linux"
): Extension {
  return keymap.of(
    markdownCommandIds.flatMap((command): KeyBinding[] => {
      const key = getCodeMirrorBinding(command, platform);

      return key
        ? [
            {
              key,
              preventDefault: true,
              run: (view) => runMarkdownCommand(view, command)
            }
          ]
        : [];
    })
  );
}

export const markdownCommandKeymap = createMarkdownCommandKeymap();
