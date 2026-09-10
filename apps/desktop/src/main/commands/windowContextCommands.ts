import type { CommandRequest } from "@pluma/commands";
import { type BrowserWindow } from "electron";
import type { RendererEvent } from "../../shared/shellState";
import {
  buildTabContextMenu,
  executeTabMenuCommand,
  type TabMenuCommandRequest
} from "../menus/tabContextMenu";
import type { WorkspaceMenuCommandRequest } from "../menus/workspaceContextMenu";
import type { createWindowSurfaceServices } from "../windows/windowSurfaceServices";
export type WindowContextCommandDependencies = {
  getSurface(): ReturnType<typeof createWindowSurfaceServices>;
  getWindow(): BrowserWindow;
  flushDocumentText?: () => Promise<boolean>;
  emitToRenderer(event: RendererEvent): void;
};
export function createWindowContextCommands(
  dependencies: WindowContextCommandDependencies
) {
  function showTabContextMenu(tabId: string, tabIds: unknown): void {
    const options = dependencies
      .getSurface()
      .tabMenus.getTabContextMenuOptions(tabId, tabIds);
    if (options)
      buildTabContextMenu(options).popup({ window: dependencies.getWindow() });
  }

  async function handleContextCommand(
    request: Extract<
      CommandRequest,
      { id: `tab-${string}` | `workspace-${string}` }
    >,
    fromNativeMenu = false
  ): Promise<void> {
    if (
      fromNativeMenu &&
      dependencies.flushDocumentText &&
      !(await dependencies.flushDocumentText())
    )
      return;
    if (dependencies.getWindow().isDestroyed()) return;
    if (request.id.startsWith("tab-")) {
      const tabRequest = request as TabMenuCommandRequest;
      const options = dependencies
        .getSurface()
        .tabMenus.getTabContextMenuOptions(
          tabRequest.args.tabId,
          tabRequest.args.tabIds
        );
      if (options) await executeTabMenuCommand(tabRequest, options);
      return;
    }
    const workspaceRequest = request as WorkspaceMenuCommandRequest;
    if (
      !dependencies
        .getSurface()
        .workspaceActions.isValidWorkspaceTarget(
          workspaceRequest.args.path,
          workspaceRequest.args.kind
        )
    )
      return;
    await dependencies
      .getSurface()
      .workspaceActions.getWorkspaceFileActions()
      .executeCommand(workspaceRequest);
  }

  function showWorkspaceContextMenu(targetPath: unknown, kind: unknown): void {
    if (
      typeof targetPath !== "string" ||
      (kind !== "file" && kind !== "folder") ||
      !dependencies
        .getSurface()
        .workspaceActions.isValidWorkspaceTarget(targetPath, kind)
    ) {
      dependencies.emitToRenderer({
        type: "status",
        message: "Workspace action was ignored."
      });
      return;
    }

    dependencies
      .getSurface()
      .workspaceActions.getWorkspaceFileActions()
      .showWorkspaceContextMenu(targetPath, kind);
  }
  return { showTabContextMenu, handleContextCommand, showWorkspaceContextMenu };
}
