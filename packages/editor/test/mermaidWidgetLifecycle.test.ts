import { afterEach, describe, expect, it, vi } from "vitest";
import type { EditorView } from "@codemirror/view";
import { MermaidBlockWidget } from "draftly/src/plugins/mermaid/widget";

const { render } = vi.hoisted(() => ({ render: vi.fn() }));
vi.mock("draftly/src/plugins/mermaid/render", () => ({
  renderMermaid: render
}));

function harness() {
  const requestMeasure = vi.fn();
  const onError = vi.fn();
  const view = {
    requestMeasure,
    state: { facet: () => onError }
  } as unknown as EditorView;
  vi.stubGlobal("document", {
    createElement: () => ({
      type: "",
      style: {},
      innerHTML: "",
      isConnected: true,
      setAttribute: vi.fn(),
      addEventListener: vi.fn(),
      classList: { add: vi.fn() },
      querySelector: () => ({ viewBox: { baseVal: { width: 120 } }, style: {} })
    })
  });
  return { view, requestMeasure, onError };
}

function widget(definition = "graph LR\nA --> B", theme = "default") {
  return new MermaidBlockWidget(definition, {}, theme, 0, 30, "caret");
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("patched Mermaid widget lifecycle", () => {
  it("restores successful output synchronously over five remounts", async () => {
    const { view, requestMeasure } = harness();
    render.mockResolvedValue({ svg: "<svg>diagram</svg>", error: null });
    const diagram = widget();
    let dom = diagram.toDOM(view);
    await Promise.resolve();
    for (let index = 0; index < 5; index++) {
      diagram.destroy(dom);
      dom = diagram.toDOM(view);
      expect(dom.innerHTML).toBe("<svg>diagram</svg>");
    }
    expect(render).toHaveBeenCalledTimes(1);
    expect(requestMeasure).toHaveBeenCalledTimes(1);
  });

  it("discards an old mount while its replacement awaits the same render", async () => {
    const { view, requestMeasure } = harness();
    let finish!: (result: { svg: string; error: null }) => void;
    const pending = new Promise<{ svg: string; error: null }>((resolve) => {
      finish = resolve;
    });
    render.mockReturnValue(pending);
    const diagram = widget();
    const old = diagram.toDOM(view);
    // CodeMirror can destroy through an equal replacement widget, not the creator.
    const replacement = widget();
    expect(replacement.eq(diagram)).toBe(true);
    replacement.destroy(old);
    const current = replacement.toDOM(view);
    finish({ svg: "<svg>current</svg>", error: null });
    await pending;
    expect(old.innerHTML).toContain("Rendering diagram");
    expect(current.innerHTML).toBe("<svg>current</svg>");
    expect(requestMeasure).toHaveBeenCalledTimes(1);
  });

  it("retains output inherited by an equal replacement widget", async () => {
    const { view } = harness();
    render.mockResolvedValue({ svg: "<svg>inherited</svg>", error: null });
    const dom = widget().toDOM(view);
    await Promise.resolve();
    const replacement = widget();
    replacement.destroy(dom);
    expect(replacement.toDOM(view).innerHTML).toBe("<svg>inherited</svg>");
    expect(render).toHaveBeenCalledTimes(1);
  });

  it("does not measure or report errors to a destroyed view", async () => {
    const { view, requestMeasure, onError } = harness();
    render.mockResolvedValue({ svg: "", error: "invalid definition" });
    const diagram = widget();
    const dom = diagram.toDOM(view);
    diagram.destroy(dom);
    await Promise.resolve();
    expect(requestMeasure).not.toHaveBeenCalled();
    expect(onError).not.toHaveBeenCalled();
  });

  it("retries failures and does not share cached output with changed widgets", async () => {
    const { view, onError } = harness();
    render.mockResolvedValueOnce({ svg: "", error: "invalid definition" });
    render.mockResolvedValue({ svg: "<svg>fixed</svg>", error: null });
    const diagram = widget();
    const failed = diagram.toDOM(view);
    await Promise.resolve();
    expect(onError).toHaveBeenCalledTimes(1);
    diagram.destroy(failed);
    diagram.toDOM(view);
    await Promise.resolve();
    const changed = widget("graph LR\nA --> C");
    const dark = widget(undefined, "dark");
    const attributes = new MermaidBlockWidget(
      diagram.definition,
      { theme: "forest" },
      "default",
      0,
      30,
      "caret"
    );
    expect(diagram.eq(changed)).toBe(false);
    expect(diagram.eq(dark)).toBe(false);
    expect(diagram.eq(attributes)).toBe(false);
    changed.toDOM(view);
    dark.toDOM(view);
    attributes.toDOM(view);
    expect(render).toHaveBeenCalledTimes(5);
  });
});
