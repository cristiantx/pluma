export type PlumaLocationKind = "desktop-path" | "browser-handle";

export interface ProjectInfo {
  name: string;
  localFirst: true;
  locationKinds: readonly PlumaLocationKind[];
}

export const projectInfo: ProjectInfo = {
  name: "Pluma",
  localFirst: true,
  locationKinds: ["desktop-path", "browser-handle"]
};
