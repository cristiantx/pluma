import { createDocumentSession, type DocumentSession } from "@pluma/core";
import { describe, expect, it, vi } from "vitest";

import type { PersistedDocumentReference } from "../../../src/main/persistence/appPersistence";
import {
  restoreWindowSession,
  type RestorePorts
} from "../../../src/main/session/windowSessionRestoration";

function createDocument(path: string): DocumentSession {
  return createDocumentSession({
    location: { kind: "desktop-path", path },
    metadata: null,
    rawText: `# ${path}`
  });
}

function createDeferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("restoreWindowSession", () => {
  it("publishes the prioritized active document before the renderer barrier", async () => {
    const rendererReady = createDeferred<void>();
    const loadReference = vi.fn(async (reference: PersistedDocumentReference) =>
      createDocument(reference.kind === "desktop-path" ? reference.path : "")
    );
    const publishInitial = vi.fn();
    const refreshWorkspace = vi.fn(async () => undefined);
    const ports: RestorePorts = {
      loadReference,
      setDocumentMode: vi.fn(),
      publishInitial,
      publishDocuments: vi.fn(),
      waitForRendererReady: () => rendererReady.promise,
      refreshWorkspace
    };
    const restore = restoreWindowSession(
      {
        activeDocumentPath: "/active.md",
        documentPaths: ["/one.md", "/active.md", "/two.md"],
        editorMode: "source",
        workspacePath: "/workspace"
      },
      ports
    );

    await vi.waitFor(() => expect(publishInitial).toHaveBeenCalledTimes(1));
    expect(loadReference).toHaveBeenCalledTimes(1);
    expect(loadReference.mock.calls[0]?.[0]).toMatchObject({
      path: "/active.md"
    });
    expect(refreshWorkspace).not.toHaveBeenCalled();

    rendererReady.resolve();
    await restore;

    expect(loadReference.mock.calls.map(([reference]) => reference)).toEqual([
      { kind: "desktop-path", path: "/active.md" },
      { kind: "desktop-path", path: "/one.md" },
      { kind: "desktop-path", path: "/two.md" }
    ]);
    expect(refreshWorkspace).toHaveBeenCalledTimes(1);
  });

  it("falls back in prioritized order and does not retry attempted references", async () => {
    const loadReference = vi.fn(
      async (reference: PersistedDocumentReference) => {
        if (reference.kind !== "desktop-path") {
          return null;
        }

        return reference.path === "/active.md"
          ? null
          : createDocument(reference.path);
      }
    );
    const publishInitial = vi.fn();
    const ports: RestorePorts = {
      loadReference,
      setDocumentMode: vi.fn(),
      publishInitial,
      publishDocuments: vi.fn(),
      waitForRendererReady: async () => undefined,
      refreshWorkspace: async () => undefined
    };

    await restoreWindowSession(
      {
        activeDocumentRef: {
          kind: "desktop-path",
          path: "/active.md"
        },
        activeDocumentPath: "/legacy-active.md",
        documentPaths: ["/one.md", "/active.md", "/two.md"],
        editorMode: "rich",
        workspacePath: null
      },
      ports
    );

    expect(loadReference.mock.calls.map(([reference]) => reference)).toEqual([
      { kind: "desktop-path", path: "/active.md" },
      { kind: "desktop-path", path: "/one.md" },
      { kind: "desktop-path", path: "/two.md" }
    ]);
    expect(publishInitial.mock.calls[0]?.[0]?.id).toBe("desktop:/one.md");
  });

  it("restores two background documents concurrently and publishes persisted order", async () => {
    const pending = new Map<
      string,
      ReturnType<typeof createDeferred<DocumentSession | null>>
    >();
    let activeLoads = 0;
    let maxActiveLoads = 0;
    const published: string[][] = [];
    const loadReference = vi.fn(
      async (reference: PersistedDocumentReference) => {
        const path = reference.kind === "desktop-path" ? reference.path : "";

        if (path === "/active.md") {
          return createDocument(path);
        }

        activeLoads += 1;
        maxActiveLoads = Math.max(maxActiveLoads, activeLoads);
        const deferred = createDeferred<DocumentSession | null>();
        pending.set(path, deferred);
        const document = await deferred.promise;
        activeLoads -= 1;
        return document;
      }
    );
    const ports: RestorePorts = {
      loadReference,
      setDocumentMode: vi.fn(),
      publishInitial: vi.fn(),
      publishDocuments: (documents) => {
        published.push(documents.map(({ id }) => id));
      },
      waitForRendererReady: async () => undefined,
      refreshWorkspace: async () => undefined
    };
    const restore = restoreWindowSession(
      {
        activeDocumentPath: "/active.md",
        documentPaths: ["/one.md", "/active.md", "/two.md", "/three.md"],
        editorMode: "source",
        workspacePath: null
      },
      ports
    );

    await vi.waitFor(() => expect(pending.size).toBe(2));
    expect([...pending.keys()]).toEqual(["/one.md", "/two.md"]);

    pending.get("/two.md")?.resolve(createDocument("/two.md"));
    await vi.waitFor(() => expect(pending.has("/three.md")).toBe(true));
    pending.get("/one.md")?.resolve(createDocument("/one.md"));
    pending.get("/three.md")?.resolve(createDocument("/three.md"));
    await restore;

    expect(maxActiveLoads).toBe(2);
    expect(published.at(-1)).toEqual([
      "desktop:/one.md",
      "desktop:/active.md",
      "desktop:/two.md",
      "desktop:/three.md"
    ]);
  });
});
