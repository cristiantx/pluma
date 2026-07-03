import type { EditorView } from "@codemirror/view";

type RichEditorRenderRefreshScheduler = {
  cancelAnimationFrame: (handle: number) => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
};

type RichEditorRenderRefreshView = Pick<
  EditorView,
  "dispatch" | "requestMeasure" | "state"
>;

export function scheduleRichEditorRenderRefresh(
  view: RichEditorRenderRefreshView,
  scheduler: RichEditorRenderRefreshScheduler = window
): () => void {
  const frameHandles = new Set<number>();
  let isCanceled = false;

  const requestFrame = (callback: FrameRequestCallback) => {
    const frameHandle = scheduler.requestAnimationFrame((timestamp) => {
      frameHandles.delete(frameHandle);

      if (!isCanceled) {
        callback(timestamp);
      }
    });
    frameHandles.add(frameHandle);
  };

  const refresh = () => {
    view.requestMeasure();
    view.dispatch({ selection: view.state.selection });
  };

  requestFrame(() => {
    refresh();
    requestFrame(refresh);
  });

  return () => {
    isCanceled = true;

    for (const frameHandle of frameHandles) {
      scheduler.cancelAnimationFrame(frameHandle);
    }

    frameHandles.clear();
  };
}
