import { app, nativeImage, session } from "electron";
import { downloadChromeExtension } from "electron-devtools-installer/dist/downloadChromeExtension.js";

const reactDeveloperToolsExtensionId = "fmkadmapgofadopljbjfkapdkoienihi";

export function setApplicationIcon(iconPath: string): void {
  const icon = nativeImage.createFromPath(iconPath);

  if (icon.isEmpty()) {
    return;
  }

  if (process.platform === "darwin" && app.dock) {
    app.dock.setIcon(icon);
  }
}

export async function installDevelopmentExtensions(
  isDevelopment: boolean
): Promise<void> {
  if (!isDevelopment) {
    return;
  }

  try {
    const installedExtension = session.defaultSession.extensions
      .getAllExtensions()
      .find((extension) => extension.id === reactDeveloperToolsExtensionId);

    if (installedExtension) {
      return;
    }

    const extensionPath = await downloadChromeExtension(
      reactDeveloperToolsExtensionId
    );
    await session.defaultSession.extensions.loadExtension(extensionPath);
  } catch (error) {
    console.warn(
      error instanceof Error
        ? `React DevTools installation failed: ${error.message}`
        : "React DevTools installation failed."
    );
  }
}
