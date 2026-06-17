import { describe, expect, it } from "vitest";

import {
  shouldPersistAfterWindowClosed,
  shouldRouteWindowCloseThroughAppQuit
} from "../../../src/main/session/quitPersistence";

describe("quit persistence decisions", () => {
  it("routes the last non-macOS window close through app quit persistence", () => {
    expect(
      shouldRouteWindowCloseThroughAppQuit({
        isQuitting: false,
        isWindowAllowedToClose: false,
        openWindowCount: 1,
        platform: "win32"
      })
    ).toBe(true);
  });

  it("does not route normal macOS window closes through app quit", () => {
    expect(
      shouldRouteWindowCloseThroughAppQuit({
        isQuitting: false,
        isWindowAllowedToClose: false,
        openWindowCount: 1,
        platform: "darwin"
      })
    ).toBe(false);
  });

  it("does not persist an empty session after shutdown has started", () => {
    expect(shouldPersistAfterWindowClosed(true)).toBe(false);
    expect(shouldPersistAfterWindowClosed(false)).toBe(true);
  });
});
