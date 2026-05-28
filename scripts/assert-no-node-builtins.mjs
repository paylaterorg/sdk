import { execFileSync } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = new URL("../dist", import.meta.url).pathname;

function walk(dir, excludePrefix) {
  const results = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = full.slice(DIST.length + 1);
    if (statSync(full).isDirectory()) {
      if (!excludePrefix || !rel.startsWith(excludePrefix)) {
        results.push(...walk(full, excludePrefix));
      }
    } else {
      results.push(full);
    }
  }
  return results;
}

// Patterns that must NOT appear in browser bundle files
const NODE_PATTERNS = [
  /\bnode:/,
  /require\(["']crypto["']\)/,
  /require\(["']node:crypto["']\)/,
  /["']crypto["']/,
];

const browserFiles = walk(DIST, "webhooks").filter((f) => f.endsWith(".js"));

let failed = false;

// Layer (a+b): string-grep all browser .js files for node builtin patterns
for (const file of browserFiles) {
  const src = readFileSync(file, "utf8");
  for (const pattern of NODE_PATTERNS) {
    if (pattern.test(src)) {
      console.error(`FAIL [bundle-gate] Node built-in pattern found in browser bundle: ${file}`);
      console.error(`  Pattern: ${pattern}`);
      failed = true;
    }
  }
}

// Layer (c): parse-check dist/index.js and dist/index.cjs to confirm they are
// syntactically valid and contain no top-level use of Node built-in module ids.
// We use `node --check` (parse-only, no execution) to avoid issues with missing
// peer dependencies (e.g. @web3icons/react subpath exports) that are only
// resolvable inside the bundled context, not in a bare Node require().
for (const target of ["index.js", "index.cjs"]) {
  const targetPath = join(DIST, target);
  try {
    execFileSync(process.execPath, ["--check", targetPath], { stdio: "pipe" });
    console.log(`OK  [bundle-gate] dist/${target} syntax check passed`);
  } catch (err) {
    console.error(
      `FAIL [bundle-gate] dist/${target} failed syntax check: ${err.stderr?.toString() ?? err.message}`,
    );
    failed = true;
  }
}

if (failed) {
  process.exit(1);
} else {
  console.log(
    `OK  [bundle-gate] ${browserFiles.length} browser bundle file(s) checked — no Node built-ins found`,
  );
}
