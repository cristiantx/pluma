# Pluma Markdown

Pluma Markdown is CommonMark with GitHub Flavored Markdown and YAML frontmatter.

Rich editing is available for documents that can round-trip through Pluma's
Markdown parser and formatter without losing source fidelity. Documents with
unsupported constructs, such as inline or block HTML, are preserved in source
mode.

## Supported Syntax

- CommonMark paragraphs, headings, links, images, blockquotes, lists, thematic
  breaks, inline code, and fenced code blocks.
- GitHub Flavored Markdown tables, task lists, strikethrough, autolinks, and
  footnotes.
- YAML frontmatter at the top of the document.

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
