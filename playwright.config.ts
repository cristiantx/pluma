import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/interaction",
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:4179",
    viewport: { width: 1440, height: 1000 },
    trace: "retain-on-failure"
  },
  webServer: {
    command:
      "node ../../node_modules/vite/bin/vite.js --config vite.renderer.config.ts --host 127.0.0.1 --port 4179 --strictPort --force",
    cwd: "apps/desktop",
    url: "http://127.0.0.1:4179",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000
  },
  projects: [
    {
      name: "renderer",
      testMatch: [
        "**/renderer.spec.ts",
        "**/geometry.spec.ts",
        "**/selection*.spec.ts",
        "**/diagramLifecycle.spec.ts",
        "**/editorState.spec.ts"
      ]
    },
    { name: "electron", testMatch: "**/electron.spec.ts" },
    { name: "packaged", testMatch: "**/packaged.spec.ts" }
  ]
});
