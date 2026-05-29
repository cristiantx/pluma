import path from "node:path";

import type { DesktopFileLocation, FileLocation } from "./index.js";

function isExternalReference(reference: string): boolean {
  return /^(?:[a-z]+:|#)/i.test(reference);
}

export function resolveFileLocationReference(
  location: FileLocation,
  reference: string
): DesktopFileLocation | null {
  if (
    location.kind !== "desktop-path" ||
    !reference ||
    isExternalReference(reference)
  ) {
    return null;
  }

  return {
    kind: "desktop-path",
    path: path.resolve(path.dirname(location.path), reference)
  };
}
