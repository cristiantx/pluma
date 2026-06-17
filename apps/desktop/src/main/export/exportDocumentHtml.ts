import path from "node:path";
import { pathToFileURL } from "node:url";

import {
  getFileLocationName,
  renderMarkdownExportHtml,
  type DocumentSession
} from "@pluma/core";

export type ExportDocumentFormat = "html" | "pdf";

export type StandaloneExportHtmlOptions = {
  baseHref?: string;
  bodyHtml: string;
  title: string;
};

export type RenderStandaloneExportHtmlOptions = {
  includeBaseHref?: boolean;
};

const exportFileExtensions: Record<ExportDocumentFormat, string> = {
  html: ".html",
  pdf: ".pdf"
};

export function getDefaultExportPath(
  document: DocumentSession,
  appDocumentsPath: string,
  format: ExportDocumentFormat
): string {
  if (document.location.kind === "desktop-path") {
    const parsedPath = path.parse(document.location.path);

    return path.join(
      parsedPath.dir,
      `${parsedPath.name}${exportFileExtensions[format]}`
    );
  }

  const documentName = path.parse(getFileLocationName(document.location)).name;

  return path.join(
    appDocumentsPath,
    `${documentName || "Untitled"}${exportFileExtensions[format]}`
  );
}

export function getDesktopDocumentBaseHref(
  document: DocumentSession
): string | undefined {
  if (document.location.kind !== "desktop-path") {
    return undefined;
  }

  return pathToFileURL(`${path.dirname(document.location.path)}${path.sep}`)
    .href;
}

export async function renderStandaloneExportHtml(
  document: DocumentSession,
  options: RenderStandaloneExportHtmlOptions = {}
): Promise<string> {
  const bodyHtml = await renderMarkdownExportHtml(document.rawText);
  const baseHref = options.includeBaseHref
    ? getDesktopDocumentBaseHref(document)
    : undefined;

  return buildStandaloneExportHtml({
    bodyHtml,
    title: getFileLocationName(document.location),
    ...(baseHref ? { baseHref } : {})
  });
}

export function buildStandaloneExportHtml({
  baseHref,
  bodyHtml,
  title
}: StandaloneExportHtmlOptions): string {
  const baseTag = baseHref
    ? `\n  <base href="${escapeHtmlAttribute(baseHref)}">`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">${baseTag}
  <title>${escapeHtmlText(title)}</title>
  <style>
${getNeutralExportStyles()}
  </style>
</head>
<body>
  <main class="pluma-export-document">
${indentHtml(bodyHtml, 4)}
  </main>
</body>
</html>
`;
}

function getNeutralExportStyles(): string {
  return `    :root {
      color: #1f2933;
      background: #ffffff;
      font-family: ui-serif, Georgia, "Times New Roman", serif;
      font-size: 16px;
      line-height: 1.62;
    }

    @page {
      margin: 0.6in;
    }

    body {
      margin: 0;
      background: #ffffff;
    }

    .pluma-export-document {
      max-width: 760px;
      margin: 0 auto;
    }

    h1, h2, h3, h4, h5, h6 {
      color: #111827;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.25;
      margin: 1.6em 0 0.55em;
    }

    h1 {
      font-size: 2rem;
    }

    h2 {
      border-bottom: 1px solid #d7dde4;
      font-size: 1.5rem;
      padding-bottom: 0.25rem;
    }

    p, blockquote, pre, table, ul, ol {
      margin: 0 0 1rem;
    }

    a {
      color: #1d4ed8;
    }

    blockquote {
      border-left: 3px solid #c8d0d9;
      color: #52606d;
      padding-left: 1rem;
    }

    code {
      background: #eef2f6;
      border-radius: 4px;
      font-family: ui-monospace, "SFMono-Regular", Consolas, monospace;
      font-size: 0.9em;
      padding: 0.12em 0.3em;
    }

    pre {
      background: #f4f6f8;
      border: 1px solid #d7dde4;
      border-radius: 6px;
      overflow-x: auto;
      padding: 0.85rem 1rem;
    }

    pre code {
      background: transparent;
      padding: 0;
    }

    table {
      border-collapse: collapse;
      width: 100%;
    }

    th, td {
      border: 1px solid #d7dde4;
      padding: 0.4rem 0.55rem;
    }

    th {
      background: #f4f6f8;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      text-align: left;
    }

    img {
      max-width: 100%;
    }`;
}

function escapeHtmlText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlAttribute(value: string): string {
  return escapeHtmlText(value).replace(/"/g, "&quot;");
}

function indentHtml(html: string, spaces: number): string {
  const indentation = " ".repeat(spaces);

  return html
    .trim()
    .split("\n")
    .map((line) => `${indentation}${line}`)
    .join("\n");
}
