# Pluma Design Foundation

## Direction

Pluma uses a desktop-first shell inspired by the information architecture of VS Code without copying its visual identity. The structure is:

- custom title bar
- workspace sidebar
- central editor stage
- contextual inspector rail
- bottom status bar

The visual tone should feel quiet, dense, and durable. It should read as a writing and editing tool rather than a browser dashboard or consumer notes app.

## Typography

- `--font-ui`: compact sans-serif for shell chrome, metadata, controls, file tree labels, and status text
- `--font-display`: serif for document-stage headings and editor-adjacent emphasis
- Uppercase metadata is reserved for shell labels, section headings, and status labels
- Primary text should stay compact and calm; editor-stage headings may be more expressive

## Color Tokens

Core semantic tokens live in [`apps/desktop/src/index.css`](../apps/desktop/src/index.css):

- app backgrounds: `--app-bg`, `--app-bg-raised`
- shell regions: `--titlebar-bg`, `--sidebar-bg`, `--editor-bg`, `--statusbar-bg`
- surfaces: `--panel-bg`, `--panel-strong`, `--panel-elevated`
- borders: `--border-subtle`, `--border-default`, `--border-strong`
- text: `--text-primary`, `--text-secondary`, `--text-muted`
- accents and states: `--accent`, `--accent-soft`, `--warning`, `--status-save`

Rules:

- Shell chrome stays lower-contrast than the editor stage.
- Accent usage should be sparse and structural.
- Warning and save-state colors are state tokens, not branding tokens.
- Light and dark themes must preserve density and hierarchy, not just invert colors.

## Density And Spacing

- Desktop density is the default; avoid oversized padding and mobile spacing
- Title bar height: `54px`
- Status bar height: `34px`
- Primary spacing scale:
  - `--space-1`: `4px`
  - `--space-2`: `8px`
  - `--space-3`: `12px`
  - `--space-4`: `16px`
  - `--space-5`: `20px`
  - `--space-6`: `24px`
- Default surface radius is restrained: `10px` controls, `18px` panels

## Component Language

### Title Bar

- Left: app identity and current workspace
- Center: high-frequency file commands
- Right: theme/menu utilities and shell-level actions

### Sidebar

- Compact explorer tree with clear active-row treatment
- Secondary sections may show outline, warnings, or workspace metadata
- Tree rows should feel closer to an editor than a dashboard list

### Editor Stage

- The editor stage is the visual focal plane
- Document title, empty state, and important editor context live here
- Use the serif display system only where it reinforces document focus

### Inspector Rail

- Lightweight metadata and activity
- Should remain secondary to the editor stage

### Status Bar

- Metrics-first, not decorative
- Initial metric model:
  - word count
  - line count
  - mode
  - save state
- Future additions can include selection, encoding, line ending, and diagnostics if useful

## Interaction States

- Hover: subtle background or border reinforcement
- Focus: shared ring token `--focus-ring`
- Selected: accent-soft background
- Active: selected state plus stronger foreground hierarchy
- Disabled: reduced emphasis without reducing legibility
- Keyboard navigation must work across tree rows, menus, title bar controls, and status affordances

## Radix Styling Rules

- Radix primitives should inherit Pluma tokens rather than ship with a separate visual language
- Menus should feel like editor chrome, not floating consumer popovers
- Rounded corners stay restrained
- Shadows are reserved for elevated menus and dialog surfaces, not every panel

## Reference States

Phase 1.1 establishes these reference states in the shell:

- empty state: no file or folder selected, shell layout still visible
- file-opened state: current file label visible in the editor stage
- folder/workspace state: explorer entries and workspace label visible in the title bar
- warning/status state: bottom status bar reserved for save and metrics feedback

## Implementation Rules

- New renderer surfaces should consume semantic tokens before introducing new raw colors
- Layout changes should preserve the title bar / sidebar / editor stage / status bar hierarchy
- Editor-specific theming work in later phases should map into this foundation rather than replacing it
- Avoid generic card-heavy dashboard patterns even when using Radix primitives
