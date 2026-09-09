import { markdown } from "@codemirror/lang-markdown";
import {
  bracketMatching,
  foldGutter,
  indentUnit,
  indentOnInput
} from "@codemirror/language";
import { EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  highlightActiveLine,
  highlightActiveLineGutter,
  lineNumbers
} from "@codemirror/view";
import { plumaSourceEditorTheme } from "./sourceEditorTheme.js";

export function createSourceEditorExtensions(settings: {
  lineNumbers: boolean;
  tabSize: 2 | 4;
  wordWrap: boolean;
}): Extension[] {
  return [
    settings.lineNumbers ? lineNumbers() : [],
    foldGutter({
      markerDOM: createFoldMarker
    }),
    EditorState.tabSize.of(settings.tabSize),
    indentUnit.of(" ".repeat(settings.tabSize)),
    indentOnInput(),
    bracketMatching(),
    highlightActiveLine(),
    highlightActiveLineGutter(),
    markdown(),
    settings.wordWrap ? EditorView.lineWrapping : [],
    plumaSourceEditorTheme
  ];
}

function createFoldMarker(isOpen: boolean): HTMLElement {
  const marker = document.createElement("span");
  marker.className = "pluma-fold-marker";
  marker.setAttribute("aria-hidden", "true");
  marker.appendChild(
    createFoldMarkerIcon(isOpen ? "m6 9 6 6 6-6" : "m9 18 6-6-6-6")
  );

  return marker;
}

function createFoldMarkerIcon(pathData: string): SVGSVGElement {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const pathElement = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );

  svg.setAttribute("viewBox", "0 0 24 24");
  pathElement.setAttribute("d", pathData);
  svg.appendChild(pathElement);

  return svg;
}
