import { beforeEach, describe, expect, it, vi } from "vitest";

const electron = vi.hoisted(() => {
  const windowHandlers = new Map<string, () => void>();
  const webContentsHandlers = new Map<string, () => void>();
  let isDestroyed = false;
  const webContents = {
    get id() {
      if (isDestroyed) {
        throw new TypeError("Object has been destroyed");
      }

      return 29;
    },
    on: vi.fn((event: string, handler: () => void) => {
      webContentsHandlers.set(event, handler);
    })
  };
  const window = {
    get id() {
      if (isDestroyed) {
        throw new TypeError("Object has been destroyed");
      }

      return 17;
    },
    get webContents() {
      if (isDestroyed) {
        throw new TypeError("Object has been destroyed");
      }

      return webContents;
    },
    loadFile: vi.fn(() => Promise.resolve()),
    loadURL: vi.fn(() => Promise.resolve()),
    on: vi.fn((event: string, handler: () => void) => {
      windowHandlers.set(event, handler);
    })
  };

  return {
    BrowserWindow: vi.fn(function BrowserWindow() {
      return window;
    }),
    destroy: () => {
      isDestroyed = true;
    },
    reset: () => {
      isDestroyed = false;
      windowHandlers.clear();
      webContentsHandlers.clear();
      window.loadFile.mockClear();
      window.loadURL.mockClear();
      window.on.mockClear();
      webContents.on.mockClear();
    },
    webContentsHandlers,
    window,
    windowHandlers
  };
});

vi.mock("electron", () => ({ BrowserWindow: electron.BrowserWindow }));

import { createMainWindow } from "../../../src/main/windows/createMainWindow";

describe("createMainWindow", () => {
  beforeEach(() => {
    electron.reset();
  });

  it("does not access a destroyed window while handling closed", () => {
    const onClosed = vi.fn();

    createMainWindow({
      appIconPath: "/app/icon.png",
      mainBundleDirectory: "/app/build",
      onClose: vi.fn(),
      onClosed,
      onLoaded: vi.fn(),
      rendererDevServerUrl: undefined,
      rendererName: "main_window",
      spellcheckEnabled: true
    });

    electron.destroy();

    expect(() => electron.windowHandlers.get("closed")?.()).not.toThrow();
    expect(onClosed).toHaveBeenCalledWith({
      webContentsId: 29,
      windowId: 17
    });
  });
});
