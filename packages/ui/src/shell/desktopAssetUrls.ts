const localAssetProtocolOrigin = "pluma-asset://local";

export function getDesktopDocumentAssetBaseUrl(
  documentPath: string
): string | undefined {
  const directoryPath = getDirectoryPath(documentPath);

  if (!directoryPath) {
    return undefined;
  }

  const encodedPathname = encodePathname(directoryPath);
  const urlPathname = encodedPathname.startsWith("/")
    ? encodedPathname
    : `/${encodedPathname}`;

  return `${localAssetProtocolOrigin}${urlPathname}/`;
}

function getDirectoryPath(filePath: string): string {
  const normalizedPath = filePath.replace(/\\/g, "/").replace(/\/+$/, "");
  const separatorIndex = normalizedPath.lastIndexOf("/");

  if (separatorIndex <= 0) {
    return "";
  }

  return normalizedPath.slice(0, separatorIndex);
}

function encodePathname(pathname: string): string {
  return pathname
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}
