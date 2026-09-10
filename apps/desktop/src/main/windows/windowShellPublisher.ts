import type {
  DesktopShellSnapshot,
  RendererEvent
} from "../../shared/shellState";
import { getShellStateEvents } from "./shellEventDiff";

export class WindowShellPublisher {
  private previous: DesktopShellSnapshot | null = null;
  constructor(
    private readonly getSnapshot: () => DesktopShellSnapshot,
    private readonly emit: (event: RendererEvent) => void
  ) {}
  publishInitial(): void {
    const snapshot = this.getSnapshot();
    this.previous = snapshot;
    this.emit({ type: "shell-snapshot", snapshot });
  }
  publishChanges(): void {
    if (!this.previous) return;
    const current = this.getSnapshot();
    const events = getShellStateEvents(this.previous, current);
    this.previous = current;
    for (const event of events) this.emit(event);
  }
}
