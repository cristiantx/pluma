import {
  defaultKeymap,
  historyKeymap,
  indentWithTab
} from "@codemirror/commands";
import { search } from "@codemirror/search";
import { drawSelection, dropCursor, keymap } from "@codemirror/view";
import { markdownCommandKeymap } from "./markdownCommands.js";
import { sourceSearchDecorations } from "./sourceSearchDecorations.js";

export const editorExtensions = [
  drawSelection(),
  dropCursor(),
  search(),
  sourceSearchDecorations,
  markdownCommandKeymap,
  keymap.of([indentWithTab]),
  keymap.of([...defaultKeymap, ...historyKeymap])
];
