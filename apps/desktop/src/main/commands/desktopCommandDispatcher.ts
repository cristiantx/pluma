import {
  commandRegistry,
  commandExecuted,
  parseCommandInvocation,
  type CommandContext,
  type CommandExecutionResult,
  type CommandInvocationContext,
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
  handleContextCommand(
    request: Extract<
      CommandRequest,
      { id: `tab-${string}` | `workspace-${string}` }
    >
  ): Promise<void>;
  hasActiveDocument(): boolean;
  getCommandDocumentId(): string | null;
  isQuickAccessOpen?(): boolean;
  getCommandContext?(): CommandContext;
  getInvocationContext?(): CommandInvocationContext;
  handleCommand(
    command: ShellCommandId
  ): Promise<void | CommandExecutionResult>;
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
  ): Promise<CommandExecutionResult> {
    const invocation = parseCommandInvocation(value);
    const request = invocation?.request ?? parseCommandRequest(value);
    const unavailable = (): CommandExecutionResult => ({
      status: "unavailable",
      reason: "The command is no longer available in this context."
    });
    if (!request) return unavailable();
    const definition = commandRegistry[request.id];
    if (definition.route === "native" || definition.route === "editor")
      return unavailable();
    // Renderer authority comes from its IPC sender, even for application actions.
    if (
      origin.kind === "renderer" &&
      (!origin.session || origin.session.window.isDestroyed())
    )
      return unavailable();
    if (request.id === "new-window") {
      dependencies.createWindow();
      return commandExecuted;
    }
    if (request.id === "set-autosave-enabled") {
      await dependencies.setAutosaveEnabled(request.args.enabled);
      return commandExecuted;
    }
    if (request.id === "set-spellcheck-enabled") {
      await dependencies.setSpellcheckEnabled(request.args.enabled);
      return commandExecuted;
    }
    const session =
      origin.kind === "renderer"
        ? origin.session
        : (dependencies.getFocusedSession() ?? dependencies.createWindow());
    if (!session || session.window.isDestroyed()) return unavailable();
    if (
      origin.kind === "menu" &&
      session.isQuickAccessOpen?.() &&
      request.id !== "quick-open" &&
      request.id !== "command-palette"
    )
      return unavailable();
    const contextMatches = () => {
      if (!invocation) return true;
      const current = session.getInvocationContext?.();
      return (
        current?.activeTabId === invocation.context.activeTabId &&
        current?.documentId === invocation.context.documentId &&
        current?.workspaceGeneration === invocation.context.workspaceGeneration
      );
    };
    if (!contextMatches()) return unavailable();
    if (definition.route === "tab" || definition.route === "workspace") {
      if (origin.kind === "menu" && !(await dependencies.flushSession(session)))
        return unavailable();
      if (!session.window.isDestroyed())
        await session.handleContextCommand(
          request as Extract<
            CommandRequest,
            { id: `tab-${string}` | `workspace-${string}` }
          >
        );
      return unavailable();
    }
    const documentId = session.getCommandDocumentId();
    const enabled = () =>
      getCommandState(request.id, {
        ...session.getCommandContext?.(),
        hasActiveDocument: session.hasActiveDocument(),
        isDevelopment: dependencies.isDevelopment
      }).enabled;
    if (!enabled()) return unavailable();
    if (
      origin.kind === "menu" &&
      definition.flush &&
      !(await dependencies.flushSession(session))
    )
      return unavailable();
    if (session.window.isDestroyed() || !enabled() || !contextMatches())
      return unavailable();
    if (
      definition.availability !== "always" &&
      definition.availability !== "isDevelopment" &&
      session.getCommandDocumentId() !== documentId
    )
      return unavailable();
    return (await executeSessionCommand(session, request)) ?? commandExecuted;
  };
}

async function executeSessionCommand(
  session: DesktopCommandSession,
  request: CommandRequest
): Promise<void | CommandExecutionResult> {
  switch (request.id) {
    case "reload-window":
      session.window.webContents.reload();
      return commandExecuted;
    case "force-reload-window":
      session.window.webContents.reloadIgnoringCache();
      return commandExecuted;
    case "convert-line-endings":
      session.convertActiveDocumentLineEndings(request.args.target);
      return commandExecuted;
  }
  const definition = commandRegistry[request.id];
  if (
    (definition.route === "window" || definition.route === "renderer") &&
    definition.payload === "none"
  ) {
    return session.handleCommand(request.id as ShellCommandId);
  }
}
