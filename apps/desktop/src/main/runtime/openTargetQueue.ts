import path from "node:path";

export type OpenTargetSession = {
  handleOpenTarget: (targetPath: string) => Promise<void>;
};

export type OpenTargetQueuePorts = {
  getLatestSession: () => OpenTargetSession | null;
  createWindow: () => OpenTargetSession;
};

export function normalizeOpenTargets(argumentsList: string[]): string[] {
  return argumentsList.filter((argument) => {
    if (!argument || argument.startsWith("-")) {
      return false;
    }

    if (argument === "." || argument === "..") {
      return false;
    }

    return path.isAbsolute(argument);
  });
}

export class OpenTargetQueue {
  private pendingTargets: string[] = [];

  constructor(private readonly ports: OpenTargetQueuePorts) {}

  queue(targets: string[]): void {
    this.pendingTargets.push(...targets);
  }

  async flush(): Promise<void> {
    if (this.pendingTargets.length === 0) {
      return;
    }

    const session = this.ports.getLatestSession() ?? this.ports.createWindow();
    const targets = this.pendingTargets;
    this.pendingTargets = [];

    for (const targetPath of targets) {
      await session.handleOpenTarget(targetPath);
    }
  }
}
