import { describe, expect, it } from "vitest";

import {
  applyLineEnding,
  detectLineEnding,
  formatLineEndingLabel,
  resolveDefaultLineEnding
} from "../src/lineEndings.js";

describe("line ending helpers", () => {
  it("detects common line ending styles", () => {
    expect(detectLineEnding("one\ntwo\n")).toBe("lf");
    expect(detectLineEnding("one\r\ntwo\r\n")).toBe("crlf");
    expect(detectLineEnding("one\r\ntwo\n")).toBe("mixed");
    expect(detectLineEnding("one")).toBe("none");
  });

  it("applies writable line endings", () => {
    expect(applyLineEnding("one\r\ntwo\n", "lf")).toBe("one\ntwo\n");
    expect(applyLineEnding("one\ntwo\n", "crlf")).toBe("one\r\ntwo\r\n");
  });

  it("resolves system defaults from the platform", () => {
    expect(resolveDefaultLineEnding("system", "win32")).toBe("crlf");
    expect(resolveDefaultLineEnding("system", "darwin")).toBe("lf");
    expect(resolveDefaultLineEnding("lf", "win32")).toBe("lf");
  });

  it("formats status labels", () => {
    expect(formatLineEndingLabel("lf")).toBe("LF");
    expect(formatLineEndingLabel("crlf")).toBe("CRLF");
    expect(formatLineEndingLabel("mixed")).toBe("Mixed");
    expect(formatLineEndingLabel("none")).toBe("--");
  });
});
