# Pluma Markdown

Pluma Markdown is CommonMark-compatible Markdown with GitHub Flavored Markdown
and YAML frontmatter.

Source mode accepts CommonMark input, GFM extensions, and YAML frontmatter.
Rich editing is available for documents that can round-trip through Pluma's
Markdown parser and formatter without losing source fidelity. Documents with
unsupported constructs, such as inline or block HTML, stay in source mode.

## Supported Syntax

- CommonMark paragraphs, headings, links, images, blockquotes, lists, thematic
  breaks, inline code, and fenced code blocks.
- GitHub Flavored Markdown tables, task lists, strikethrough, autolinks, and
  footnotes.
- YAML frontmatter at the top of the document.

## Support Tiers

| Construct                                                                                                                               | Source mode | Rich mode                      | Notes                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------- | ----------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| CommonMark paragraphs, headings, emphasis, strong text, links, images, blockquotes, lists, thematic breaks, code spans, and code blocks | Supported   | Supported when round-trip safe | Tested against the official CommonMark `0.31.2` fixture set.                                                 |
| GFM tables, task lists, strikethrough, autolinks, and footnotes                                                                         | Supported   | Supported when round-trip safe | Parsed with `remark-gfm`.                                                                                    |
| YAML frontmatter                                                                                                                        | Supported   | Supported when round-trip safe | Frontmatter is a Pluma extension, so leading `---` is interpreted as frontmatter when it forms a YAML block. |
| Inline and block HTML                                                                                                                   | Preserved   | Source-only                    | HTML can carry execution or rendering semantics that rich editing may change.                                |
| Unknown Markdown AST nodes                                                                                                              | Preserved   | Source-only                    | Pluma keeps the original source instead of serializing unsupported syntax.                                   |

## CommonMark Compatibility

Pluma uses the official CommonMark spec examples in automated tests. The tests
verify that every fixture parses as source input, that raw HTML fixtures are
kept out of rich mode when they parse as HTML nodes, and that representative
render-safe fixtures match expected HTML output.

Pluma does not claim pure CommonMark output for constructs where product policy
intentionally differs from the spec fixture HTML. The main intentional
differences are YAML frontmatter handling and sanitized HTML export.

## Canonical Formatting

Prettier owns automatic formatting for Pluma Markdown.

Pluma formats rich-mode output with:

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
