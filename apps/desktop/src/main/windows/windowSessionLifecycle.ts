import { type BrowserWindow } from "electron";
import {
  DesktopWindowSession,
  type DesktopWindowSessionDependencies
} from "./DesktopWindowSession";
import { createMainWindow } from "./createMainWindow";
import type { WindowSessionRegistry } from "./windowSessionRegistry";
import type { DesktopSettingsController } from "../settings/desktopSettingsController";
import type { DocumentTextFlushCoordinator } from "../ipc/documentTextFlushCoordinator";
import type { DesktopQuitCoordinator } from "../session/desktopQuitCoordinator";
import {
  shouldPersistAfterWindowClosed,
  shouldRouteWindowCloseThroughAppQuit
} from "../session/quitPersistence";
export type WindowLifecycleDependencies = {
  sessions: WindowSessionRegistry<DesktopWindowSession>;
  flushCoordinator: DocumentTextFlushCoordinator;
  quitCoordinator: DesktopQuitCoordinator<DesktopWindowSession>;
  settingsController: DesktopSettingsController;
  getOptions(): {
    mainBundleDirectory: string;
    rendererDevServerUrl: string | undefined;
    rendererName: string;
  };
  getAppIconPath(): string;
  getSessions(): DesktopWindowSession[];
  refreshMenu(): void;
  persistSession(): void;
  requestQuit(): Promise<void>;
  flushOpenTargets(): Promise<void>;
  createWindowDependencies(
    window: BrowserWindow,
    ready: () => Promise<void>
  ): DesktopWindowSessionDependencies;
  flushDocumentText(session: DesktopWindowSession): Promise<boolean>;
};
export function createWindowSessionLifecycle(
  dependencies: WindowLifecycleDependencies
) {
  const windowsAllowedToClose = new Set<number>();
  const closingWindows = new Map<number, Promise<void>>();
  function createWindow(): DesktopWindowSession {
    let markRendererReady: () => void = () => undefined;
    const rendererReady = new Promise<void>((resolve) => {
      markRendererReady = resolve;
    });
    const window = createMainWindow({
      appIconPath: dependencies.getAppIconPath(),
      mainBundleDirectory: dependencies.getOptions().mainBundleDirectory,
      rendererDevServerUrl: dependencies.getOptions().rendererDevServerUrl,
      rendererName: dependencies.getOptions().rendererName,
      spellcheckEnabled:
        dependencies.settingsController.getSnapshot().spellcheckEnabled,
      onClosed: ({ webContentsId, windowId }) => {
        markRendererReady();
        const session = dependencies.sessions.get(windowId);
        session?.dispose();
        dependencies.flushCoordinator.cancelSender(webContentsId);
        dependencies.sessions.remove(windowId);
        windowsAllowedToClose.delete(windowId);

        dependencies.refreshMenu();
        if (
          shouldPersistAfterWindowClosed(
            dependencies.quitCoordinator.isQuitting ||
              dependencies.quitCoordinator.isPending
          )
        ) {
          dependencies.persistSession();
        }
      },
      onClose: (event) => {
        if (
          dependencies.quitCoordinator.isPending &&
          !dependencies.quitCoordinator.isQuitting
        ) {
          event.preventDefault();
          return;
        }
        if (
          dependencies.quitCoordinator.isQuitting ||
          windowsAllowedToClose.has(window.id)
        ) {
          return;
        }

        if (
          shouldRouteWindowCloseThroughAppQuit({
            isQuitting: dependencies.quitCoordinator.isQuitting,
            isWindowAllowedToClose: windowsAllowedToClose.has(window.id),
            openWindowCount: dependencies.getSessions().length,
            platform: process.platform
          })
        ) {
          event.preventDefault();
          void dependencies.requestQuit();
          return;
        }

        event.preventDefault();
        void closeWindowAfterFlush(window.id);
      },
      onLoaded: () => {
        const session = dependencies.sessions.get(window.id);
        session?.emitInitialState();
        markRendererReady();
        void dependencies.flushOpenTargets();
      }
    });
    const session = new DesktopWindowSession(
      dependencies.createWindowDependencies(window, () => rendererReady)
    );

    dependencies.sessions.add(session);
    window.on("focus", () => {
      dependencies.sessions.markFocused(window.id);
      dependencies.refreshMenu();
    });

    return session;
  }
  async function performCloseWindow(windowId: number): Promise<void> {
    const session = dependencies.sessions.get(windowId);

    if (!session || session.window.isDestroyed()) {
      return;
    }

    if (!(await dependencies.flushDocumentText(session))) {
      return;
    }

    if (
      session.getProtectedDocuments().length > 0 &&
      !(await session.closeWindowWithProtection())
    ) {
      return;
    }

    if (session.window.isDestroyed()) return;
    windowsAllowedToClose.add(windowId);
    session.window.close();
  }
  function closeWindowAfterFlush(windowId: number): Promise<void> {
    const pending = closingWindows.get(windowId);
    if (pending) return pending;
    const closing = performCloseWindow(windowId).finally(() =>
      closingWindows.delete(windowId)
    );
    closingWindows.set(windowId, closing);
    return closing;
  }
  return { createWindow };
}
