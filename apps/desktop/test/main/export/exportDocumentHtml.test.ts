import { describe, expect, it } from "vitest";

import {
  buildStandaloneExportHtml,
  getDefaultExportPath,
  getDesktopDocumentBaseHref,
  renderStandaloneExportHtml
} from "../../../src/main/export/exportDocumentHtml";
import { createDocumentSession } from "@pluma/core";

describe("export document HTML helpers", () => {
  it("builds default export paths from desktop document paths", () => {
    const document = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/Notes.md"
      },
      metadata: null,
      rawText: "# Notes\n"
    });

    expect(getDefaultExportPath(document, "/Users/me/Documents", "html")).toBe(
      "/Users/me/Documents/Notes.html"
    );
    expect(getDefaultExportPath(document, "/Users/me/Documents", "pdf")).toBe(
      "/Users/me/Documents/Notes.pdf"
    );
  });

  it("uses the app documents path for draft exports", () => {
    const document = createDocumentSession({
      location: {
        draftId: "draft-1",
        kind: "app-draft",
        name: "Untitled-1"
      },
      metadata: null,
      rawText: "# Draft\n"
    });

    expect(getDefaultExportPath(document, "/Users/me/Documents", "html")).toBe(
      "/Users/me/Documents/Untitled-1.html"
    );
  });

  it("creates a desktop file base href for relative PDF assets", () => {
    const document = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/Notes.md"
      },
      metadata: null,
      rawText: "![Image](./image.png)\n"
    });

    expect(getDesktopDocumentBaseHref(document)).toBe(
      "file:///Users/me/Documents/"
    );
  });

  it("builds standalone escaped export documents", () => {
    const html = buildStandaloneExportHtml({
      baseHref: 'file:///Users/me/A "quoted" Folder/',
      bodyHtml: "<h1>Title</h1>",
      title: 'A "quoted" <title>'
    });

    expect(html).toContain("<!doctype html>");
    expect(html).toContain(
      '<base href="file:///Users/me/A &quot;quoted&quot; Folder/">'
    );
    expect(html).toContain('<title>A "quoted" &lt;title&gt;</title>');
    expect(html).toContain('<main class="pluma-export-document">');
    expect(html).toContain("<h1>Title</h1>");
  });

  it("renders active Markdown into a standalone sanitized document", async () => {
    const document = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/Notes.md"
      },
      metadata: null,
      rawText: `# Notes

<script>alert("x")</script>
`
    });

    const html = await renderStandaloneExportHtml(document);

    expect(html).toContain("<h1>Notes</h1>");
    expect(html).not.toContain("<base");
    expect(html).not.toContain("<script");
  });

  it("adds a base href only when requested for static rendering", async () => {
    const document = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/Users/me/Documents/Notes.md"
      },
      metadata: null,
      rawText: "![Image](./image.png)\n"
    });

    const html = await renderStandaloneExportHtml(document, {
      includeBaseHref: true
    });

    expect(html).toContain('<base href="file:///Users/me/Documents/">');
  });
});
