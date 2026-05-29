# Markdown Analysis And Safety

Phase 4 establishes a conservative Markdown pipeline for deciding whether a
document can enter rich mode without risking source loss.

## Parser

Core Markdown parsing lives in `packages/core/src/markdownPipeline.ts` and uses:

- `remark-parse` for CommonMark parsing.
- `remark-gfm` for tables, task lists, strikethrough, autolinks, and footnotes.
- `remark-frontmatter` for YAML frontmatter.

## Rich-mode eligibility

Documents are `rich-safe` when every parsed mdast node is in Pluma's supported
set. Documents become `source-only` when they contain unsupported or unsafe
syntax.

HTML nodes are currently source-only. User-authored HTML can carry event
handlers, embedded media, scripts, or rendering semantics that a rich editor may
change or execute accidentally. Source mode preserves the original text.

## Round-trip guard

Rich-mode serialization runs through `mdast-util-to-markdown` with GFM and
frontmatter extensions. The result is compared with the original Markdown after
normalizing line endings and trailing newlines. If serialization changes the
document, Pluma keeps the original text and returns a fidelity warning.

## Preview safety evaluation

`dompurify` should be used before any user-authored Markdown is rendered as
HTML. Phase 4 does not render Markdown HTML, so DOMPurify is documented here as
a required preview dependency rather than installed into runtime code now.

`github-markdown-css` is a useful compatibility reference for preview defaults,
especially typography, table spacing, task list alignment, code blocks, and
blockquote treatment. Pluma should still map those defaults through its own
desktop design tokens instead of importing the stylesheet wholesale into the
desktop shell.
