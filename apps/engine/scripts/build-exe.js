/**
 * RiffRush Engine — Windows executable packaging script
 *
 * Produces dist/riffrush-engine.exe using Node.js Single Executable
 * Applications (SEA, stable since Node 22) and esbuild for bundling.
 *
 * Steps:
 *   1. Bundle all engine JS into a single CJS file via esbuild (npx, no
 *      installation required — npx caches automatically after first run).
 *   2. Generate a SEA blob from the bundle using the Node.js built-in flag.
 *   3. Copy the local Node.js binary to the output path.
 *   4. Inject the blob into the copy via postject (npx).
 *   5. (Optional) Build the C# native-capture-bridge to a standalone exe.
 *
 * Usage:
 *   node apps/engine/scripts/build-exe.js          # engine exe only
 *   node apps/engine/scripts/build-exe.js --full   # engine + native bridge
 *
 * Output:
 *   dist/riffrush-engine.exe
 *   dist/native-capture-bridge.exe  (only with --full)
 */

import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { platform } from "node:os";

// ── Paths ────────────────────────────────────────────────────────────────────

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const engineRoot = resolve(__dirname, "..");
const projectRoot = resolve(engineRoot, "../..");
const distDir = resolve(projectRoot, "dist");

const ENTRY_POINT = resolve(engineRoot, "src", "server.js");
const BUNDLE_PATH = resolve(distDir, "engine-bundle.cjs");
const SEA_CONFIG_PATH = resolve(distDir, "sea-config.json");
const BLOB_PATH = resolve(distDir, "engine-sea.blob");
const EXE_OUTPUT = resolve(distDir, "riffrush-engine.exe");
const NATIVE_BRIDGE_PROJECT = resolve(projectRoot, "apps", "native-capture-bridge");
const NATIVE_BRIDGE_EXE = resolve(distDir, "native-capture-bridge.exe");

const FULL_BUILD = process.argv.includes("--full");

// ── Utilities ─────────────────────────────────────────────────────────────────

function step(label) {
  process.stdout.write(`\n\x1b[36m▶\x1b[0m ${label}\n`);
}

function ok(label) {
  process.stdout.write(`  \x1b[32m✓\x1b[0m ${label}\n`);
}

function fail(label, hint = "") {
  process.stderr.write(`  \x1b[31m✗\x1b[0m ${label}\n`);
  if (hint) process.stderr.write(`    ${hint}\n`);
  process.exit(1);
}

/**
 * Spawns a command and exits the process if it fails.
 *
 * shell defaults to false so that paths with spaces (e.g. process.execPath on
 * Windows: "C:\Program Files\nodejs\node.exe") are passed as-is to the OS
 * without shell word-splitting. Set shell: true explicitly for commands that
 * live in PATH as .cmd files on Windows (npx, dotnet).
 */
function run(command, args, { shell = false, ...options } = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell,
    ...options
  });

  if (result.status !== 0) {
    fail(`Command failed: ${command} ${args.slice(0, 3).join(" ")}`, `Exit code: ${result.status}`);
  }
}

// ── Pre-flight ────────────────────────────────────────────────────────────────

if (platform() !== "win32") {
  process.stderr.write(
    "Warning: this script targets Windows. On other platforms the .exe will " +
    "not run, but the build will still complete for CI/CD validation.\n"
  );
}

const nodeMajor = parseInt(process.versions.node.split(".")[0], 10);
if (nodeMajor < 20) {
  fail(
    `Node.js ${process.versions.node} detected. Node.js >= 20 required for SEA.`,
    "Upgrade Node.js: https://nodejs.org"
  );
}

if (!existsSync(ENTRY_POINT)) {
  fail(`Entry point not found: ${ENTRY_POINT}`);
}

mkdirSync(distDir, { recursive: true });

// ── Step 1: Bundle ────────────────────────────────────────────────────────────

step("Bundling engine with esbuild…");

// esbuild handles:
//  • ESM → CJS conversion (required for SEA on all Node versions)
//  • Inlining of relative imports
//  • Marking node: built-ins as external (they stay as require() calls)
//  • import.meta.url → __filename (automatic in CJS output mode)
run("npx", [
  "--yes", "esbuild@latest",
  ENTRY_POINT,
  "--bundle",
  "--platform=node",
  `--outfile=${BUNDLE_PATH}`,
  "--format=cjs",
  "--external:*.node",          // skip native addons
  "--log-level=warning"
], { shell: true });

ok(`Bundle written to ${BUNDLE_PATH}`);

// ── Step 2: SEA config + blob ─────────────────────────────────────────────────

step("Generating SEA blob…");

writeFileSync(
  SEA_CONFIG_PATH,
  JSON.stringify(
    {
      main: BUNDLE_PATH,
      output: BLOB_PATH,
      disableExperimentalSEAWarning: true
    },
    null,
    2
  )
);

run(process.execPath, ["--experimental-sea-config", SEA_CONFIG_PATH], {
  cwd: distDir,
  shell: false
});

ok(`Blob written to ${BLOB_PATH}`);

// ── Step 3: Copy Node.js binary ────────────────────────────────────────────────

step(`Copying Node.js binary to ${EXE_OUTPUT}…`);

copyFileSync(process.execPath, EXE_OUTPUT);

ok(`Copied ${process.execPath} → ${EXE_OUTPUT}`);

// ── Step 4: Inject blob ────────────────────────────────────────────────────────

step("Injecting SEA blob into executable…");

// The sentinel fuse value is a fixed string specified by the Node.js SEA spec.
const SEA_FUSE = "NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2";

run("npx", [
  "--yes", "postject@latest",
  EXE_OUTPUT,
  "NODE_SEA_BLOB",
  BLOB_PATH,
  "--sentinel-fuse", SEA_FUSE,
  "--overwrite"
], { shell: true });

ok("Blob injected successfully.");

// ── Step 5: Clean up build artefacts ──────────────────────────────────────────

step("Cleaning build artefacts…");

for (const path of [BUNDLE_PATH, SEA_CONFIG_PATH, BLOB_PATH]) {
  if (existsSync(path)) {
    rmSync(path);
  }
}

ok("Build artefacts removed.");

// ── Step 6 (optional): Native capture bridge ──────────────────────────────────

if (FULL_BUILD) {
  step("Building native-capture-bridge.exe…");

  if (!existsSync(NATIVE_BRIDGE_PROJECT)) {
    fail(
      `Native capture bridge project not found: ${NATIVE_BRIDGE_PROJECT}`,
      "Run this script from the project root."
    );
  }

  // Publish as a framework-dependent Windows exe (requires .NET runtime on target).
  // Use --self-contained true for a fully standalone binary (larger file size).
  run("dotnet", [
    "publish",
    NATIVE_BRIDGE_PROJECT,
    "--configuration", "Release",
    "--runtime", "win-x64",
    "--self-contained", "false",
    "--output", distDir,
    "-p:NuGetAudit=false",
    "--nologo",
    "--verbosity", "minimal"
  ], { shell: true });

  if (!existsSync(NATIVE_BRIDGE_EXE)) {
    fail(
      "dotnet publish completed but native-capture-bridge.exe was not found in dist/.",
      "Check the build output above for errors."
    );
  }

  ok(`Native capture bridge written to ${NATIVE_BRIDGE_EXE}`);
}

// ── Summary ───────────────────────────────────────────────────────────────────

process.stdout.write("\n\x1b[32m✔ Build complete.\x1b[0m\n");
process.stdout.write(`\n  Engine exe:  ${EXE_OUTPUT}\n`);

if (FULL_BUILD) {
  process.stdout.write(`  Bridge exe:  ${NATIVE_BRIDGE_EXE}\n`);
  process.stdout.write(
    "\n  Place both files in the same folder on the target machine.\n"
  );
}

process.stdout.write(
  "\n  Run: riffrush-engine.exe\n" +
  "  The engine listens on ws://127.0.0.1:3210/ws\n\n"
);
