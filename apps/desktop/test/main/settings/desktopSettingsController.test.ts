import { defaultAppSettings, type AppSettings } from "@pluma/ui/settings";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  DesktopSettingsController,
  type SettingsSession
} from "../../../src/main/settings/desktopSettingsController";

describe("DesktopSettingsController", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not commit or publish settings when writing fails", async () => {
    const session = createSession();
    const refreshMenu = vi.fn();
    const write = vi.fn().mockRejectedValue(new Error("disk full"));
    const controller = new DesktopSettingsController({
      getSessions: () => [session],
      refreshMenu,
      write
    });

    await expect(controller.update({ autosaveEnabled: false })).rejects.toThrow(
      "disk full"
    );

    expect(controller.getSnapshot()).toEqual(defaultAppSettings);
    expect(session.clearAutosaveTimers).not.toHaveBeenCalled();
    expect(session.emitSettingsChanged).not.toHaveBeenCalled();
    expect(refreshMenu).not.toHaveBeenCalled();
  });

  it("serializes mutations and recovers the queue after a rejected write", async () => {
    const firstWrite = deferred<void>();
    const write = vi
      .fn<(settings: AppSettings) => Promise<void>>()
      .mockReturnValueOnce(firstWrite.promise)
      .mockResolvedValueOnce();
    const controller = new DesktopSettingsController({
      getSessions: () => [],
      refreshMenu: vi.fn(),
      write
    });

    const failedUpdate = controller.update({ autosaveEnabled: false });
    const recoveredUpdate = controller.update({ spellcheckEnabled: false });
    await vi.waitFor(() => expect(write).toHaveBeenCalledTimes(1));
    expect(write).toHaveBeenCalledTimes(1);

    firstWrite.reject(new Error("write failed"));
    await expect(failedUpdate).rejects.toThrow("write failed");
    await expect(recoveredUpdate).resolves.toMatchObject({
      autosaveEnabled: true,
      spellcheckEnabled: false
    });

    expect(write).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().spellcheckEnabled).toBe(false);
  });

  it("applies autosave and spellcheck effects before broadcasting settings", async () => {
    const session = createSession();
    const refreshMenu = vi.fn();
    const controller = new DesktopSettingsController({
      getSessions: () => [session],
      refreshMenu,
      write: vi.fn().mockResolvedValue(undefined)
    });

    const settings = await controller.update({
      autosaveEnabled: false,
      spellcheckEnabled: false
    });

    expect(session.clearAutosaveTimers).toHaveBeenCalledOnce();
    expect(
      session.window.webContents.session.setSpellCheckerEnabled
    ).toHaveBeenCalledWith(false);
    expect(session.emitSettingsChanged).toHaveBeenCalledWith(settings);
    expect(refreshMenu).toHaveBeenCalledOnce();
    expect(
      session.clearAutosaveTimers.mock.invocationCallOrder[0]
    ).toBeLessThan(session.emitSettingsChanged.mock.invocationCallOrder[0]!);
  });
});

function createSession(): SettingsSession & {
  clearAutosaveTimers: ReturnType<typeof vi.fn>;
  emitSettingsChanged: ReturnType<typeof vi.fn>;
} {
  return {
    clearAutosaveTimers: vi.fn(),
    emitSettingsChanged: vi.fn(),
    emitStatus: vi.fn(),
    refreshSettingsSensitiveState: vi.fn().mockResolvedValue(undefined),
    window: {
      isDestroyed: vi.fn(() => false),
      webContents: {
        session: { setSpellCheckerEnabled: vi.fn() }
      }
    }
  };
}

function deferred<T>(): {
  promise: Promise<T>;
  reject: (reason: unknown) => void;
} {
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((_resolve, promiseReject) => {
    reject = promiseReject;
  });
  return { promise, reject };
}
