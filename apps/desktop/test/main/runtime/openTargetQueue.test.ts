import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  normalizeOpenTargets,
  OpenTargetQueue,
  type OpenTargetSession
} from "../../../src/main/runtime/openTargetQueue";

describe("normalizeOpenTargets", () => {
  it("keeps only absolute, non-flag targets", () => {
    const firstTarget = path.resolve("notes/first.md");
    const secondTarget = path.resolve("notes/second.md");

    expect(
      normalizeOpenTargets([
        "",
        "--inspect",
        "-v",
        ".",
        "..",
        "notes/relative.md",
        firstTarget,
        secondTarget
      ])
    ).toEqual([firstTarget, secondTarget]);
  });
});

describe("OpenTargetQueue", () => {
  it("captures one target session for the whole drained batch", async () => {
    const firstSession: OpenTargetSession = {
      handleOpenTarget: vi.fn(() => Promise.resolve())
    };
    const secondSession: OpenTargetSession = {
      handleOpenTarget: vi.fn(() => Promise.resolve())
    };
    let latestSession = firstSession;
    const queue = new OpenTargetQueue({
      createWindow: vi.fn(() => secondSession),
      getLatestSession: () => latestSession
    });
    firstSession.handleOpenTarget = vi.fn(async () => {
      latestSession = secondSession;
    });

    queue.queue(["/first.md", "/second.md"]);
    await queue.flush();

    expect(firstSession.handleOpenTarget).toHaveBeenNthCalledWith(
      1,
      "/first.md"
    );
    expect(firstSession.handleOpenTarget).toHaveBeenNthCalledWith(
      2,
      "/second.md"
    );
    expect(secondSession.handleOpenTarget).not.toHaveBeenCalled();
  });

  it("leaves targets appended during a flush for the next drain", async () => {
    const handledTargets: string[] = [];
    const session: OpenTargetSession = {
      handleOpenTarget: vi.fn(async (targetPath) => {
        handledTargets.push(targetPath);
        if (targetPath === "/first.md") {
          queue.queue(["/later.md"]);
        }
      })
    };
    const queue = new OpenTargetQueue({
      createWindow: vi.fn(() => session),
      getLatestSession: () => session
    });

    queue.queue(["/first.md", "/second.md"]);
    await queue.flush();

    expect(handledTargets).toEqual(["/first.md", "/second.md"]);

    await queue.flush();
    expect(handledTargets).toEqual(["/first.md", "/second.md", "/later.md"]);
  });

  it("creates one session only when a non-empty flush has no latest session", async () => {
    const session: OpenTargetSession = {
      handleOpenTarget: vi.fn(() => Promise.resolve())
    };
    const createWindow = vi.fn(() => session);
    const queue = new OpenTargetQueue({
      createWindow,
      getLatestSession: () => null
    });

    await queue.flush();
    expect(createWindow).not.toHaveBeenCalled();

    queue.queue(["/first.md"]);
    await queue.flush();
    expect(createWindow).toHaveBeenCalledOnce();
  });
});
