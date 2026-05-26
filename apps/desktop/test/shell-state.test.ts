import { describe, expect, it } from "vitest";

import {
  appendActivity,
  initialShellState,
  reduceShellEvent
} from "../src/shell-state";

describe("appendActivity", () => {
  it("caps the activity feed to six items", () => {
    const result = ["a", "b", "c", "d", "e", "f"].reduce(
      (activity, message) => appendActivity(activity, message),
      [] as string[]
    );

    expect(appendActivity(result, "g")).toEqual(["g", "f", "e", "d", "c", "b"]);
  });
});

describe("reduceShellEvent", () => {
  it("updates the current mode when the renderer receives a mode event", () => {
    expect(
      reduceShellEvent(initialShellState, {
        type: "mode-changed",
        mode: "source"
      })
    ).toMatchObject({
      mode: "source",
      status: "Editor mode switched to source."
    });
  });
});
