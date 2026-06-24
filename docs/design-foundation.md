# Pluma Design Foundation

## Direction

Pluma uses a desktop-first shell inspired by the information architecture of VS Code without copying its visual identity. The structure is:

- full-height workspace sidebar
- rounded central editor stage
- custom main title bar
- pill-style document tabs
- floating contextual editor controls

The visual tone should feel quiet, dense, and durable. It should read as a writing and editing tool rather than a browser dashboard or consumer notes app.

## Typography

- `--font-ui`: compact sans-serif for shell chrome, metadata, controls, file tree labels, and status text
- `--font-display`: serif for document-stage headings and editor-adjacent emphasis
- Uppercase metadata is reserved for shell labels, section headings, and status labels
- Primary text should stay compact and calm; editor-stage headings may be more expressive

## Color Tokens

Core semantic tokens live in [`packages/ui/src/styles/tokens.css`](../packages/ui/src/styles/tokens.css):

- app background: `--app-bg`
- shell regions: `--chrome-bg`, `--titlebar-bg`, `--sidebar-bg`, `--surface-bg`, `--editor-bg`, `--editor-source-bg`
- borders: `--border-subtle`, `--border-default`, `--border-strong`
- text: `--text-primary`, `--text-secondary`, `--text-muted`
- accents and states: `--accent`, `--accent-strong`, `--warning`, editor syntax tokens
- elevation and geometry: `--shadow-window`, `--radius-window`, `--radius-control`

Rules:

- Shell chrome stays lower-contrast than the editor stage.
- Accent usage should be sparse and structural.
- Warning and save-state colors are state tokens, not branding tokens.
- Light and dark themes must preserve density and hierarchy, not just invert colors.

## Density And Spacing

- Desktop density is the default; avoid oversized padding and mobile spacing
- Title bar height comes from `--titlebar-height` and currently resolves to `36px`
- Tab bar height comes from `--tabbar-height` and currently resolves to `36px`
- Shared shell spacing stays tight:
  - sidebar title strip padding is compact and aligned around native macOS traffic-light space
  - explorer row horizontal inset is `4px` per side
  - explorer row internal padding is `3px 8px`
  - explorer tree indentation starts at `12px` and steps by `22px` per depth level
- `--radius-control` is the shared control radius and currently resolves to `8px`; titlebar buttons, sidebar buttons, settings buttons, tab pills, and explorer rows should use it
- The central editor pane is rounded more strongly than controls (`15px`) and carries the main app elevation
- The status bar is intentionally absent; persistent editor controls should move into contextual floating affordances instead of a bottom strip

## Component Language

### Title Bar

- The main title bar belongs to the editor pane, not the full window shell
- In workspace mode, show only the workspace name; do not show a folder icon or full path
- The workspace title uses stronger weight than surrounding chrome
- When the sidebar is hidden, the restore-sidebar control appears in the main title bar near the native traffic-light zone
- Titlebar controls use background-only hover/focus states, no borders, and no sticky active fill

### Sidebar

- The sidebar spans the full app height, including the native titlebar area
- Sidebar title controls reserve space for native macOS traffic lights
- The Files/Search switch sits next to the traffic-light space; the sidebar close button sits at the far right
- The workspace label is not repeated inside the sidebar
- Compact explorer tree with clear active-row treatment
- Folder rows rely on the chevron as the primary structural cue; avoid separate folder icons in the tree body
- File rows keep a subtle file icon, but their text column should align with the folder text column
- Explorer rows are inset from the pane edge and hover as rounded rectangles rather than full-width strips
- The sidebar scrollbar should not reserve layout gutter space; row insets still remain visually intact
- Tree guide lines are depth-based and subtle; they should appear as hierarchy cues, not as a full background grid
- Settings lives as the persistent bottom action in the sidebar
- Tree rows should feel closer to an editor than a dashboard list

### Tabs

- The tab bar uses the same background as the editor stage
- Document tabs render as compact pills, not segmented full-height blocks
- Active light-mode tabs are darker than the editor background; active dark-mode tabs are lighter than the editor background
- Tab close buttons are absolutely positioned inside the pill so they do not affect tab width
- Close buttons are hidden until tab hover or direct keyboard focus, including on the active tab
- Close button backgrounds must be solid and match the pill state behind them

### Editor Stage

- The editor stage is the visual focal plane
- Document title, empty state, and important editor context live here
- Use the serif display system only where it reinforces document focus
- The editor pane parent owns the rounded clipping and pane shadow
- In dark mode, the editor pane keeps the dark drop shadow and adds a subtle light edge so the rounded boundary stays visible

### Inspector Rail

- Lightweight metadata and activity
- Should remain secondary to the editor stage

### Floating Editor Controls

- Source/Rich/Split mode controls live in a floating bottom-right island
- Floating controls should be compact, elevated, and visually separate from the editor content
- Do not reintroduce a persistent bottom status bar for these controls

## Interaction States

- Hover: subtle background reinforcement
- Focus: shared ring token `--focus-ring`
- Selected: active-row or active-control background
- Active: selected state plus stronger foreground hierarchy
- Disabled: reduced emphasis without reducing legibility
- Keyboard navigation must work across tree rows, tabs, title bar controls, settings controls, and floating editor controls

## Radix Styling Rules

- Radix primitives should inherit Pluma tokens rather than ship with a separate visual language
- Menus should feel like editor chrome, not floating consumer popovers
- Rounded corners stay restrained
- Shadows are reserved for elevated menus and dialog surfaces, not every panel

## Reference States

The shell should continue to support these reference states:

- empty state: no file or folder selected, shell layout still visible
- file-opened state: current file label visible in the editor stage
- folder/workspace state: explorer entries and workspace label visible in the title bar
- editor-mode state: Source/Rich switch visible as a floating editor control when a document tab is active
- sidebar-search state: sidebar title control flips between Search and Files while preserving the full-height shell structure

## Implementation Rules

- New renderer surfaces should consume semantic tokens before introducing new raw colors
- Layout changes should preserve the full-height sidebar / rounded editor pane / titlebar-inside-editor hierarchy
- Editor-specific theming work should map into this foundation rather than replacing it
- Avoid generic card-heavy dashboard patterns even when using Radix primitives
