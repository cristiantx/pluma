/* global fetch, window, document, performance, PerformanceObserver, requestAnimationFrame */
export async function settleParsing(page, root) {
  await page.evaluate(async (url) => {
    const source = await (await fetch(url)).text();
    const resolveModule = (name) =>
      [...source.matchAll(/from\s*["']([^"']+)["']/g)].find((entry) =>
        entry[1].includes(name)
      )[1];
    const { EditorView } = await import(resolveModule("codemirror_view"));
    const { forceParsing, syntaxTreeAvailable } = await import(
      resolveModule("codemirror_language")
    );
    const view = EditorView.findFromDOM(
      document.querySelector(".rich-editor .cm-editor")
    );
    forceParsing(view, view.state.doc.length, 5000);
    if (!syntaxTreeAvailable(view.state, view.state.doc.length))
      throw new Error("Incomplete benchmark parse");
  }, `/@fs/${root}/packages/editor/src/sourceEditorExtensions.ts`);
}

export async function startPhase(page) {
  return page.evaluate(() => {
    window.__richBench.tasks = [];
    window.__richBench.observer = new PerformanceObserver((list) =>
      window.__richBench.tasks.push(
        ...list.getEntries().map((entry) => entry.duration)
      )
    );
    window.__richBench.observer.observe({ type: "longtask" });
    return {
      mermaidCalls: window.__richBench.mermaidCalls,
      workspaceCommits: window.__richBench.workspaceCommits
    };
  });
}

export async function endPhase(page, before) {
  return page.evaluate((before) => {
    const state = window.__richBench;
    state.observer.disconnect();
    return {
      mermaidCalls: state.mermaidCalls - before.mermaidCalls,
      workspaceCommits: state.workspaceCommits - before.workspaceCommits,
      longTaskCount: state.tasks.length,
      longTaskMaxMs: Math.max(0, ...state.tasks)
    };
  }, before);
}

export async function selectionPhase(page) {
  const before = await startPhase(page);
  for (let index = 0; index < 10; index++) {
    await page.keyboard.press(index % 2 ? "ArrowLeft" : "ArrowRight");
    await page.evaluate(
      () =>
        new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))
        )
    );
  }
  return { samples: 10, ...(await endPhase(page, before)) };
}

export async function scrollingPhase(page) {
  const before = await startPhase(page);
  const times = [];
  const rounds = [];
  const missingAfterReturn = [];
  for (let round = 0; round < 3; round++) {
    const calls = await page.evaluate(() => window.__richBench.mermaidCalls);
    for (const fraction of [1, 0]) {
      times.push(
        await page.evaluate(async (fraction) => {
          const scroller = document.querySelector(".rich-editor .cm-scroller");
          const start = performance.now();
          scroller.scrollTop = fraction * scroller.scrollHeight;
          await new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve))
          );
          return performance.now() - start;
        }, fraction)
      );
      if (fraction)
        await page.waitForFunction(
          () =>
            document.querySelectorAll(
              ".rich-editor .cm-draftly-mermaid-rendered"
            ).length === 0
        );
      else
        await page
          .locator(".rich-editor .cm-draftly-mermaid-rendered svg")
          .first()
          .waitFor({ timeout: 3000 })
          .catch(() => missingAfterReturn.push(round));
    }
    await page.waitForTimeout(100);
    rounds.push(
      await page.evaluate(
        (calls) => window.__richBench.mermaidCalls - calls,
        calls
      )
    );
  }
  return {
    times,
    mermaidCallsPerRound: rounds,
    missingAfterReturn,
    ...(await endPhase(page, before))
  };
}
