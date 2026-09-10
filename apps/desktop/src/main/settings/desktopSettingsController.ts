import { defaultAppSettings, type AppSettings } from "@pluma/ui/settings";

export type SettingsSession = {
  clearAutosaveTimers: () => void;
  emitSettingsChanged: (settings: AppSettings) => void;
  emitStatus: (message: string) => void;
  refreshSettingsSensitiveState: () => Promise<void>;
  window: {
    isDestroyed: () => boolean;
    webContents: {
      session: {
        setSpellCheckerEnabled: (enabled: boolean) => void;
      };
    };
  };
};

export type DesktopSettingsControllerDependencies = {
  getSessions: () => SettingsSession[];
  refreshMenu: () => void;
  write: (settings: AppSettings) => Promise<void>;
};

export class DesktopSettingsController {
  private mutationQueue: Promise<void> = Promise.resolve();
  private snapshot: AppSettings = { ...defaultAppSettings };

  constructor(
    private readonly dependencies: DesktopSettingsControllerDependencies
  ) {}

  applyInitial(settings: AppSettings): void {
    this.snapshot = settings;
  }

  applySpellcheck(): void {
    for (const session of this.dependencies.getSessions()) {
      if (!session.window.isDestroyed()) {
        session.window.webContents.session.setSpellCheckerEnabled(
          this.snapshot.spellcheckEnabled
        );
      }
    }
  }

  getSnapshot(): AppSettings {
    return this.snapshot;
  }

  reset(): Promise<AppSettings> {
    return this.update(defaultAppSettings);
  }

  update(update: Partial<AppSettings>): Promise<AppSettings> {
    return this.enqueueMutation(async () => {
      const currentSettings = this.snapshot;
      const nextSettings: AppSettings = {
        ...currentSettings,
        ...update
      };

      await this.dependencies.write(nextSettings);
      this.snapshot = nextSettings;

      if (!nextSettings.autosaveEnabled) {
        for (const session of this.dependencies.getSessions()) {
          session.clearAutosaveTimers();
        }
      }

      if (
        currentSettings.spellcheckEnabled !== nextSettings.spellcheckEnabled
      ) {
        this.applySpellcheck();
      }

      if (
        currentSettings.workspaceShowHiddenFiles !==
          nextSettings.workspaceShowHiddenFiles ||
        currentSettings.workspaceRespectGitIgnore !==
          nextSettings.workspaceRespectGitIgnore
      ) {
        for (const session of this.dependencies.getSessions()) {
          void session.refreshSettingsSensitiveState().catch((error) => {
            session.emitStatus(
              error instanceof Error
                ? `Failed to refresh workspace settings: ${error.message}`
                : "Failed to refresh workspace settings."
            );
          });
        }
      }

      for (const session of this.dependencies.getSessions()) {
        session.emitSettingsChanged(nextSettings);
      }
      this.dependencies.refreshMenu();

      return nextSettings;
    });
  }

  private enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationQueue.then(operation, operation);
    this.mutationQueue = result.then(
      () => undefined,
      () => undefined
    );
    return result;
  }
}
