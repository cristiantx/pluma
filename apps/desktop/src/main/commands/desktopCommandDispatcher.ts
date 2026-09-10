import {
  commandRegistry,
  getCommandState,
  parseCommandRequest,
  type CommandRequest,
  type ShellCommandId
} from "@pluma/commands";

export type DesktopCommandSession = {
  window: {
    isDestroyed(): boolean;
    webContents: { reload(): void; reloadIgnoringCache(): void };
  };
  hasActiveDocument(): boolean;
  getCommandDocumentId(): string | null;
  handleCommand(command: ShellCommandId): Promise<void>;
  convertActiveDocumentLineEndings(target: "lf" | "crlf"): void;
};
export type DesktopCommandOrigin =
  | { kind: "menu" }
  | { kind: "renderer"; session: DesktopCommandSession | null };
export type DesktopCommandDispatcherDependencies = {
  isDevelopment: boolean;
  getFocusedSession(): DesktopCommandSession | null;
  createWindow(): DesktopCommandSession;
  flushSession(session: DesktopCommandSession): Promise<boolean>;
  setAutosaveEnabled(enabled: boolean): Promise<void>;
  setSpellcheckEnabled(enabled: boolean): Promise<void>;
};

export function createDesktopCommandDispatcher(
  dependencies: DesktopCommandDispatcherDependencies
) {
  return async function dispatchCommand(
    value: unknown,
    origin: DesktopCommandOrigin
  ): Promise<void> {
    const request = parseCommandRequest(value);
    if (!request) return;
    const definition = commandRegistry[request.id];
    if (
      definition.route === "native" ||
      definition.route === "editor" ||
      definition.route === "tab" ||
      definition.route === "workspace"
    )
      return;
    // Renderer authority comes from its IPC sender, even for application actions.
    if (
      origin.kind === "renderer" &&
      (!origin.session || origin.session.window.isDestroyed())
    )
      return;
    if (request.id === "new-window") {
      dependencies.createWindow();
      return;
    }
    if (request.id === "set-autosave-enabled") {
      await dependencies.setAutosaveEnabled(request.args.enabled);
      return;
    }
    if (request.id === "set-spellcheck-enabled") {
      await dependencies.setSpellcheckEnabled(request.args.enabled);
      return;
    }
    const session =
      origin.kind === "renderer"
        ? origin.session
        : (dependencies.getFocusedSession() ?? dependencies.createWindow());
    if (!session || session.window.isDestroyed()) return;
    const documentId = session.getCommandDocumentId();
    const enabled = () =>
      getCommandState(request.id, {
        hasActiveDocument: session.hasActiveDocument(),
        isDevelopment: dependencies.isDevelopment
      }).enabled;
    if (!enabled()) return;
    if (
      origin.kind === "menu" &&
      definition.flush &&
      !(await dependencies.flushSession(session))
    )
      return;
    if (session.window.isDestroyed() || !enabled()) return;
    if (
      definition.availability === "hasActiveDocument" &&
      session.getCommandDocumentId() !== documentId
    )
      return;
    await executeSessionCommand(session, request);
  };
}

async function executeSessionCommand(
  session: DesktopCommandSession,
  request: CommandRequest
): Promise<void> {
  switch (request.id) {
    case "reload-window":
      session.window.webContents.reload();
      return;
    case "force-reload-window":
      session.window.webContents.reloadIgnoringCache();
      return;
    case "convert-line-endings":
      session.convertActiveDocumentLineEndings(request.args.target);
      return;
  }
  const definition = commandRegistry[request.id];
  if (
    (definition.route === "window" || definition.route === "renderer") &&
    definition.payload === "none"
  ) {
    await session.handleCommand(request.id as ShellCommandId);
  }
}
