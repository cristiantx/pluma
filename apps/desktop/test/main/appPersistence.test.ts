import { describe, expect, it } from "vitest";

import {
  isMeaningfulPersistedWindowState,
  normalizePersistedSessionState
} from "../../src/main/persistence/appPersistence";

describe("normalizePersistedSessionState", () => {
  it("upgrades a legacy single-window session into the multi-window shape", () => {
    expect(
      normalizePersistedSessionState({
        activeDocumentPath: "/tmp/pluma/a.md",
        documentPaths: ["/tmp/pluma/a.md"],
        editorMode: "source",
        paneSizes: [220, 780],
        workspacePath: "/tmp/pluma"
      })
    ).toEqual({
      activeWindowIndex: 0,
      windows: [
        {
          activeDocumentPath: "/tmp/pluma/a.md",
          documentPaths: ["/tmp/pluma/a.md"],
          editorMode: "source",
          paneSizes: [220, 780],
          workspacePath: "/tmp/pluma"
        }
      ]
    });
  });

  it("drops empty windows and normalizes the active index", () => {
    expect(
      normalizePersistedSessionState({
        activeWindowIndex: 8,
        windows: [
          {
            activeDocumentPath: null,
            documentPaths: [],
            editorMode: "source",
            paneSizes: [],
            workspacePath: null
          },
          {
            activeDocumentPath: "/tmp/pluma/b.md",
            documentPaths: ["/tmp/pluma/b.md"],
            editorMode: "split",
            workspacePath: null
          }
        ]
      })
    ).toEqual({
      activeWindowIndex: 0,
      windows: [
        {
          activeDocumentPath: "/tmp/pluma/b.md",
          documentPaths: ["/tmp/pluma/b.md"],
          editorMode: "split",
          workspacePath: null
        }
      ]
    });
  });

  it("preserves the active restored window index after empty windows are filtered", () => {
    expect(
      normalizePersistedSessionState({
        activeWindowIndex: 2,
        windows: [
          {
            activeDocumentPath: null,
            documentPaths: [],
            editorMode: "source",
            paneSizes: [],
            workspacePath: null
          },
          {
            activeDocumentPath: "/tmp/pluma/a.md",
            documentPaths: ["/tmp/pluma/a.md"],
            editorMode: "source",
            workspacePath: null
          },
          {
            activeDocumentPath: "/tmp/pluma/b.md",
            documentPaths: ["/tmp/pluma/b.md"],
            editorMode: "rich",
            workspacePath: null
          }
        ]
      })?.activeWindowIndex
    ).toBe(1);
  });

  it("rejects invalid persisted state", () => {
    expect(
      normalizePersistedSessionState({
        activeWindowIndex: 0,
        windows: [
          {
            activeDocumentPath: "/tmp/pluma/a.md",
            documentPaths: ["/tmp/pluma/a.md"],
            editorMode: "preview",
            workspacePath: null
          }
        ]
      })
    ).toBeNull();
  });
});

describe("isMeaningfulPersistedWindowState", () => {
  it("keeps document, workspace, and pane-only windows", () => {
    expect(
      isMeaningfulPersistedWindowState({
        activeDocumentPath: "/tmp/pluma/a.md",
        documentPaths: ["/tmp/pluma/a.md"],
        editorMode: "source",
        workspacePath: null
      })
    ).toBe(true);

    expect(
      isMeaningfulPersistedWindowState({
        activeDocumentPath: null,
        documentPaths: [],
        editorMode: "source",
        workspacePath: "/tmp/pluma"
      })
    ).toBe(true);

    expect(
      isMeaningfulPersistedWindowState({
        activeDocumentPath: null,
        documentPaths: [],
        editorMode: "source",
        paneSizes: [250, 750],
        workspacePath: null
      })
    ).toBe(true);
  });

  it("drops completely empty windows", () => {
    expect(
      isMeaningfulPersistedWindowState({
        activeDocumentPath: null,
        documentPaths: [],
        editorMode: "source",
        paneSizes: [],
        workspacePath: null
      })
    ).toBe(false);
  });
});
