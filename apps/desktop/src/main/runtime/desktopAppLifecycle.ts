import { app, BrowserWindow } from "electron";
import type { DesktopWindowSession } from "../windows/DesktopWindowSession";
import type { WindowSessionRegistry } from "../windows/windowSessionRegistry";
import type { DesktopQuitCoordinator } from "../session/desktopQuitCoordinator";
import { normalizeOpenTargets } from "./openTargetQueue";

export type DesktopAppLifecyclePorts = {
  sessions: WindowSessionRegistry<DesktopWindowSession>;
  quitCoordinator: DesktopQuitCoordinator<DesktopWindowSession>;
  createWindow(): DesktopWindowSession;
  getLatestSession(): DesktopWindowSession | null;
  queueOpenTargets(targets: string[]): void;
  flushOpenTargets(): Promise<void>;
  onReady(): Promise<void>;
  onWillQuit(): void;
};

export function registerDesktopAppLifecycle(
  ports: DesktopAppLifecyclePorts
): void {
  app.whenReady().then(async () => {
    await ports.onReady();
    ports.queueOpenTargets(normalizeOpenTargets(process.argv.slice(1)));
    void ports.flushOpenTargets();
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) ports.createWindow();
    });
  });
  app.on("open-file", (event, filePath) => {
    event.preventDefault();
    ports.queueOpenTargets([filePath]);
    if (app.isReady()) void ports.flushOpenTargets();
  });
  app.on("second-instance", (_event, argv) => {
    const session = ports.getLatestSession();
    if (session) {
      if (session.window.isMinimized()) session.window.restore();
      session.window.focus();
    }
    ports.queueOpenTargets(normalizeOpenTargets(argv));
    if (app.isReady()) void ports.flushOpenTargets();
  });
  app.on("before-quit", (event) => {
    if (ports.quitCoordinator.isQuitting) return;
    event.preventDefault();
    void ports.quitCoordinator.request();
  });
  app.on("window-all-closed", () => {
    for (const session of ports.sessions.values()) session.dispose();
    ports.sessions.clear();
    if (process.platform !== "darwin") app.quit();
  });
  app.on("will-quit", ports.onWillQuit);
}
