import {
  isMeaningfulPersistedWindowState,
  writePersistedSessionState
} from "../persistence/appPersistence";
import type { DesktopWindowSession } from "../windows/DesktopWindowSession";

export class SessionStatePersistence {
  private requested = false;
  private running: Promise<void> | null = null;

  constructor(private readonly persist: () => Promise<void>) {}

  request(): Promise<void> {
    this.requested = true;
    this.running ??= this.drain().finally(() => {
      this.running = null;
    });

    return this.running;
  }

  private async drain(): Promise<void> {
    while (this.requested) {
      this.requested = false;
      await this.persist();
    }
  }
}

export async function writeDesktopSessionState(
  filePath: string,
  sessions: DesktopWindowSession[],
  latestSession: DesktopWindowSession | null
): Promise<void> {
  const meaningfulSessions = sessions.flatMap((windowSession) => {
    const state = windowSession.getPersistedState();

    return isMeaningfulPersistedWindowState(state)
      ? [{ state, windowSession }]
      : [];
  });
  const activeWindowIndex = Math.max(
    0,
    meaningfulSessions.findIndex(
      ({ windowSession }) => windowSession === latestSession
    )
  );

  await writePersistedSessionState(filePath, {
    activeWindowIndex,
    windows: meaningfulSessions.map(({ state }) => state)
  });
}
