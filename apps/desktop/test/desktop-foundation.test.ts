import { describe, expect, it } from "vitest";

import { createDesktopFoundation } from "../src/index.js";

describe("createDesktopFoundation", () => {
  it("tracks Phase 0 scaffolding", () => {
    expect(createDesktopFoundation().phase).toBe(0);
  });
});
