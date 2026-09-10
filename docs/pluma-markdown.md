# Pluma Markdown

Pluma Markdown is CommonMark-compatible Markdown with GitHub Flavored Markdown and YAML frontmatter.

Source mode accepts CommonMark input, GFM extensions, and YAML frontmatter.
Rich editing and Preview are available unless capability analysis finds inline
or block HTML. HTML documents stay in source mode because rich rendering could
change their semantics. The source text remains canonical.

## Supported Syntax

- CommonMark paragraphs, headings, links, images, blockquotes, lists, thematic
  breaks, inline code, and fenced code blocks.
- GitHub Flavored Markdown tables, task lists, strikethrough, autolinks, and
  footnotes.
- YAML frontmatter at the top of the document.

## Support Tiers

| Construct                                                                                                                               | Source mode | Rich mode   | Notes                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ----------- | ------------------------------------------------------------------------------------------------------------ |
| CommonMark paragraphs, headings, emphasis, strong text, links, images, blockquotes, lists, thematic breaks, code spans, and code blocks | Supported   | Supported   | Tested against the official CommonMark `0.31.2` fixture set.                                                 |
| GFM tables, task lists, strikethrough, autolinks, and footnotes                                                                         | Supported   | Supported   | Parsed with `remark-gfm`.                                                                                    |
| YAML frontmatter                                                                                                                        | Supported   | Supported   | Frontmatter is a Pluma extension, so leading `---` is interpreted as frontmatter when it forms a YAML block. |
| Inline and block HTML                                                                                                                   | Preserved   | Source-only | HTML can carry execution or rendering semantics that rich editing may change.                                |

## CommonMark Compatibility

Pluma uses the official CommonMark spec examples in automated tests. The tests
verify that every fixture parses as source input, that raw HTML fixtures are
kept out of rich mode when they parse as HTML nodes, and that representative
render-safe fixtures match expected HTML output.

Pluma does not claim pure CommonMark output for constructs where product policy
intentionally differs from the spec fixture HTML. The main intentional
differences are YAML frontmatter handling and sanitized HTML export.

## Rendering Safety

Markdown source text is the canonical document state in both rich and source
modes. Save writes the current source text after line-ending preparation rather
than serializing rich-mode state through a separate document format.

HTML nodes are source-only. User-authored HTML can carry event handlers,
embedded media, scripts, or rendering semantics that a rich editor may change or
execute accidentally. Source mode preserves the original text.

Preview is shipped through Draftly's preview runtime. It escapes unhandled raw
HTML and protects URL resolution while using Pluma's desktop design tokens.
HTML export is a separate core pipeline and sanitizes generated output with
`rehype-sanitize`.

## Canonical Formatting

Pluma includes a Prettier-based Markdown formatter utility, but production UI
does not currently call it. Formatting remains an unwired capability rather
than an automatic rich-mode behavior.

The utility formats with:

- `parser: "markdown"`
- `proseWrap: "preserve"`
- line endings normalized to LF

Pluma also preserves these source conventions:

- unordered lists and task lists use dash markers
- task lists stay tight unless the user creates multi-paragraph items
- code blocks use fenced code blocks
- GFM tables remain valid Markdown tables
- YAML frontmatter remains at the top of the document

Source-mode typing is not formatted automatically. Source formatting should be
an explicit command or setting so users do not lose control while editing raw
Markdown.

## Linting

markdownlint is the diagnostics and CI policy layer. It can report style drift
and safe fixable issues, but it is not Pluma's canonical formatter.
