import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "katex/dist/katex.min.css": new URL(
        "./packages/editor/test/fixtures/emptyCss.ts",
        import.meta.url
      ).pathname
    }
  },
  test: {
    include: ["apps/**/test/**/*.test.ts", "packages/**/test/**/*.test.ts"]
  }
});
