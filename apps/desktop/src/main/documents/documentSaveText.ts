import {
  applyLineEnding,
  resolveDefaultLineEnding,
  type DocumentSession
} from "@pluma/core";

export type DocumentSaveText = {
  prepareTextForSave(document: DocumentSession, text?: string): string;
  getWritableDefaultLineEnding(): "crlf" | "lf";
};

export function createDocumentSaveText(
  getDefaultLineEnding: () => "crlf" | "lf" | "system",
  platform: NodeJS.Platform = process.platform
): DocumentSaveText {
  const getWritableDefaultLineEnding = (): "crlf" | "lf" =>
    resolveDefaultLineEnding(getDefaultLineEnding(), platform);

  return {
    getWritableDefaultLineEnding,
    prepareTextForSave(document, text = document.rawText) {
      if (document.lineEnding === "crlf" || document.lineEnding === "lf") {
        return applyLineEnding(text, document.lineEnding);
      }

      if (document.lineEnding === "none") {
        return applyLineEnding(text, getWritableDefaultLineEnding());
      }

      return text;
    }
  };
}
