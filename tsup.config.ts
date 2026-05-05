import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

export default defineConfig({
  entry: {
    index: "src/index.ts",
    "react/index": "src/react/index.tsx",
  },
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  minify: true,
  treeshake: true,
  splitting: false,
  cjsInterop: true,
  target: "es2022",
  platform: "browser",
  external: ["react", "react-dom"],
  loader: {
    ".css": "text",
  },
  define: {
    __PKG_VERSION__: JSON.stringify(pkg.version),
  },
  esbuildOptions(opts) {
    opts.jsx = "automatic";
    opts.banner = {
      js: "/* @paylaterorg/sdk — frictionless USDT checkout. https://paylater.dev */",
    };
  },
});
