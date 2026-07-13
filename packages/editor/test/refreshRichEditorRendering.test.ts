import type { EditorView } from "@codemirror/view";
import { describe, expect, it, vi } from "vitest";

import { scheduleRichEditorRenderRefresh } from "../src/refreshRichEditorRendering.js";

describe("scheduleRichEditorRenderRefresh", () => {
  it("requests measurement and dispatches a selection refresh across two frames", () => {
    const callbacks: FrameRequestCallback[] = [];
    const selection = {};
    const view = {
      dispatch: vi.fn(),
      requestMeasure: vi.fn(),
      state: {
        selection
      },
      viewport: { from: 0, to: 0 }
    } as unknown as Pick<EditorView, "dispatch" | "requestMeasure" | "state">;
    const scheduler = {
      cancelAnimationFrame: vi.fn(),
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      })
    };

    scheduleRichEditorRenderRefresh(view, scheduler, () => false);

    expect(callbacks).toHaveLength(1);

    callbacks[0]?.(1);

    expect(view.requestMeasure).toHaveBeenCalledTimes(1);
    expect(view.dispatch).toHaveBeenCalledWith({ selection });
    expect(callbacks).toHaveLength(2);

    callbacks[1]?.(2);

    expect(view.requestMeasure).toHaveBeenCalledTimes(2);
    expect(view.dispatch).toHaveBeenCalledTimes(2);
  });

  it("refreshes again when background syntax parsing completes", () => {
    const callbacks: FrameRequestCallback[] = [];
    const view = {
      dispatch: vi.fn(),
      requestMeasure: vi.fn(),
      state: {
        selection: {}
      },
      viewport: { from: 0, to: 120 }
    } as unknown as Pick<
      EditorView,
      "dispatch" | "requestMeasure" | "state" | "viewport"
    >;
    const scheduler = {
      cancelAnimationFrame: vi.fn(),
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      })
    };
    const isParsePending = vi
      .fn<(view: typeof view) => boolean>()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce(false);

    scheduleRichEditorRenderRefresh(view, scheduler, isParsePending);
    callbacks[0]?.(1);
    callbacks[1]?.(2);

    expect(view.dispatch).toHaveBeenCalledTimes(2);
    expect(callbacks).toHaveLength(3);

    callbacks[2]?.(3);

    expect(isParsePending).toHaveBeenCalledTimes(2);
    expect(view.requestMeasure).toHaveBeenCalledTimes(3);
    expect(view.dispatch).toHaveBeenCalledTimes(3);
  });

  it("cancels pending refresh frames", () => {
    const callbacks: FrameRequestCallback[] = [];
    const view = {
      dispatch: vi.fn(),
      requestMeasure: vi.fn(),
      state: {
        selection: {}
      },
      viewport: { from: 0, to: 0 }
    } as unknown as Pick<EditorView, "dispatch" | "requestMeasure" | "state">;
    const scheduler = {
      cancelAnimationFrame: vi.fn(),
      requestAnimationFrame: vi.fn((callback: FrameRequestCallback) => {
        callbacks.push(callback);
        return callbacks.length;
      })
    };

    const cancel = scheduleRichEditorRenderRefresh(
      view,
      scheduler,
      () => false
    );
    cancel();
    callbacks[0]?.(1);

    expect(scheduler.cancelAnimationFrame).toHaveBeenCalledWith(1);
    expect(view.requestMeasure).not.toHaveBeenCalled();
    expect(view.dispatch).not.toHaveBeenCalled();
  });
});
