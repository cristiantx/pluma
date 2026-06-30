import type { AppSettings } from "../settings.js";

export type SettingKey = keyof AppSettings;

type SettingsOption = {
  label: string;
  value: number | string;
};

type SettingsSelectField = {
  description: string;
  key: SettingKey;
  kind: "select";
  options: readonly SettingsOption[];
  title: string;
  valueType?: "number";
};

type SettingsCheckboxField = {
  description: string;
  key: SettingKey;
  kind: "checkbox";
  title: string;
};

export type SettingsFieldDefinition =
  | SettingsCheckboxField
  | SettingsSelectField;

export type SettingsSectionDefinition = {
  fields: readonly SettingsFieldDefinition[];
  id: string;
  title: string;
};

export type SettingsActionDefinition = {
  action: "openAppDataFolder" | "openSettingsFile" | "resetSettings";
  buttonLabel: string;
  description: string;
  title: string;
};

const widthOptions = [
  { label: "Narrow", value: "narrow" },
  { label: "Default", value: "default" },
  { label: "Wide", value: "wide" },
  { label: "Full", value: "full" }
] as const;

export const settingsSections: readonly SettingsSectionDefinition[] = [
  {
    fields: [
      {
        description: "Use the system theme or pin Pluma to light or dark.",
        key: "themePreference",
        kind: "select",
        options: [
          { label: "System", value: "system" },
          { label: "Light", value: "light" },
          { label: "Dark", value: "dark" }
        ],
        title: "Theme"
      }
    ],
    id: "settings-general",
    title: "General"
  },
  {
    fields: [
      {
        description: "Controls the maximum prose column width.",
        key: "richEditorWidth",
        kind: "select",
        options: widthOptions,
        title: "Rich editor width"
      },
      {
        description: "Controls the maximum Markdown source column width.",
        key: "sourceEditorWidth",
        kind: "select",
        options: widthOptions,
        title: "Source editor width"
      },
      {
        description: "Adjusts Markdown source text and gutters.",
        key: "sourceEditorFontSize",
        kind: "select",
        options: [12, 13, 14, 15, 16, 18].map((value) => ({
          label: `${value}px`,
          value
        })),
        title: "Source font size",
        valueType: "number"
      },
      {
        description: "Choose compact monospace or the app UI font.",
        key: "sourceEditorFontFamily",
        kind: "select",
        options: [
          { label: "Monospace", value: "mono" },
          { label: "System UI", value: "system" }
        ],
        title: "Source font family"
      },
      {
        description: "Use the app theme or pin source code colors.",
        key: "sourceEditorColorScheme",
        kind: "select",
        options: [
          { label: "Follow app theme", value: "follow-theme" },
          { label: "Pluma light", value: "pluma-light" },
          { label: "Pluma dark", value: "pluma-dark" }
        ],
        title: "Source color scheme"
      },
      {
        description: "Wrap long Markdown lines inside the source editor.",
        key: "sourceEditorWordWrap",
        kind: "checkbox",
        title: "Source word wrap"
      },
      {
        description: "Show line numbers in the source editor gutter.",
        key: "sourceEditorLineNumbers",
        kind: "checkbox",
        title: "Source line numbers"
      },
      {
        description: "Controls rendered tab width and indentation units.",
        key: "sourceEditorTabSize",
        kind: "select",
        options: [
          { label: "2 spaces", value: 2 },
          { label: "4 spaces", value: 4 }
        ],
        title: "Source tab size",
        valueType: "number"
      },
      {
        description: "Compact mode reduces prose padding and vertical rhythm.",
        key: "richEditorDensity",
        kind: "select",
        options: [
          { label: "Comfortable", value: "comfortable" },
          { label: "Compact", value: "compact" }
        ],
        title: "Rich editor density"
      }
    ],
    id: "settings-editor",
    title: "Editor"
  },
  {
    fields: [
      {
        description: "Save dirty desktop files after a short pause.",
        key: "autosaveEnabled",
        kind: "checkbox",
        title: "Auto Save"
      },
      {
        description: "Applies to rich and source editor text surfaces.",
        key: "spellcheckEnabled",
        kind: "checkbox",
        title: "Check spelling while typing"
      },
      {
        description: "Reopen prior windows, tabs, and workspace on launch.",
        key: "restorePreviousSession",
        kind: "checkbox",
        title: "Restore previous session"
      },
      {
        description: "Open HTML or PDF exports after they are written.",
        key: "openExportedFile",
        kind: "checkbox",
        title: "Open exported file"
      },
      {
        description: "Used for new files; existing files keep their format.",
        key: "defaultLineEnding",
        kind: "select",
        options: [
          { label: "System default", value: "system" },
          { label: "LF", value: "lf" },
          { label: "CRLF", value: "crlf" }
        ],
        title: "Default line ending"
      }
    ],
    id: "settings-files",
    title: "Files And Saving"
  },
  {
    fields: [
      {
        description: "Include dotfiles and dotfolders in the workspace tree.",
        key: "workspaceShowHiddenFiles",
        kind: "checkbox",
        title: "Show hidden files"
      },
      {
        description:
          "Hide files and folders matched by workspace .gitignore files.",
        key: "workspaceRespectGitIgnore",
        kind: "checkbox",
        title: "Hide Git-ignored files"
      }
    ],
    id: "settings-workspace",
    title: "Workspace"
  }
];

export const settingsActions: readonly SettingsActionDefinition[] = [
  {
    action: "openSettingsFile",
    buttonLabel: "Open Settings File",
    description: "Open the persisted JSON settings file.",
    title: "Settings file"
  },
  {
    action: "openAppDataFolder",
    buttonLabel: "Open App Data",
    description: "Open Pluma's application support folder.",
    title: "App data"
  },
  {
    action: "resetSettings",
    buttonLabel: "Reset Settings",
    description: "Restore Pluma's default settings.",
    title: "Reset settings"
  }
];
