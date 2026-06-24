# Markdown Analysis And Safety

Phase 4 establishes a conservative Markdown pipeline for deciding whether a
document should be constrained to source mode for product and safety reasons.

## Parser

Core Markdown parsing lives in `packages/core/src/markdownPipeline.ts` and uses:

- `remark-parse` for CommonMark parsing.
- `remark-gfm` for tables, task lists, strikethrough, autolinks, and footnotes.
- `remark-frontmatter` for YAML frontmatter.

The compatibility test suite imports the official CommonMark `0.31.2` examples
from `commonmark-spec`. Pluma parses every fixture as source input, keeps raw
HTML fixtures source-only when they produce HTML nodes, and compares selected
render-safe fixtures against the expected HTML.

## Mode constraints

Documents use `modeConstraint: "none"` by default because Draftly edits the
Markdown source text directly. Documents become `source-only` when they contain
syntax that Pluma intentionally keeps out of rich mode.

HTML nodes are currently source-only. User-authored HTML can carry event
handlers, embedded media, scripts, or rendering semantics that a rich editor may
change or execute accidentally. Source mode preserves the original text.

## Source preservation

The Markdown source text is the canonical document state in both rich and source
modes. Save writes the current source text after line-ending preparation rather
than serializing rich-mode state through a separate Markdown formatter.

## Preview safety evaluation

`dompurify` should be used before any user-authored Markdown is rendered as
HTML. Phase 4 does not render Markdown HTML, so DOMPurify is documented here as
a required preview dependency rather than installed into runtime code now.

`github-markdown-css` is a useful compatibility reference for preview defaults,
especially typography, table spacing, task list alignment, code blocks, and
blockquote treatment. Pluma should still map those defaults through its own
desktop design tokens instead of importing the stylesheet wholesale into the
desktop shell.
