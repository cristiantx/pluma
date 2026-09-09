import type * as DraftlyPlugins from "draftly/plugins";

import type * as DraftlyEmoji from "draftly/plugins/emoji";
import type * as DraftlyMath from "draftly/plugins/math";
import type * as DraftlyMermaid from "draftly/plugins/mermaid";

export type DraftlyPluginsModule = Pick<
  typeof DraftlyPlugins,
  | "CodePlugin"
  | "HRPlugin"
  | "HTMLPlugin"
  | "HeadingPlugin"
  | "ImagePlugin"
  | "InlinePlugin"
  | "LinkPlugin"
  | "ListPlugin"
  | "ParagraphPlugin"
  | "QuotePlugin"
  | "TablePlugin"
> &
  Pick<typeof DraftlyEmoji, "EmojiPlugin"> &
  Pick<typeof DraftlyMath, "MathPlugin"> &
  Pick<typeof DraftlyMermaid, "MermaidPlugin">;

let pluginsModulePromise: Promise<DraftlyPluginsModule> | null = null;

export function loadDraftlyPlugins(): Promise<DraftlyPluginsModule> {
  pluginsModulePromise ??= Promise.all([
    import("draftly/plugins"),
    import("draftly/plugins/emoji"),
    import("draftly/plugins/math"),
    import("draftly/plugins/mermaid"),
    import("./draftlyMathStyles.js")
  ]).then(([plugins, { EmojiPlugin }, { MathPlugin }, { MermaidPlugin }]) => ({
    ...plugins,
    EmojiPlugin,
    MathPlugin,
    MermaidPlugin
  }));
  return pluginsModulePromise;
}

export function createDraftlyPlugins({
  CodePlugin,
  EmojiPlugin,
  HRPlugin,
  HTMLPlugin,
  HeadingPlugin,
  ImagePlugin,
  InlinePlugin,
  LinkPlugin,
  ListPlugin,
  MathPlugin,
  MermaidPlugin,
  ParagraphPlugin,
  QuotePlugin,
  TablePlugin
}: DraftlyPluginsModule) {
  return [
    new ParagraphPlugin(),
    new HeadingPlugin(),
    new InlinePlugin(),
    new LinkPlugin(),
    new ListPlugin(),
    new TablePlugin({ normalizeOnOpen: false, normalizeOnChange: false }),
    new HTMLPlugin(),
    new ImagePlugin(),
    new MathPlugin(),
    new MermaidPlugin({ activation: "caret" }),
    new CodePlugin(),
    new QuotePlugin(),
    new HRPlugin(),
    new EmojiPlugin()
  ];
}
