import { describe, expect, it } from "vitest";

import { getRichLinkTargetAction } from "../src/shell/richLinkTargets.js";

const activeDocumentPath = "/Users/me/Workspace/docs/current.md";
const workspacePath = "/Users/me/Workspace";

describe("getRichLinkTargetAction", () => {
  it("routes web URLs to the external browser", () => {
    expect(
      getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl: "https://example.com/docs",
        workspacePath
      })
    ).toEqual({
      kind: "external-url",
      url: "https://example.com/docs"
    });

    expect(
      getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl: "www.example.com/docs",
        workspacePath
      })
    ).toEqual({
      kind: "external-url",
      url: "https://www.example.com/docs"
    });
  });

  it("resolves relative workspace markdown links", () => {
    expect(
      getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl: "../guide.md#Install",
        workspacePath
      })
    ).toEqual({
      filePath: "/Users/me/Workspace/guide.md",
      fragment: "Install",
      kind: "workspace-markdown"
    });
  });

  it("resolves root-relative links from the workspace root", () => {
    expect(
      getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl: "/docs/guide.markdown",
        workspacePath
      })
    ).toEqual({
      filePath: "/Users/me/Workspace/docs/guide.markdown",
      fragment: null,
      kind: "workspace-markdown"
    });
  });

  it("rejects local links outside the workspace or without markdown extensions", () => {
    expect(
      getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl: "../../outside.md",
        workspacePath
      })
    ).toEqual({ kind: "ignored" });

    expect(
      getRichLinkTargetAction({
        activeDocumentPath,
        linkUrl: "./image.png",
        workspacePath
      })
    ).toEqual({ kind: "ignored" });
  });
});
