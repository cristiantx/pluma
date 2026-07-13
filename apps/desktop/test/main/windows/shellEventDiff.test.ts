import { describe, expect, it } from "vitest";

import {
  createDocumentSession,
  markDocumentSessionSaved,
  updateDocumentSessionText
} from "@pluma/core";

import { getShellStateEvents } from "../../../src/main/windows/shellEventDiff";
import { initialDesktopShellSnapshot } from "../../../src/shared/shellState";

function createDocument(path: string, rawText: string) {
  return createDocumentSession({
    location: { kind: "desktop-path", path },
    metadata: { fileId: path, mtimeMs: 1, size: rawText.length },
    rawText
  });
}

describe("getShellStateEvents", () => {
  it("sends a single-document patch without serializing other documents", () => {
    const first = createDocument("/workspace/first.md", "first");
    const second = createDocument(
      "/workspace/second.md",
      "second-document-content"
    );
    const edited = updateDocumentSessionText(first, "first edited");
    const saved = markDocumentSessionSaved(edited, {
      fileId: first.location.kind === "desktop-path" ? first.location.path : "",
      mtimeMs: 2,
      size: edited.rawText.length
    });
    const previous = {
      ...initialDesktopShellSnapshot,
      activeDocumentId: first.id,
      activeTabId: first.id,
      documents: [first, second]
    };
    const events = getShellStateEvents(previous, {
      ...previous,
      documents: [saved, second]
    });

    expect(events).toEqual([
      {
        documentId: first.id,
        patch: {
          lastSavedMetadata: saved.lastSavedMetadata,
          lastSavedText: "first edited",
          rawText: "first edited"
        },
        type: "document-patched"
      }
    ]);
    expect(JSON.stringify(events)).not.toContain("second-document-content");
  });

  it("describes document, active-tab, mode, and workspace structural changes", () => {
    const document = createDocument("/workspace/notes.md", "# Notes\n");
    const events = getShellStateEvents(initialDesktopShellSnapshot, {
      ...initialDesktopShellSnapshot,
      activeDocumentId: document.id,
      activeTabId: document.id,
      documentViewModes: { [document.id]: "rich" },
      documents: [document],
      editorViewMode: "rich",
      workspaceEntries: [
        {
          depth: 0,
          kind: "file",
          name: "notes.md",
          path: "/workspace/notes.md"
        }
      ],
      workspacePath: "/workspace"
    });

    expect(events.map(({ type }) => type)).toEqual([
      "document-opened",
      "active-document-changed",
      "workspace-changed"
    ]);
    expect(events[0]).toMatchObject({ index: 0, viewMode: "rich" });
  });
});
