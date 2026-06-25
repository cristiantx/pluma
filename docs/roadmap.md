# Roadmap

Pluma is an alpha-stage local-first Markdown editor for macOS. The project is
usable for active development and testing, while editor workflows, packaging,
and platform support are still evolving.

## Current Focus

- Polish the macOS desktop writing flow.
- Keep Markdown files as normal files on disk.
- Preserve source fidelity across rich and source editing modes.
- Keep the Electron main process, renderer shell, editor integrations, and core
  Markdown logic is cleanly separated.
- Improve release confidence with repeatable validation and packaged-app checks.

## Near-Term Priorities

- Hardening save, autosave, close-protection, and file-watching behavior.
  - Prettier formatting consistency and UX
- Improving editor search, navigation, and writing ergonomics.
- Tightening Markdown export and rendering safety.
- Refining macOS packaging, signing, notarization, and release notes.
- Expanding contributor-facing tests around file workflows and editor behavior.

## Later Goals

- Windows and Linux desktop packaging.
- Browser-compatible surfaces that reuse the core document and Markdown logic.
- Additional Markdown rendering extensions when they can preserve source
  fidelity.
- Optional import, export, and clipboard workflows that do not compromise the
  local-first model.
