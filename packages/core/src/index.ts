export type {
  CreateDocumentSessionInput,
  DocumentCapability,
  DocumentMode,
  DocumentSaveState,
  DocumentSession
} from "./documentSession.js";
export type {
  DefaultLineEnding,
  LineEnding,
  WritableLineEnding
} from "./lineEndings.js";
export {
  createDocumentSession,
  getDocumentSessionId,
  markDocumentSessionConflict,
  markDocumentSessionExternalChange,
  markDocumentSessionSaveError,
  markDocumentSessionSaved,
  markDocumentSessionSaving,
  shouldProtectDocumentSessionClose,
  updateDocumentSessionText
} from "./documentSession.js";
export {
  applyLineEnding,
  detectLineEnding,
  formatLineEndingLabel,
  resolveDefaultLineEnding
} from "./lineEndings.js";
export { resolveFileLocationReference } from "./fileLocation.js";
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
export type FileLocationKind =
  | "app-draft"
  | "desktop-path"
  | "browser-file-handle";

export type AppDraftFileLocation = {
  draftId: string;
  kind: "app-draft";
  name: string;
};

export type DesktopFileLocation = {
  kind: "desktop-path";
  path: string;
};

export type BrowserFileLocation = {
  kind: "browser-file-handle";
  handleKey: string;
  name: string;
};

export type FileLocation =
  | AppDraftFileLocation
  | DesktopFileLocation
  | BrowserFileLocation;

export type PlumaLocationKind = FileLocationKind;

export type {
  MarkdownCapabilityAnalysis,
  MarkdownParseResult,
  MarkdownPipeline,
  MarkdownSerializationResult,
  MarkdownUnsupportedConstruct
} from "./markdownPipeline.js";
export {
  analyzeMarkdownParseResult,
  analyzeMarkdownText,
  getMarkdownDocumentCapability,
  guardMarkdownRoundTrip,
  markdownPipeline,
  parseMarkdown,
  serializeMarkdownSession
} from "./markdownPipeline.js";
export type { MarkdownFormatResult } from "./markdownFormatter.js";
export {
  formatMarkdownText,
  normalizeAccidentalLooseLists
} from "./markdownFormatter.js";
export { renderMarkdownExportHtml } from "./markdownExport.js";

export interface ProjectInfo {
  name: string;
  localFirst: true;
  locationKinds: readonly PlumaLocationKind[];
}

export const projectInfo: ProjectInfo = {
  name: "Pluma",
  localFirst: true,
  locationKinds: ["app-draft", "desktop-path", "browser-file-handle"]
};

export function getFileLocationName(location: FileLocation): string {
  if (location.kind === "app-draft") {
    return location.name;
  }

  if (location.kind === "desktop-path") {
    const segments = location.path.replace(/[\\/]+$/, "").split(/[/\\]/);

    return segments.at(-1) ?? location.path;
  }

  return location.name;
}
