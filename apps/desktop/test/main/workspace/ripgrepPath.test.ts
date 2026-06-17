import { describe, expect, it } from "vitest";

import { getPackagedRipgrepPath } from "../../../src/main/workspace/ripgrepPath";

describe("getPackagedRipgrepPath", () => {
  it("uses the copied resource binary path on macOS and Linux", () => {
    expect(getPackagedRipgrepPath("/Applications/Pluma/Resources", "darwin")).toBe(
      "/Applications/Pluma/Resources/bin/rg"
    );
    expect(getPackagedRipgrepPath("/opt/pluma/resources", "linux")).toBe(
      "/opt/pluma/resources/bin/rg"
    );
  });

  it("uses the Windows ripgrep executable name", () => {
    expect(getPackagedRipgrepPath("C:\\Pluma\\resources", "win32")).toBe(
      "C:\\Pluma\\resources\\bin\\rg.exe"
    );
  });
});
