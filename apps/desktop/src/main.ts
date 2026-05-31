import { startDesktopMainProcess } from "./main/desktopMainController";

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

startDesktopMainProcess({
  mainBundleDirectory: __dirname,
  rendererDevServerUrl: MAIN_WINDOW_VITE_DEV_SERVER_URL,
  rendererName: MAIN_WINDOW_VITE_NAME
});
