import path from "node:path";

export function getPackagedRipgrepPath(
  resourcesPath: string,
  platform: NodeJS.Platform
): string {
  const pathForPlatform = platform === "win32" ? path.win32 : path.posix;
  return pathForPlatform.join(
    resourcesPath,
    "bin",
    getRipgrepBinaryName(platform)
  );
}

export async function resolveRipgrepPath(): Promise<string> {
  if (await isPackagedElectronApp()) {
    return getPackagedRipgrepPath(process.resourcesPath, process.platform);
  }

  const { rgPath } = await import("@vscode/ripgrep");
  return rgPath;
}

function getRipgrepBinaryName(platform: NodeJS.Platform): string {
  return platform === "win32" ? "rg.exe" : "rg";
}

async function isPackagedElectronApp(): Promise<boolean> {
  if (!process.versions.electron) {
    return false;
  }

  const { app } = await import("electron");
  return app.isPackaged;
}
