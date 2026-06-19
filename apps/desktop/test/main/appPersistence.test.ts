import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import {
  defaultAppSettings,
  isMeaningfulPersistedWindowState,
  normalizePersistedSessionState,
  readAppSettings,
  readPersistedSessionState
} from "../../src/main/persistence/appPersistence";

describe("readAppSettings", () => {
  it("defaults spellcheck on for legacy settings", async () => {
    const directoryPath = await mkdtemp(path.join(tmpdir(), "pluma-settings-"));

    try {
      const settingsPath = path.join(directoryPath, "settings.json");

      await writeFile(
        settingsPath,
        JSON.stringify({
          autosaveEnabled: false,
          themePreference: "dark"
        }),
        "utf8"
      );

      await expect(readAppSettings(settingsPath)).resolves.toEqual({
        autosaveEnabled: false,
        defaultLineEnding: "system",
        richEditorDensity: "comfortable",
        richEditorWidth: "default",
        sourceEditorColorScheme: "follow-theme",
        sourceEditorFontFamily: "mono",
        sourceEditorFontSize: 14,
        sourceEditorLineNumbers: true,
        sourceEditorTabSize: 2,
        sourceEditorWordWrap: true,
        sourceEditorWidth: "default",
        spellcheckEnabled: true,
        splitViewOrder: "rich-source",
        themePreference: "dark"
      });
    } finally {
      await rm(directoryPath, { force: true, recursive: true });
    }
  });

  it("preserves disabled spellcheck settings", async () => {
    const directoryPath = await mkdtemp(path.join(tmpdir(), "pluma-settings-"));

    try {
      const settingsPath = path.join(directoryPath, "settings.json");

      await writeFile(
        settingsPath,
        JSON.stringify({
          autosaveEnabled: true,
          spellcheckEnabled: false,
          themePreference: "system"
        }),
        "utf8"
      );

      await expect(readAppSettings(settingsPath)).resolves.toEqual({
        autosaveEnabled: true,
        defaultLineEnding: "system",
        richEditorDensity: "comfortable",
        richEditorWidth: "default",
        sourceEditorColorScheme: "follow-theme",
        sourceEditorFontFamily: "mono",
        sourceEditorFontSize: 14,
        sourceEditorLineNumbers: true,
        sourceEditorTabSize: 2,
        sourceEditorWordWrap: true,
        sourceEditorWidth: "default",
        spellcheckEnabled: false,
        splitViewOrder: "rich-source",
        themePreference: "system"
      });
    } finally {
      await rm(directoryPath, { force: true, recursive: true });
    }
  });

  it("loads editor settings from persisted settings", async () => {
    const directoryPath = await mkdtemp(path.join(tmpdir(), "pluma-settings-"));

    try {
      const settingsPath = path.join(directoryPath, "settings.json");

      await writeFile(
        settingsPath,
        JSON.stringify({
          autosaveEnabled: true,
          defaultLineEnding: "crlf",
          richEditorDensity: "compact",
          richEditorWidth: "wide",
          sourceEditorColorScheme: "pluma-dark",
          sourceEditorFontFamily: "system",
          sourceEditorFontSize: 16,
          sourceEditorLineNumbers: false,
          sourceEditorTabSize: 4,
          sourceEditorWordWrap: false,
          sourceEditorWidth: "full",
          spellcheckEnabled: true,
          splitViewOrder: "source-rich",
          themePreference: "system"
        }),
        "utf8"
      );

      await expect(readAppSettings(settingsPath)).resolves.toMatchObject({
        defaultLineEnding: "crlf",
        richEditorDensity: "compact",
        richEditorWidth: "wide",
        sourceEditorColorScheme: "pluma-dark",
        sourceEditorFontFamily: "system",
        sourceEditorFontSize: 16,
        sourceEditorLineNumbers: false,
        sourceEditorTabSize: 4,
        sourceEditorWordWrap: false,
        sourceEditorWidth: "full",
        splitViewOrder: "source-rich"
      });
    } finally {
      await rm(directoryPath, { force: true, recursive: true });
    }
  });

  it("falls back to default settings for malformed settings files", async () => {
    const directoryPath = await mkdtemp(path.join(tmpdir(), "pluma-settings-"));

    try {
      const settingsPath = path.join(directoryPath, "settings.json");

      await writeFile(settingsPath, "{", "utf8");

      await expect(readAppSettings(settingsPath)).resolves.toEqual(
        defaultAppSettings
      );
    } finally {
      await rm(directoryPath, { force: true, recursive: true });
    }
  });
});

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

  it("keeps draft document references as meaningful persisted window state", () => {
    expect(
      normalizePersistedSessionState({
        activeWindowIndex: 0,
        windows: [
          {
            activeDocumentPath: null,
            activeDocumentRef: {
              draftId: "draft-1",
              kind: "app-draft",
              name: "Untitled-1"
            },
            documentPaths: [],
            documentRefs: [
              {
                draftId: "draft-1",
                kind: "app-draft",
                name: "Untitled-1"
              }
            ],
            editorMode: "source",
            workspacePath: null
          }
        ]
      })
    ).toEqual({
      activeWindowIndex: 0,
      windows: [
        {
          activeDocumentPath: null,
          activeDocumentRef: {
            draftId: "draft-1",
            kind: "app-draft",
            name: "Untitled-1"
          },
          documentPaths: [],
          documentRefs: [
            {
              draftId: "draft-1",
              kind: "app-draft",
              name: "Untitled-1"
            }
          ],
          editorMode: "source",
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

  it("treats empty and malformed persisted files as absent state", async () => {
    const directoryPath = await mkdtemp(path.join(tmpdir(), "pluma-state-"));

    try {
      const emptyPath = path.join(directoryPath, "empty.json");
      const malformedPath = path.join(directoryPath, "malformed.json");

      await writeFile(emptyPath, "", "utf8");
      await writeFile(malformedPath, "{", "utf8");

      await expect(readPersistedSessionState(emptyPath)).resolves.toBeNull();
      await expect(
        readPersistedSessionState(malformedPath)
      ).resolves.toBeNull();
    } finally {
      await rm(directoryPath, { force: true, recursive: true });
    }
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
