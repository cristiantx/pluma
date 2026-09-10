import {
  commandExecuted,
  commandCancelled,
  type CommandExecutionResult
} from "@pluma/commands";
import { type DocumentSession } from "@pluma/core";
import { shell, type BrowserWindow } from "electron";
import path from "node:path";
import type { RendererEvent } from "../../shared/shellState";
import { exportDocument, type ExportDocumentResult } from "./desktopExport";
import type { ExportDocumentFormat } from "./exportDocumentHtml";
export type WindowDocumentExportDependencies = {
  getActiveDocumentForActiveTab(): DocumentSession | null;
  emitToRenderer(event: RendererEvent): void;
  window: BrowserWindow;
  appDocumentsPath: string;
  getOpenExportedFile(): boolean;
};
export function createWindowDocumentExport(
  dependencies: WindowDocumentExportDependencies
) {
  async function exportActiveDocument(
    format: ExportDocumentFormat
  ): Promise<CommandExecutionResult> {
    const activeDocument = dependencies.getActiveDocumentForActiveTab();

    if (!activeDocument) {
      dependencies.emitToRenderer({
        type: "status",
        message: "No active document to export."
      });
      return commandCancelled;
    }

    try {
      const result = await exportDocument({
        appDocumentsPath: dependencies.appDocumentsPath,
        document: activeDocument,
        format,
        parentWindow: dependencies.window
      });

      return handleExportResult(result, format);
    } catch (error) {
      dependencies.emitToRenderer({
        type: "status",
        message:
          error instanceof Error
            ? `Export failed: ${error.message}`
            : "Export failed."
      });
      return {
        status: "failed",
        message: error instanceof Error ? error.message : "Export failed."
      };
    }
  }

  async function handleExportResult(
    result: ExportDocumentResult,
    format: ExportDocumentFormat
  ): Promise<CommandExecutionResult> {
    if (result.kind === "cancelled") {
      dependencies.emitToRenderer({
        type: "status",
        message: "Export cancelled."
      });
      return commandCancelled;
    }

    if (dependencies.getOpenExportedFile()) {
      await shell.openPath(result.filePath);
    }

    dependencies.emitToRenderer({
      type: "status",
      message:
        format === "html"
          ? `Exported HTML to ${path.basename(result.filePath)}.`
          : `Exported PDF to ${path.basename(result.filePath)}.`
    });
    return commandExecuted;
  }
  return { exportActiveDocument, handleExportResult };
}
