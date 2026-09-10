import { createDocumentSession } from "@pluma/core";
import { describe, expect, it, vi } from "vitest";

import type { DesktopShellSnapshot } from "../../../src/shared/shellState";
import { serializeWindowSession } from "../../../src/main/session/windowSessionSerialization";

describe("serializeWindowSession", () => {
  it("returns the persisted window fields and filters unsupported references", () => {
    const desktopDocument = createDocumentSession({
      location: { kind: "desktop-path", path: "/workspace/notes.md" },
      metadata: null,
      rawText: "# Notes"
    });
    const draftDocument = createDocumentSession({
      location: {
        draftId: "draft-1",
        kind: "app-draft",
        name: "Draft"
      },
      metadata: null,
      rawText: "Draft"
    });
    const browserDocument = createDocumentSession({
      location: {
        handleKey: "browser-1",
        kind: "browser-file-handle",
        name: "Browser.md"
      },
      metadata: null,
      rawText: "Browser"
    });
    const snapshot: DesktopShellSnapshot = {
      activeDocumentId: desktopDocument.id,
      activeTabId: desktopDocument.id,
      documents: [desktopDocument, draftDocument, browserDocument],
      documentViewModes: {},
      editorViewMode: "source",
      isDevelopment: false,
      paneSizes: [240, 800],
      status: "Ready",
      workspaceEntries: [],
      workspacePath: "/workspace"
    };
    const getReference = vi.fn((document) => {
      if (document.location.kind === "desktop-path") {
        return {
          editorMode: "rich" as const,
          kind: "desktop-path" as const,
          path: document.location.path
        };
      }

      if (document.location.kind === "app-draft") {
        return {
          draftId: document.location.draftId,
          editorMode: "source" as const,
          kind: "app-draft" as const,
          name: document.location.name
        };
      }

      return null;
    });

    expect(serializeWindowSession(snapshot, "preview", getReference)).toEqual({
      activeDocumentRef: {
        editorMode: "rich",
        kind: "desktop-path",
        path: "/workspace/notes.md"
      },
      activeDocumentPath: "/workspace/notes.md",
      documentRefs: [
        {
          editorMode: "rich",
          kind: "desktop-path",
          path: "/workspace/notes.md"
        },
        {
          draftId: "draft-1",
          editorMode: "source",
          kind: "app-draft",
          name: "Draft"
        }
      ],
      documentPaths: ["/workspace/notes.md"],
      editorMode: "preview",
      paneSizes: [240, 800],
      workspacePath: "/workspace"
    });
  });
});
