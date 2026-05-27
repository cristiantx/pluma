export type FileLocationKind = "desktop-path" | "browser-file-handle";

export type DesktopFileLocation = {
  kind: "desktop-path";
  path: string;
};

export type BrowserFileLocation = {
  kind: "browser-file-handle";
  handleKey: string;
  name: string;
};

export type FileLocation = DesktopFileLocation | BrowserFileLocation;

export type PlumaLocationKind = FileLocationKind;

export interface ProjectInfo {
  name: string;
  localFirst: true;
  locationKinds: readonly PlumaLocationKind[];
}

export const projectInfo: ProjectInfo = {
  name: "Pluma",
  localFirst: true,
  locationKinds: ["desktop-path", "browser-file-handle"]
};

export function getFileLocationName(location: FileLocation): string {
  if (location.kind === "desktop-path") {
    const segments = location.path.replace(/[\\/]+$/, "").split(/[/\\]/);

    return segments.at(-1) ?? location.path;
  }

  return location.name;
}
