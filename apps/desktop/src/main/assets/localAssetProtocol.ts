import { net, protocol, type Session } from "electron";
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
  electronSession: Session
): void {
  electronSession.protocol.handle(localAssetProtocolScheme, (request) => {
    const filePath = getLocalAssetPathFromUrl(request.url);

    if (!filePath || !isSupportedImagePath(filePath)) {
      return new Response("Not found", { status: 404 });
    }

    return net.fetch(pathToFileURL(filePath).href);
  });
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
