import { describe, expect, it } from "vitest";

import { projectInfo } from "../src/index.js";

describe("projectInfo", () => {
  it("marks the project as local-first", () => {
    expect(projectInfo.localFirst).toBe(true);
  });
});
