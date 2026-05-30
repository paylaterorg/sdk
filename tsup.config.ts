import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { defineConfig } from "tsup";

const pkg = JSON.parse(
  readFileSync(fileURLToPath(new URL("./package.json", import.meta.url)), "utf8"),
) as { version: string };

export default defineConfig([
  {
    entry: {
      index: "src/index.ts",
      "react/index": "src/react/index.tsx",
    },
    format: ["esm", "cjs"],
    dts: true,
    sourcemap: false,
    minify: true,
    treeshake: true,
    splitting: false,
    cjsInterop: true,
    target: "es2022",
    platform: "browser",
    external: ["react", "react-dom"],
    loader: {
      ".css": "text",
      ".ico": "dataurl",
      ".svg": "dataurl",
    },
    define: {
      __PKG_VERSION__: JSON.stringify(pkg.version),
    },
    esbuildOptions(opts) {
      opts.jsx = "automatic";
      opts.banner = {
        js: "/* @paylater/sdk — frictionless USDT checkout. https://paylater.dev */",
      };
    },
  },
  {
    entry: {
      "webhooks/index": "src/webhooks/index.ts",
    },
    format: ["esm", "cjs"],
    dts: {
      compilerOptions: {
        composite: false,
        declaration: true,
        lib: ["ES2022"],
        types: ["node"],
      },
    },
    sourcemap: false,
    minify: false,
    treeshake: true,
    splitting: false,
    cjsInterop: true,
    target: "es2022",
    platform: "node",
    external: ["node:crypto"],
  },
]);
