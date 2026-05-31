import { describe, expect, it } from "vitest";

import {
  createDocumentSession,
  markDocumentSessionExternalChange,
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
});
