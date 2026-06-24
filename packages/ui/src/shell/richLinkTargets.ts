export type RichLinkTargetAction =
  | {
      kind: "external-url";
      url: string;
    }
  | {
      filePath: string;
      fragment: string | null;
      kind: "workspace-markdown";
    }
  | {
      kind: "ignored";
    };

const markdownExtensions = new Set([".md", ".markdown", ".mdown"]);

export function getRichLinkTargetAction({
  activeDocumentPath,
  linkUrl,
  workspacePath
}: {
  activeDocumentPath: string | null;
  linkUrl: string;
  workspacePath: string | null;
}): RichLinkTargetAction {
  const trimmedUrl = linkUrl.trim();
  const externalUrl = getExternalWebUrl(trimmedUrl);

  if (externalUrl) {
    return {
      kind: "external-url",
      url: externalUrl
    };
  }

  if (!activeDocumentPath || !workspacePath || isSchemedUrl(trimmedUrl)) {
    return { kind: "ignored" };
  }

  const { fragment, path: linkPath } = splitLinkPathAndFragment(trimmedUrl);

  if (!linkPath) {
    return { kind: "ignored" };
  }

  const decodedPath = decodePathSegment(linkPath);
  const filePath = resolveWorkspaceMarkdownPath({
    activeDocumentPath,
    linkPath: decodedPath,
    workspacePath
  });

  if (!filePath || !isMarkdownPath(filePath)) {
    return { kind: "ignored" };
  }

  return {
    filePath,
    fragment,
    kind: "workspace-markdown"
  };
}

function getExternalWebUrl(linkUrl: string): string | null {
  if (/^www\./i.test(linkUrl)) {
    return `https://${linkUrl}`;
  }

  try {
    const parsedUrl = new URL(linkUrl);

    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
      ? parsedUrl.href
      : null;
  } catch {
    return null;
  }
}

function isSchemedUrl(linkUrl: string): boolean {
  return /^[A-Za-z][A-Za-z\d+.-]*:/.test(linkUrl);
}

function splitLinkPathAndFragment(linkUrl: string): {
  fragment: string | null;
  path: string;
} {
  const hashIndex = linkUrl.indexOf("#");

  if (hashIndex === -1) {
    return {
      fragment: null,
      path: stripQuery(linkUrl)
    };
  }

  return {
    fragment: decodePathSegment(linkUrl.slice(hashIndex + 1)),
    path: stripQuery(linkUrl.slice(0, hashIndex))
  };
}

function stripQuery(linkPath: string): string {
  const queryIndex = linkPath.indexOf("?");

  return queryIndex === -1 ? linkPath : linkPath.slice(0, queryIndex);
}

function decodePathSegment(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function resolveWorkspaceMarkdownPath({
  activeDocumentPath,
  linkPath,
  workspacePath
}: {
  activeDocumentPath: string;
  linkPath: string;
  workspacePath: string;
}): string | null {
  const normalizedWorkspacePath = normalizePath(workspacePath);
  let candidatePath: string;

  if (isWindowsAbsolutePath(linkPath)) {
    candidatePath = normalizePath(linkPath);
  } else if (linkPath.startsWith("/")) {
    const normalizedLinkPath = normalizePath(linkPath);
    candidatePath = isPathInsideDirectory(
      normalizedWorkspacePath,
      normalizedLinkPath
    )
      ? normalizedLinkPath
      : joinPath(normalizedWorkspacePath, linkPath.replace(/^\/+/, ""));
  } else {
    candidatePath = joinPath(getDirectoryPath(activeDocumentPath), linkPath);
  }

  return isPathInsideDirectory(normalizedWorkspacePath, candidatePath)
    ? candidatePath
    : null;
}

function isMarkdownPath(filePath: string): boolean {
  const extensionMatch = /\.[^./\\]+$/.exec(filePath);

  return extensionMatch
    ? markdownExtensions.has(extensionMatch[0].toLowerCase())
    : false;
}

function isWindowsAbsolutePath(filePath: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(filePath) || filePath.startsWith("\\\\");
}

function normalizePath(filePath: string): string {
  const isWindowsDrivePath = /^[A-Za-z]:/.test(filePath);
  const isAbsolute = filePath.startsWith("/") || isWindowsDrivePath;
  const prefix = isWindowsDrivePath ? "" : isAbsolute ? "/" : "";
  const parts: string[] = [];

  for (const part of filePath.replace(/\\/g, "/").split("/")) {
    if (!part || part === ".") {
      continue;
    }

    if (part === "..") {
      parts.pop();
      continue;
    }

    parts.push(part);
  }

  return `${prefix}${parts.join("/")}`;
}

function getDirectoryPath(filePath: string): string {
  const normalizedPath = normalizePath(filePath);
  const separatorIndex = normalizedPath.lastIndexOf("/");

  return separatorIndex <= 0 ? "/" : normalizedPath.slice(0, separatorIndex);
}

function joinPath(basePath: string, relativePath: string): string {
  return normalizePath(`${basePath.replace(/\/+$/, "")}/${relativePath}`);
}

function isPathInsideDirectory(directoryPath: string, candidatePath: string) {
  const normalizedDirectory = normalizePath(directoryPath).replace(/\/+$/, "");
  const normalizedCandidate = normalizePath(candidatePath);

  return (
    normalizedCandidate === normalizedDirectory ||
    normalizedCandidate.startsWith(`${normalizedDirectory}/`)
  );
}
