import { describe, expect, it } from "vitest";

import {
  createDocumentSession,
  markDocumentSessionExternalChange,
  markDocumentSessionSaving,
  shouldProtectDocumentSessionClose,
  updateDocumentSessionText
} from "../src/documentSession.js";

describe("document session save states", () => {
  it("marks clean sessions as externally changed without losing text", () => {
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/tmp/Notes.md"
      },
      metadata: {
        fileId: "1",
        mtimeMs: 10,
        size: 8
      },
      rawText: "# Notes\n"
    });

    expect(markDocumentSessionExternalChange(session)).toMatchObject({
      rawText: "# Notes\n",
      saveState: "external-change"
    });
  });

  it("marks dirty sessions as conflicts when disk changes externally", () => {
    const session = updateDocumentSessionText(
      createDocumentSession({
        location: {
          kind: "desktop-path",
          path: "/tmp/Notes.md"
        },
        metadata: {
          fileId: "1",
          mtimeMs: 10,
          size: 8
        },
        rawText: "# Notes\n"
      }),
      "# Mine\n"
    );

    expect(markDocumentSessionExternalChange(session)).toMatchObject({
      rawText: "# Mine\n",
      saveState: "conflict"
    });
  });

  it("protects documents that are not cleanly saved", () => {
    const session = createDocumentSession({
      location: {
        kind: "desktop-path",
        path: "/tmp/Notes.md"
      },
      metadata: {
        fileId: "1",
        mtimeMs: 10,
        size: 8
      },
      rawText: "# Notes\n"
    });

    expect(shouldProtectDocumentSessionClose(session)).toBe(false);
    expect(
      shouldProtectDocumentSessionClose(
        updateDocumentSessionText(session, "# Edited\n")
      )
    ).toBe(true);
    expect(
      shouldProtectDocumentSessionClose(markDocumentSessionSaving(session))
    ).toBe(true);
    expect(
      shouldProtectDocumentSessionClose(
        markDocumentSessionExternalChange(session)
      )
    ).toBe(true);
  });
});
