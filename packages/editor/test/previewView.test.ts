import { describe, expect, it, vi } from "vitest";
import type { DraftlyPluginsModule } from "../src/draftlyPlugins.js";

import {
  renderPreviewContent,
  resolvePreviewImageUrls
} from "../src/previewRenderer.js";

describe("PreviewView rendering", () => {
  it("renders headings, lists, and links as semantic preview HTML", async () => {
    const draftlyPlugins = await createTestDraftlyPluginsModule();
    const { html } = await renderPreviewContent(
      {
        rawText: [
          "# Project Notes",
          "",
          "- First item",
          "- [Draftly](https://example.com/docs)"
        ].join("\n"),
        resolvedTheme: "light"
      },
      draftlyPlugins
    );

    expect(html).toContain('<article class="pluma-preview-content">');
    expect(html).toContain("<h1");
    expect(html).toContain("Project Notes</h1>");
    expect(html).toContain("<ul");
    expect(html).toContain("<li>");
    expect(html).toContain(
      '<a class="cm-draftly-link" href="https://example.com/docs" target="_blank" rel="noopener noreferrer">Draftly</a>'
    );
  });

  it("escapes raw HTML when no preview plugin handles its nodes", async () => {
    const draftlyPlugins = await createTestDraftlyPluginsModule();
    const { html } = await renderPreviewContent(
      { rawText: '<img src=x onerror="alert(1)">', resolvedTheme: "light" },
      draftlyPlugins
    );

    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(html).toContain("&quot;alert(1)&quot;");
  });

  it("rejects executable link/image URLs and escapes image attributes", async () => {
    const plugins = await createTestDraftlyPluginsModule();
    const { html } = await renderPreviewContent(
      {
        rawText:
          '[Unsafe](javascript:alert%281%29)\n\n![Unsafe](javascript:alert%281%29)\n\n![quote" onerror="bad](https://example.com/image.png "title&value")',
        resolvedTheme: "light"
      },
      plugins
    );
    expect(html).not.toMatch(/(?:href|src)="javascript:/i);
    expect(html).not.toContain(' onerror="bad"');
    expect(html).toContain('alt="quote&quot; onerror=&quot;bad"');
    expect(html).toContain('title="title&amp;value"');
  });

  it("creates isolated plugins for simultaneous preview renders", async () => {
    const draftlyPlugins = await createTestDraftlyPluginsModule();
    const instances: object[] = [];
    const ParagraphPlugin = draftlyPlugins.ParagraphPlugin;
    draftlyPlugins.ParagraphPlugin = class extends ParagraphPlugin {
      constructor() {
        super();
        instances.push(this);
      }
    };

    const results = await Promise.all([
      renderPreviewContent(
        { rawText: "First document", resolvedTheme: "light" },
        draftlyPlugins
      ),
      renderPreviewContent(
        { rawText: "Second document", resolvedTheme: "light" },
        draftlyPlugins
      )
    ]);

    expect(instances).toHaveLength(2);
    expect(instances[0]).not.toBe(instances[1]);
    expect(results[0].html).toContain("First document");
    expect(results[1].html).toContain("Second document");
    expect(results[0].css).toBe(results[1].css);
  });

  it("resolves local preview image URLs with the rich editor image behavior", async () => {
    const draftlyPlugins = await createTestDraftlyPluginsModule();
    const { html } = await renderPreviewContent(
      {
        rawText: '![Logo](./images/logo.png "Brand mark")',
        resolvedTheme: "light"
      },
      draftlyPlugins
    );
    const image = new FakeImageElement("./images/logo.png");
    const root = new FakeImageRoot(image);

    expect(html).toContain(
      '<img class="cm-draftly-image" src="./images/logo.png" alt="Logo" title="Brand mark" loading="lazy" decoding="async" />'
    );

    resolvePreviewImageUrls(
      root as unknown as ParentNode,
      "pluma-asset://local/Users/me/Documents/Notes/"
    );

    expect(image.getAttribute("data-pluma-original-src")).toBe(
      "./images/logo.png"
    );
    expect(image.getAttribute("src")).toBe(
      "pluma-asset://local/Users/me/Documents/Notes/images/logo.png"
    );
  });

  it("renders read-only content without calling an accidental onChange", async () => {
    const draftlyPlugins = await createTestDraftlyPluginsModule();
    const onChange = vi.fn();

    await renderPreviewContent(
      {
        rawText: "- [x] Read-only task",
        resolvedTheme: "dark",
        onChange
      } as Parameters<typeof renderPreviewContent>[0] & {
        onChange: (rawText: string) => void;
      },
      draftlyPlugins
    );

    expect(onChange).not.toHaveBeenCalled();
  });

  it("uses the rich editor content width and spacing tokens", async () => {
    const draftlyPlugins = await createTestDraftlyPluginsModule();
    const { css } = await renderPreviewContent(
      {
        rawText: "# Same frame",
        resolvedTheme: "light"
      },
      draftlyPlugins
    );

    expect(css).toContain("width: var(--rich-editor-content-width);");
    expect(css).toContain("max-width: var(--rich-editor-content-max-width);");
    expect(css).toContain("padding: var(--rich-editor-content-padding);");
    expect(css).toContain(".pluma-preview-content p,");
    expect(css).toContain(".pluma-preview-content .cm-draftly-paragraph");
    expect(css).toContain("padding-top: 0;");
    expect(css).toContain(".pluma-preview-content .cm-draftly-preview li");
    expect(css).toContain("display: inline;");
    expect(css).toContain("line-height: inherit;");
    expect(css).toContain("padding-left: 2rem !important;");
    expect(css).toContain("margin-bottom: 0;");
    expect(css).toContain(
      ".pluma-preview-content .cm-draftly-preview li > .cm-draftly-paragraph"
    );
    expect(css).not.toContain("max-width: 860px");
    expect(css).toContain("--draftly-color-surface: var(--editor-bg);");
    expect(css).toContain("--draftly-color-link: var(--accent);");
    expect(css).toContain("--draftly-font-mono: var(--font-editor);");
    expect(css).not.toContain("min-width: 520px");
    expect(css).not.toContain("min-height: 180px");
  });
});

async function createTestDraftlyPluginsModule(): Promise<DraftlyPluginsModule> {
  const {
    HeadingPlugin,
    ImagePlugin,
    LinkPlugin,
    ListPlugin,
    ParagraphPlugin
  } = await import("draftly/plugins");

  return {
    CodePlugin: EmptyPreviewPlugin,
    EmojiPlugin: EmptyPreviewPlugin,
    HRPlugin: EmptyPreviewPlugin,
    HTMLPlugin: EmptyPreviewPlugin,
    HeadingPlugin,
    ImagePlugin,
    InlinePlugin: EmptyPreviewPlugin,
    LinkPlugin,
    ListPlugin,
    MathPlugin: EmptyPreviewPlugin,
    MermaidPlugin: EmptyPreviewPlugin,
    ParagraphPlugin,
    QuotePlugin: EmptyPreviewPlugin,
    TablePlugin: EmptyPreviewPlugin
  } as unknown as DraftlyPluginsModule;
}

class EmptyPreviewPlugin {
  readonly name = "empty";
  readonly version = "test";
  readonly requiredNodes = [];

  getPreviewStyles(): string {
    return "";
  }

  getMarkdownConfig(): null {
    return null;
  }
}

class FakeImageElement {
  private readonly attributes = new Map<string, string>();

  constructor(src: string) {
    this.attributes.set("src", src);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  setAttribute(name: string, value: string): void {
    this.attributes.set(name, value);
  }
}

class FakeImageRoot {
  constructor(private readonly image: FakeImageElement) {}

  querySelectorAll(selector: string): FakeImageElement[] {
    expect(selector).toBe("img.cm-draftly-image");
    return [this.image];
  }
}
