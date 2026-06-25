import type * as DraftlyPlugins from "draftly/plugins";

type DraftlyPluginsModule = typeof DraftlyPlugins;

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
    new TablePlugin(),
    new HTMLPlugin(),
    new ImagePlugin(),
    new MathPlugin(),
    new MermaidPlugin(),
    new CodePlugin(),
    new QuotePlugin(),
    new HRPlugin(),
    new EmojiPlugin()
  ];
}
