export const markdownFileExtensions = [".md", ".markdown", ".mdown"] as const;

export function isMarkdownFilePath(filePath: string): boolean {
  const normalizedPath = filePath.split(/[?#]/, 1)[0]?.toLowerCase() ?? "";

  return markdownFileExtensions.some((extension) =>
    normalizedPath.endsWith(extension)
  );
}
