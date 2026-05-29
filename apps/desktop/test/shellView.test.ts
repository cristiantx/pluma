import { describe, expect, it } from "vitest";
import { createDocumentSession } from "@pluma/core";

import { initialShellState } from "../src/shellState";
import {
  getActiveDocument,
  extractLeafName,
  getExplorerNodes,
  getOpenTabs,
  getShellSnapshot,
  getStatusMetrics,
  getWorkspaceLabel
} from "../src/shellView";

describe("extractLeafName", () => {
  it("returns the last path segment for unix and windows paths", () => {
    expect(extractLeafName("/tmp/pluma/notes.md")).toBe("notes.md");
    expect(extractLeafName("C:\\Users\\me\\drafts")).toBe("drafts");
  });
});

describe("getWorkspaceLabel", () => {
  it("prefers the active folder over the active file", () => {
    expect(
      getWorkspaceLabel({
        ...initialShellState,
        workspacePath: "/tmp/pluma"
      })
    ).toBe("pluma");
  });
});

describe("getStatusMetrics", () => {
  it("returns placeholder metrics when no file is active", () => {
    expect(getStatusMetrics(initialShellState)).toEqual([
      { label: "Words", value: "--" },
      { label: "Lines", value: "--" },
      { label: "Mode", value: "Rich" },
      { label: "Save", value: "Idle shell" }
    ]);
  });
});

describe("getExplorerNodes", () => {
  it("builds workspace-first entries when a folder is active", () => {
    expect(
      getExplorerNodes({
        ...initialShellState,
        workspaceEntries: [
          {
            depth: 0,
            kind: "folder",
            name: "Guides",
            path: "/tmp/pluma/Guides"
          }
        ],
        workspacePath: "/tmp/pluma"
      })[0]
    ).toMatchObject({
      id: "/tmp/pluma/Guides",
      kind: "folder",
      label: "Guides"
    });
  });
});

describe("getOpenTabs", () => {
  it("returns tab definitions for the active document sessions", () => {
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/tmp/pluma/notes.md"
      },
      metadata: {
        fileId: "1",
        mtimeMs: 10,
        size: 10
      },
      rawText: "# Notes\n"
    });

    expect(
      getOpenTabs({
        ...initialShellState,
        documents: [session]
      }).map((tab) => tab.id)
    ).toEqual([session.id]);
  });
});

describe("getActiveDocument", () => {
  it("returns the document selected by the active tab id", () => {
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/tmp/pluma/notes.md"
      },
      metadata: {
        fileId: "1",
        mtimeMs: 10,
        size: 10
      },
      rawText: "# Notes\n"
    });

    expect(
      getActiveDocument({
        ...initialShellState,
        activeDocumentId: session.id,
        documents: [session]
      })
    ).toEqual(session);
  });

  it("returns null when documents are missing at runtime", () => {
    expect(
      getActiveDocument({
        ...initialShellState,
        documents: undefined
      } as never)
    ).toBeNull();
  });
});

describe("getShellSnapshot", () => {
  it("derives a pluma shell snapshot from the desktop shell state", () => {
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/tmp/pluma/notes.md"
      },
      metadata: {
        fileId: "1",
        mtimeMs: 10,
        size: 10
      },
      rawText: "# Notes\n"
    });

    expect(
      getShellSnapshot(
        {
          ...initialShellState,
          activeDocumentId: session.id,
          documents: [session],
          isDevelopment: true,
          paneSizes: [230, 770],
          workspaceEntries: [
            {
              depth: 0,
              kind: "file",
              name: "notes.md",
              path: "/tmp/pluma/notes.md"
            }
          ],
          workspacePath: "/tmp/pluma"
        },
        true
      )
    ).toMatchObject({
      activeDocumentId: session.id,
      hasWorkspace: true,
      isBridgeAvailable: true,
      isDevelopment: true,
      paneSizes: [230, 770],
      workspaceLabel: "pluma"
    });
  });
});
