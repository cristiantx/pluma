import { net, protocol, type Session } from "electron";
import { realpath, stat } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const localAssetProtocolScheme = "pluma-asset";

const supportedImageExtensions = new Set([
  ".avif",
  ".bmp",
  ".gif",
  ".heic",
  ".ico",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp"
]);

export function registerLocalAssetProtocolScheme(): void {
  protocol.registerSchemesAsPrivileged([
    {
      scheme: localAssetProtocolScheme,
      privileges: {
        secure: true,
        standard: true,
        stream: true
      }
    }
  ]);
}

export function registerLocalAssetProtocolHandler(
  electronSession: Session,
  getAuthorizedRoots: () => string[]
): void {
  electronSession.protocol.handle(localAssetProtocolScheme, async (request) => {
    const filePath = getLocalAssetPathFromUrl(request.url);

    if (
      !filePath ||
      !isSupportedImagePath(filePath) ||
      !(await isLocalAssetPathAuthorized(filePath, getAuthorizedRoots()))
    ) {
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).href);
  });
}

export async function isLocalAssetPathAuthorized(
  filePath: string,
  authorizedRoots: string[]
): Promise<boolean> {
  try {
    const canonicalFilePath = await realpath(filePath);
    const fileStats = await stat(canonicalFilePath);

    if (!fileStats.isFile()) {
      return false;
    }

    for (const rootPath of authorizedRoots) {
      const canonicalRootPath = await realpath(rootPath).catch(() => null);

      if (
        canonicalRootPath &&
        isPathWithinRoot(canonicalRootPath, canonicalFilePath)
      ) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
}

function getLocalAssetPathFromUrl(url: string): string | null {
  try {
    const parsedUrl = new URL(url);

    if (
      parsedUrl.protocol !== `${localAssetProtocolScheme}:` ||
      parsedUrl.hostname !== "local"
    ) {
      return null;
    }

    const pathName = decodeURIComponent(parsedUrl.pathname);

    if (/^\/[A-Za-z]:\//.test(pathName)) {
      return pathName.slice(1);
    }

    return pathName;
  } catch {
    return null;
  }
}

function isSupportedImagePath(filePath: string): boolean {
  return supportedImageExtensions.has(path.extname(filePath).toLowerCase());
}

function isPathWithinRoot(rootPath: string, filePath: string): boolean {
  const relativePath = path.relative(rootPath, filePath);

  return (
    relativePath !== ".." &&
    !relativePath.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relativePath)
  );
}
