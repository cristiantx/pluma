import type { CommandExecutionResult } from "@pluma/commands";
import {
  app,
  shell,
  type IpcMainEvent,
  type IpcMainInvokeEvent
} from "electron";

import type { DesktopCommandOrigin } from "../commands/desktopCommandDispatcher";
import { writeAppSettings } from "../persistence/appPersistence";
import { getAppSettingsUpdate } from "../settings/appSettingsUpdate";
import type { DesktopSettingsController } from "../settings/desktopSettingsController";
import type { DesktopWindowSession } from "../windows/DesktopWindowSession";
import type { DocumentTextFlushCoordinator } from "./documentTextFlushCoordinator";
import { registerIpcHandlers } from "./registerIpcHandlers";

export type DesktopIpcBindingsDependencies = {
  dispatchCommand: (
    command: unknown,
    origin: DesktopCommandOrigin
  ) => Promise<CommandExecutionResult>;
  flushCoordinator: DocumentTextFlushCoordinator;
  getAppSettingsPath: () => string;
  getLatestFocusedSession: () => DesktopWindowSession | null;
  getSessionForEvent: (
    event: IpcMainEvent | IpcMainInvokeEvent
  ) => DesktopWindowSession | null;
  settingsController: DesktopSettingsController;
};

export function registerDesktopIpcBindings(
  dependencies: DesktopIpcBindingsDependencies
): void {
  registerIpcHandlers({
    quickAccess: async (event, request) => {
      const session = dependencies.getSessionForEvent(event);
      if (!session)
        return {
          status: "unavailable",
          reason: "The window is no longer available."
        };
      try {
        return await session.handleQuickAccess(request);
      } catch (error) {
        return {
          status: "failed",
          message: error instanceof Error ? error.message : "The action failed."
        };
      }
    },
    acknowledgeDocumentTextFlush: (event, requestId) => {
      dependencies.flushCoordinator.acknowledge(event.sender.id, requestId);
    },
    runCommand: async (event, command) => {
      return dependencies.dispatchCommand(command, {
        kind: "renderer",
        session: dependencies.getSessionForEvent(event)
      });
    },
    searchWorkspace: (event, query, folderPath, options) =>
      dependencies
        .getSessionForEvent(event)
        ?.searchWorkspace(query, folderPath, options) ?? Promise.resolve([]),
    setEditorMode: (event, mode) => {
      dependencies.getSessionForEvent(event)?.setEditorMode(mode);
    },
    setActiveDocument: async (event, documentId) => {
      await dependencies
        .getSessionForEvent(event)
        ?.setActiveDocument(documentId);
    },
    setActiveTab: async (event, tabId) => {
      await dependencies.getSessionForEvent(event)?.setActiveTab(tabId);
    },
    openWorkspaceFile: async (event, filePath) => {
      await dependencies.getSessionForEvent(event)?.openWorkspaceFile(filePath);
    },
    closeTab: async (event, tabId) => {
      await dependencies.getSessionForEvent(event)?.closeTab(tabId);
    },
    showTabContextMenu: (event, tabId, tabIds) => {
      dependencies.getSessionForEvent(event)?.showTabContextMenu(tabId, tabIds);
    },
    showWorkspaceContextMenu: (event, targetPath, kind) => {
      dependencies
        .getSessionForEvent(event)
        ?.showWorkspaceContextMenu(targetPath, kind);
    },
    updatePaneSizes: (event, paneSizes) => {
      dependencies.getSessionForEvent(event)?.updatePaneSizes(paneSizes);
    },
    updateDocumentText: (event, documentId, rawText) => {
      dependencies
        .getSessionForEvent(event)
        ?.updateDocumentText(documentId, rawText);
    },
    getSettings: async () => dependencies.settingsController.getSnapshot(),
    openAppDataFolder: async () => {
      await shell.openPath(app.getPath("userData"));
    },
    openExternalUrl: async (_event, url) => {
      if (!isExternalWebUrl(url)) {
        dependencies
          .getLatestFocusedSession()
          ?.emitStatus("External URL open was ignored.");
        return;
      }

      await shell.openExternal(url);
    },
    openSettingsFile: async () => {
      await writeAppSettings(
        dependencies.getAppSettingsPath(),
        dependencies.settingsController.getSnapshot()
      );
      await shell.openPath(dependencies.getAppSettingsPath());
    },
    resetSettings: async () => dependencies.settingsController.reset(),
    updateSettings: async (_event, settings) =>
      dependencies.settingsController.update(getAppSettingsUpdate(settings))
  });
}

function isExternalWebUrl(url: unknown): url is string {
  if (typeof url !== "string") {
    return false;
  }

  try {
    const parsedUrl = new URL(url);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}
