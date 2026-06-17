export type WindowClosePersistenceInput = {
  isQuitting: boolean;
  isWindowAllowedToClose: boolean;
  openWindowCount: number;
  platform: NodeJS.Platform;
};

export function shouldRouteWindowCloseThroughAppQuit({
  isQuitting,
  isWindowAllowedToClose,
  openWindowCount,
  platform
}: WindowClosePersistenceInput): boolean {
  return (
    !isQuitting &&
    !isWindowAllowedToClose &&
    platform !== "darwin" &&
    openWindowCount === 1
  );
}

export function shouldPersistAfterWindowClosed(isQuitting: boolean): boolean {
  return !isQuitting;
}
