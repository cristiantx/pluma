export type {
  CreateDocumentSessionInput,
  DocumentCapability,
  DocumentMode,
  DocumentSaveState,
  DocumentSession
} from "./documentSession.js";
export {
  createDocumentSession,
  getDocumentSessionId,
  markDocumentSessionConflict,
  markDocumentSessionSaved,
  markDocumentSessionSaving,
  updateDocumentSessionText
} from "./documentSession.js";
export type {
  FileMetadata,
  FileSystemAdapter,
  FileSystemEntry,
  SaveConflictReason,
  SaveConflictResult,
  SaveErrorResult,
  SaveResult,
  SaveSuccessResult,
  WriteTextOptions
} from "./fileSystemAdapter.js";
export {
  getSaveConflictReason,
  isMetadataConflict
} from "./fileSystemAdapter.js";
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

export type {
  MarkdownCapabilityAnalysis,
  MarkdownParseResult,
  MarkdownPipeline,
  MarkdownSerializationResult,
  MarkdownUnsupportedConstruct
} from "./markdownPipeline.js";

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
