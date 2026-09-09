/* global require, process */
/* eslint-disable @typescript-eslint/no-require-imports -- Electron main harness uses CommonJS. */
const { app, BrowserWindow } = require("electron");

if (!process.env.PLUMA_TEST_USER_DATA || !process.env.PLUMA_TEST_RENDERER_URL) {
  throw new Error("Isolated test userData and renderer URL are required");
}
app.setPath("userData", process.env.PLUMA_TEST_USER_DATA);
app.whenReady().then(async () => {
  const window = new BrowserWindow({
    width: 1440,
    height: 1000,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  await window.loadURL(process.env.PLUMA_TEST_RENDERER_URL);
});
app.on("window-all-closed", () => app.quit());
