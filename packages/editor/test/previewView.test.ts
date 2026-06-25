import { describe, expect, it, vi } from "vitest";
import type * as DraftlyPlugins from "draftly/plugins";

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
    expect(css).toContain("max-width: var(--rich-editor-content-width);");
    expect(css).toContain("--pluma-preview-content-padding: 64px 92px 88px;");
    expect(css).toContain("padding: var(--pluma-preview-content-padding);");
    expect(css).not.toContain("max-width: 860px");
  });
});

async function createTestDraftlyPluginsModule(): Promise<
  typeof DraftlyPlugins
> {
  const [
    { HeadingPlugin },
    { ImagePlugin },
    { LinkPlugin },
    { ListPlugin },
    { ParagraphPlugin }
  ] = await Promise.all([
    import("draftly/src/plugins/heading-plugin.ts"),
    import("draftly/src/plugins/image-plugin.ts"),
    import("draftly/src/plugins/link-plugin.ts"),
    import("draftly/src/plugins/list-plugin.ts"),
    import("draftly/src/plugins/paragraph-plugin.ts")
  ]);

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
  } as unknown as typeof DraftlyPlugins;
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
