export type CommandRoute =
  | "application"
  | "window"
  | "renderer"
  | "editor"
  | "native"
  | "tab"
  | "workspace";
export type CommandAvailability =
  | "always"
  | "hasActiveDocument"
  | "isDevelopment"
  | "canCloseAll"
  | "canCloseOthers"
  | "canCloseSavedTabs"
  | "canCopyPath"
  | "canRename"
  | "canRevealInWorkspace"
  | "canShowInFolder"
  | "canPaste"
  | "canFindInFolder";
export type CommandContext = Partial<
  Record<Exclude<CommandAvailability, "always">, boolean>
> & { autosaveEnabled?: boolean; spellcheckEnabled?: boolean };
export type CommandPayload =
  | "none"
  | "enabled"
  | "lineEnding"
  | "tab"
  | "workspace";
export type CommandShortcut = {
  key: string;
  modifiers: readonly ("Mod" | "Shift" | "Alt" | "Ctrl" | "Command")[];
};
export type CommandPlatform = "darwin" | "win32" | "linux";
export type CommandDefinition = {
  label: string;
  route: CommandRoute;
  availability: CommandAvailability;
  payload: CommandPayload;
  flush: boolean;
  palette: boolean;
  shortcut?: CommandShortcut;
  platformShortcuts?: Partial<Record<CommandPlatform, CommandShortcut>>;
  nativeRole?:
    | "undo"
    | "redo"
    | "cut"
    | "copy"
    | "paste"
    | "pasteAndMatchStyle"
    | "selectAll"
    | "startSpeaking"
    | "toggleDevTools"
    | "minimize"
    | "zoom"
    | "front"
    | "close"
    | "about"
    | "services"
    | "hide"
    | "hideOthers"
    | "unhide"
    | "quit";
  checkedSetting?: "autosaveEnabled" | "spellcheckEnabled";
};
export type PayloadFor<P extends CommandPayload> = P extends "enabled"
  ? { enabled: boolean }
  : P extends "lineEnding"
    ? { target: "lf" | "crlf" }
    : P extends "tab"
      ? { tabId: string; tabIds: string[] }
      : P extends "workspace"
        ? { path: string; kind: "file" | "folder" }
        : never;
