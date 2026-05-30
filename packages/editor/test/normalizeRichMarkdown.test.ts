import { describe, expect, it } from "vitest";

import { normalizeRichMarkdown } from "../src/normalizeRichMarkdown.js";

describe("normalizeRichMarkdown", () => {
  it("keeps tight bullet lists tight after rich editor serialization", () => {
    expect(normalizeRichMarkdown("- One\n\n- Two\n\n- Three\n")).toBe(
      "- One\n- Two\n- Three\n"
    );
  });

  it("keeps task-list markers as dash bullets", () => {
    expect(normalizeRichMarkdown("* [ ] One\n\n* [x] Two\n")).toBe(
      "- [ ] One\n- [x] Two\n"
    );
  });

  it("keeps tight ordered lists tight after rich editor serialization", () => {
    expect(normalizeRichMarkdown("1. One\n\n2. Two\n\n3. Three\n")).toBe(
      "1. One\n2. Two\n3. Three\n"
    );
  });

  it("does not collapse multi-paragraph list items", () => {
    expect(
      normalizeRichMarkdown("- One\n\n  Continued paragraph\n\n- Two\n")
    ).toBe("- One\n\n  Continued paragraph\n\n- Two\n");
  });
});
