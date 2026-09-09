/** Shared semantic colors for Draftly's editor and static preview surfaces. */
export const draftlyThemeTokens = {
  "--draftly-font-sans": "var(--font-ui)",
  "--draftly-font-mono": "var(--font-editor)",
  "--draftly-color-text": "var(--text-secondary)",
  "--draftly-color-muted": "var(--text-muted)",
  "--draftly-color-link": "var(--accent)",
  "--draftly-color-link-hover": "var(--accent-strong)",
  "--draftly-color-success": "var(--string)",
  "--draftly-color-danger": "var(--warning)",
  "--draftly-color-border": "var(--border-default)",
  "--draftly-color-surface": "var(--editor-bg)",
  "--draftly-color-surface-raised": "var(--surface-bg)",
  "--draftly-surface-code": "var(--editor-source-bg)",
  "--draftly-surface-code-inline": "var(--border-subtle)",
  "--draftly-surface-code-header": "var(--surface-bg)",
  "--draftly-surface-code-caption": "var(--surface-bg)",
  "--draftly-surface-header": "var(--surface-bg)",
  "--draftly-surface-stripe": "var(--border-subtle)",
  "--draftly-surface-hover": "var(--active-row)",
  "--draftly-color-tooltip-bg": "var(--surface-bg)",
  "--draftly-color-tooltip-fg": "var(--text-primary)",
  "--draftly-shadow-popover": "var(--shadow-window)",
  "--draftly-tint-1": "color-mix(in srgb, var(--text-primary) 2%, transparent)",
  "--draftly-tint-2": "color-mix(in srgb, var(--text-primary) 3%, transparent)",
  "--draftly-tint-5":
    "color-mix(in srgb, var(--text-primary) 10%, transparent)",
  "--draftly-color-error-surface":
    "color-mix(in srgb, var(--warning) 10%, transparent)"
};
