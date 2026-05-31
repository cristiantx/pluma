import { describe, expect, it } from "vitest";
import { createDocumentSession } from "@pluma/core";

import {
  appendActivity,
  initialShellState,
  reduceShellEvent
} from "../../src/shared/shellState";

describe("appendActivity", () => {
  it("caps the activity feed to six items", () => {
    const result = ["a", "b", "c", "d", "e", "f"].reduce(
      (activity, message) => appendActivity(activity, message),
      [] as string[]
    );

    expect(appendActivity(result, "g")).toEqual(["g", "f", "e", "d", "c", "b"]);
  });
});

describe("reduceShellEvent", () => {
  it("updates the current mode when the renderer receives a mode event", () => {
    expect(
      reduceShellEvent(initialShellState, {
        type: "mode-changed",
        mode: "source"
      })
    ).toMatchObject({
      mode: "source",
      status: "Editor mode switched to source."
    });
  });

  it("accepts split as a renderer mode event", () => {
    expect(
      reduceShellEvent(initialShellState, {
        type: "mode-changed",
        mode: "split"
      })
    ).toMatchObject({
      mode: "split",
      status: "Editor mode switched to split."
    });
  });

  it("hydrates the shell snapshot when workspace data arrives", () => {
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/tmp/pluma/Notes.md"
      },
      metadata: {
        fileId: "1",
        mtimeMs: 10,
        size: 10
      },
      rawText: "# Notes\n"
    });

    expect(
      reduceShellEvent(initialShellState, {
        type: "shell-snapshot",
        snapshot: {
          activeDocumentId: session.id,
          documents: [session],
          paneSizes: [220, 780],
          status: "Opened Notes.md.",
          workspaceEntries: [
            {
              depth: 0,
              kind: "file",
              name: "Notes.md",
              path: "/tmp/pluma/Notes.md"
            }
          ],
          workspacePath: "/tmp/pluma"
        }
      })
    ).toMatchObject({
      activeDocumentId: session.id,
      documents: [session],
      paneSizes: [220, 780],
      status: "Opened Notes.md.",
      workspacePath: "/tmp/pluma"
    });
  });

  it("normalizes incomplete shell snapshots without crashing the renderer", () => {
    expect(
      reduceShellEvent(initialShellState, {
        type: "shell-snapshot",
        snapshot: {
          status: "Recovered from partial payload."
        } as never
      })
    ).toMatchObject({
      activeDocumentId: null,
      documents: [],
      paneSizes: [],
      status: "Recovered from partial payload.",
      workspaceEntries: [],
      workspacePath: null
    });
  });
});
