import { BrowserWindow, dialog } from "electron";
import { writeFile } from "node:fs/promises";

import type { DocumentSession } from "@pluma/core";

import {
  getDefaultExportPath,
  renderStandaloneExportHtml,
  type ExportDocumentFormat
} from "./exportDocumentHtml";

export type ExportDocumentOptions = {
  appDocumentsPath: string;
  document: DocumentSession;
  format: ExportDocumentFormat;
  parentWindow: BrowserWindow;
};

export type ExportDocumentResult =
  | { filePath: string; kind: "success" }
  | { kind: "cancelled" };

export async function exportDocument(
  options: ExportDocumentOptions
): Promise<ExportDocumentResult> {
  const result = await dialog.showSaveDialog(options.parentWindow, {
    defaultPath: getDefaultExportPath(
      options.document,
      options.appDocumentsPath,
      options.format
    ),
    filters: [getExportFileFilter(options.format)],
    title:
      options.format === "html"
        ? "Export Document as HTML"
        : "Export Document as PDF"
  });

  if (result.canceled || !result.filePath) {
    return { kind: "cancelled" };
  }

  const html = await renderStandaloneExportHtml(options.document, {
    includeBaseHref: options.format === "pdf"
  });

  if (options.format === "html") {
    await writeFile(result.filePath, html, "utf8");
  } else {
    await writeFile(result.filePath, await renderPdfBuffer(html));
  }

  return {
    filePath: result.filePath,
    kind: "success"
  };
}

function getExportFileFilter(
  format: ExportDocumentFormat
): Electron.FileFilter {
  return format === "html"
    ? { name: "HTML", extensions: ["html", "htm"] }
    : { name: "PDF", extensions: ["pdf"] };
}

async function renderPdfBuffer(html: string): Promise<Buffer> {
  const printWindow = new BrowserWindow({
    height: 1056,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    },
    width: 816
  });

  try {
    await printWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
    );

    return await printWindow.webContents.printToPDF({
      pageSize: "Letter",
      printBackground: true
    });
  } finally {
    if (!printWindow.isDestroyed()) {
      printWindow.destroy();
    }
  }
}
