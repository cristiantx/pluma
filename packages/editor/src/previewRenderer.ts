import type * as DraftlyEditor from "draftly/editor";
import type * as DraftlyPlugins from "draftly/plugins";
import type * as DraftlyPreview from "draftly/preview";

import { createDraftlyPlugins } from "./draftlyPlugins.js";
import { resolveRichEditorImageUrls } from "./richEditorImageUrls.js";

export const plumaPreviewClassName = "pluma-preview";
export const plumaPreviewContentClassName = "pluma-preview-content";

export type PreviewRenderOptions = {
  rawText: string;
  resolvedTheme: "dark" | "light";
};

export type PreviewRenderResult = {
  css: string;
  html: string;
};

export async function renderPreviewContent(
  { rawText, resolvedTheme }: PreviewRenderOptions,
  draftlyPluginsModule?: DraftlyPluginsModule
): Promise<PreviewRenderResult> {
  const [{ ThemeEnum }, draftlyPlugins, { generateCSS, preview }] =
    await Promise.all([
      import("draftly/editor") as Promise<typeof DraftlyEditor>,
      draftlyPluginsModule
        ? Promise.resolve(draftlyPluginsModule)
        : (import("draftly/plugins") as Promise<DraftlyPluginsModule>),
      import("draftly/preview") as Promise<typeof DraftlyPreview>
    ]);
  const plugins = createDraftlyPlugins(draftlyPlugins).map(
    ensurePreviewPluginMethods
  );
  const theme = resolvedTheme === "dark" ? ThemeEnum.DARK : ThemeEnum.LIGHT;

  const html = await preview(rawText, {
    plugins,
    theme,
    wrapperClass: plumaPreviewContentClassName,
    wrapperTag: "article"
  });

  const css = [
    generateCSS({
      includeBase: true,
      plugins,
      theme,
      wrapperClass: plumaPreviewContentClassName
    }),
    createPreviewViewCss(resolvedTheme)
  ].join("\n\n");

  return { css, html };
}

type DraftlyPluginInstance = ReturnType<typeof createDraftlyPlugins>[number];

type DraftlyPreviewPlugin = DraftlyPluginInstance & {
  getMarkdownConfig?: () => unknown;
  getPreviewStyles?: (theme: unknown, wrapperClass: string) => string;
};

function ensurePreviewPluginMethods(
  plugin: DraftlyPluginInstance
): DraftlyPluginInstance {
  const previewPlugin = plugin as DraftlyPreviewPlugin;

  previewPlugin.getMarkdownConfig ??= () => null;
  previewPlugin.getPreviewStyles ??= () => "";

  return plugin;
}

export function resolvePreviewImageUrls(
  root: ParentNode,
  imageBaseUrl: string | undefined
): void {
  resolveRichEditorImageUrls(root, imageBaseUrl);
}

type DraftlyPluginsModule = typeof DraftlyPlugins;

function createPreviewViewCss(_resolvedTheme: "dark" | "light"): string {
  return `.${plumaPreviewClassName} {
  --color-border: var(--border-default);
  --font-jetbrains-mono: var(--font-editor);
  --font-sans: var(--font-ui);
  --pluma-preview-content-padding: 64px 92px 88px;
  box-sizing: border-box;
  height: 100%;
  overflow: overlay;
  color: var(--text-secondary);
  background: var(--editor-bg);
  font-family: var(--font-ui);
  font-size: 16px;
  line-height: 1.6;
}

.${plumaPreviewClassName} *,
.${plumaPreviewClassName} *::before,
.${plumaPreviewClassName} *::after {
  box-sizing: border-box;
}

.${plumaPreviewClassName}::-webkit-scrollbar {
  width: 12px;
  height: 12px;
}

.${plumaPreviewClassName}::-webkit-scrollbar-track {
  background: transparent;
}

.${plumaPreviewClassName}::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 999px;
  background: color-mix(in srgb, var(--text-muted) 34%, transparent);
  background-clip: content-box;
}

.${plumaPreviewClassName}::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--text-muted) 52%, transparent);
  background-clip: content-box;
}

.${plumaPreviewContentClassName} {
  min-height: 100%;
  width: var(--rich-editor-content-width);
  max-width: var(--rich-editor-content-width);
  margin: 0 auto;
  padding: var(--pluma-preview-content-padding);
  font-family: var(--font-ui);
}

.${plumaPreviewContentClassName} .cm-draftly-h1,
.${plumaPreviewContentClassName} .cm-draftly-h2,
.${plumaPreviewContentClassName} .cm-draftly-h3,
.${plumaPreviewContentClassName} .cm-draftly-h4,
.${plumaPreviewContentClassName} .cm-draftly-h5,
.${plumaPreviewContentClassName} .cm-draftly-h6,
.${plumaPreviewContentClassName} .cm-draftly-line-h1,
.${plumaPreviewContentClassName} .cm-draftly-line-h2,
.${plumaPreviewContentClassName} .cm-draftly-line-h3,
.${plumaPreviewContentClassName} .cm-draftly-line-h4,
.${plumaPreviewContentClassName} .cm-draftly-line-h5,
.${plumaPreviewContentClassName} .cm-draftly-line-h6 {
  font-family: var(--font-ui);
}

.${plumaPreviewContentClassName} .cm-draftly-code-header-right,
.${plumaPreviewContentClassName} .cm-draftly-code-copy-btn {
  display: none !important;
}

.${plumaPreviewContentClassName} .cm-draftly-task-checkbox.checked input::after {
  content: "";
  position: absolute;
  inset: 1px;
  background-color: currentColor;
  mask-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M20 6 9 17l-5-5%27/%3E%3C/svg%3E");
  mask-position: center;
  mask-repeat: no-repeat;
  mask-size: 100% 100%;
  -webkit-mask-image: url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 viewBox=%270 0 24 24%27 fill=%27none%27 stroke=%27currentColor%27 stroke-width=%273%27 stroke-linecap=%27round%27 stroke-linejoin=%27round%27%3E%3Cpath d=%27M20 6 9 17l-5-5%27/%3E%3C/svg%3E");
  -webkit-mask-position: center;
  -webkit-mask-repeat: no-repeat;
  -webkit-mask-size: 100% 100%;
}

.${plumaPreviewContentClassName} .cm-draftly-mermaid-rendered {
  width: 100%;
  min-height: 180px;
  padding: 16px 0;
  overflow: auto;
}

.${plumaPreviewContentClassName} .cm-draftly-mermaid-rendered svg {
  width: 100%;
  min-width: 520px;
  max-width: 100%;
  height: auto;
}

.${plumaPreviewContentClassName} a {
  cursor: pointer;
}`;
}
