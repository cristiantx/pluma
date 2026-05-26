# Agent Notes

- Pluma is a desktop app, not a website. Do not add responsive media queries or mobile breakpoint behavior to the desktop shell unless explicitly requested.
- Keep app UI density, fixed-pane structure, and desktop interaction patterns intact.
- Follow React component hygiene in renderer code:
  - One component per file.
  - Use named exports, not default exports.
  - Name component files with `PascalCase.tsx`.
  - Name hooks, view helpers, state modules, and other non-component files with `camelCase.ts`.
- Keep folder naming explicit and stable:
  - Use lowercase feature folders such as `components/shell`.
  - Colocate feature-local components, helpers, and tests when they primarily serve one surface.
  - Avoid vague buckets and dead files.
- Prefer semantic HTML and keyboard-safe controls:
  - Use real `button`, `nav`, `header`, `aside`, `section`, and `footer` elements.
  - Do not use clickable `div` elements for interactive controls.
- Keep renderer boundaries clean:
  - Shared presentation and view logic belong in renderer modules.
  - Electron-only windowing, dialogs, menus, preload, and IPC glue stay out of presentational components.
- Remove unused renderer dependencies and stale component files when replacing an approach.
