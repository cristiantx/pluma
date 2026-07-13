import { syntaxParserRunning, syntaxTreeAvailable } from "@codemirror/language";
import type { EditorView } from "@codemirror/view";

type RichEditorRenderRefreshScheduler = {
  cancelAnimationFrame: (handle: number) => void;
  requestAnimationFrame: (callback: FrameRequestCallback) => number;
};

type RichEditorRenderRefreshView = Pick<
  EditorView,
  "dispatch" | "requestMeasure" | "state" | "viewport"
>;

type RichEditorParsePending = (view: RichEditorRenderRefreshView) => boolean;

const parseWaitFrameLimit = 120;

export function scheduleRichEditorRenderRefresh(
  view: RichEditorRenderRefreshView,
  scheduler: RichEditorRenderRefreshScheduler = window,
  isParsePending: RichEditorParsePending = hasPendingVisibleSyntaxParse
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

  const refreshAfterParsing = (remainingFrames: number) => {
    if (!isParsePending(view) || remainingFrames === 0) {
      refresh();
      return;
    }

    requestFrame(() => refreshAfterParsing(remainingFrames - 1));
  };

  requestFrame(() => {
    refresh();
    requestFrame(() => {
      refresh();

      if (isParsePending(view)) {
        requestFrame(() => refreshAfterParsing(parseWaitFrameLimit));
      }
    });
  });

  return () => {
    isCanceled = true;

    for (const frameHandle of frameHandles) {
      scheduler.cancelAnimationFrame(frameHandle);
    }

    frameHandles.clear();
  };
}

function hasPendingVisibleSyntaxParse(
  view: RichEditorRenderRefreshView
): boolean {
  return (
    syntaxParserRunning(view as EditorView) &&
    !syntaxTreeAvailable(view.state, view.viewport.to)
  );
}
