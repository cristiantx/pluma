import type { DesktopWindowSession } from "../windows/DesktopWindowSession";
import { readPersistedSessionState } from "../persistence/appPersistence";

export async function restoreDesktopWindows(ports: {
  enabled: boolean;
  sessionStatePath: string;
  createWindow(): DesktopWindowSession;
}): Promise<void> {
  if (!ports.enabled) {
    ports.createWindow();
    return;
  }
  const state = await readPersistedSessionState(ports.sessionStatePath);
  if (!state || state.windows.length === 0) {
    ports.createWindow();
    return;
  }
  const sessions = state.windows.map(() => ports.createWindow());
  await Promise.all(
    sessions.map((session, index) =>
      session.restorePersistedState(state.windows[index]!)
    )
  );
  const active = sessions[state.activeWindowIndex] ?? sessions[0];
  if (active && !active.window.isDestroyed()) active.window.focus();
}
