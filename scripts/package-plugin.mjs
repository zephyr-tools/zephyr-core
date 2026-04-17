/**
 * Package an example plugin into a distributable .zip.
 *
 * Usage:
 *   node scripts/package-plugin.mjs <plugin-dir> [--id <id>] [--out <dir>]
 *   npm run package:plugin -- <plugin-dir> [--id <id>] [--out <dir>]
 *
 * Behavior:
 * - If the plugin dir has a package.json with a `build` script, runs
 *   `npm install` (if node_modules missing) then `npm run build`. This is
 *   how Layer-2 plugins produce their `renderer.js` bundle.
 * - Plugin ID comes from --id, else package.json `zephyr.pluginId`, else the
 *   directory basename. Validated against ^[a-z0-9][a-z0-9-]*$ — same rule
 *   PluginHost enforces on install.
 * - Copies the plugin dir into the zip under `<pluginId>/`, excluding
 *   dev-only files (node_modules, src, package.json, build configs, etc.).
 * - index.js is required; missing it is a packaging error.
 * - Writes to examples/dist/<pluginId>.zip by default.
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { zipSync } from 'fflate';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

// ── Arg parsing ───────────────────────────────────────────────────────────────
const raw = process.argv.slice(2);
const positional = [];
const flags = new Map();
for (let i = 0; i < raw.length; i++) {
  const a = raw[i];
  if (a.startsWith('--')) {
    flags.set(a.slice(2), raw[i + 1]);
    i++;
  } else {
    positional.push(a);
  }
}

if (positional.length === 0) {
  console.error('Usage: node scripts/package-plugin.mjs <plugin-dir> [--id <id>] [--out <dir>]');
  process.exit(1);
}

const pluginDir = resolve(positional[0]);
if (!existsSync(pluginDir) || !statSync(pluginDir).isDirectory()) {
  console.error(`Plugin directory not found: ${pluginDir}`);
  process.exit(1);
}

const outDir = resolve(flags.get('out') ?? join(root, 'examples/dist'));

// ── Read optional manifest ────────────────────────────────────────────────────
let manifestId = null;
let hasBuild = false;
const pkgJsonPath = join(pluginDir, 'package.json');
if (existsSync(pkgJsonPath)) {
  try {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, 'utf8'));
    manifestId = pkg?.zephyr?.pluginId ?? null;
    hasBuild = typeof pkg?.scripts?.build === 'string';
  } catch (err) {
    console.error(`Could not parse ${pkgJsonPath}:`, err.message);
    process.exit(1);
  }
}

const pluginId = flags.get('id') ?? manifestId ?? basename(pluginDir);
if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(pluginId)) {
  console.error(
    `Invalid plugin ID "${pluginId}". Must match ^[a-z0-9][a-z0-9-]*$ (lowercase letters, digits, hyphens).`,
  );
  process.exit(1);
}

// ── Build step ────────────────────────────────────────────────────────────────
if (hasBuild) {
  const nodeModules = join(pluginDir, 'node_modules');
  if (!existsSync(nodeModules)) {
    console.log(`→ Installing build deps for ${basename(pluginDir)}`);
    execSync('npm install', { cwd: pluginDir, stdio: 'inherit', shell: true });
  }
  console.log(`→ Building ${basename(pluginDir)}`);
  execSync('npm run build', { cwd: pluginDir, stdio: 'inherit', shell: true });
}

if (!existsSync(join(pluginDir, 'index.js'))) {
  console.error(`Packaging failed: ${pluginDir} has no index.js`);
  process.exit(1);
}

// ── File selection ────────────────────────────────────────────────────────────
// Directories and files excluded from the packaged output.
//
// Note: `src/` is intentionally NOT denied, because a plugin's runtime code
// may import from `./src/...` directly (plugins that skip bundling). Build
// artifacts like `renderer.js` sit at the plugin root regardless, so keeping
// `src/` in the zip costs a few KB at worst when the template bundles its
// renderer — but breaks plugins that ship source-as-runtime if excluded.
const DENY_NAMES = new Set([
  'node_modules',
  'dist',
  '.git',
  '.gitignore',
  '.gitattributes',
  '.DS_Store',
  'Thumbs.db',
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'esbuild.config.js',
  'rollup.config.js',
]);
const DENY_PATTERNS = [
  /^tsconfig.*\.json$/i,
  /^jsconfig\.json$/i,
  /^vite\.config\./i,
  /^webpack\.config\./i,
];

function shouldInclude(name) {
  if (DENY_NAMES.has(name)) return false;
  if (DENY_PATTERNS.some((p) => p.test(name))) return false;
  return true;
}

/** @type {Record<string, Uint8Array>} */
const files = {};
function walk(dir, rel = '') {
  for (const entry of readdirSync(dir)) {
    if (!shouldInclude(entry)) continue;
    const abs = join(dir, entry);
    const relPath = rel ? `${rel}/${entry}` : entry;
    const s = statSync(abs);
    if (s.isDirectory()) {
      walk(abs, relPath);
    } else if (s.isFile()) {
      files[`${pluginId}/${relPath}`] = new Uint8Array(readFileSync(abs));
    }
  }
}
walk(pluginDir);

if (!(`${pluginId}/index.js` in files)) {
  console.error(`Packaged output is missing ${pluginId}/index.js after filtering`);
  process.exit(1);
}

// ── Write zip ─────────────────────────────────────────────────────────────────
mkdirSync(outDir, { recursive: true });
const zipPath = join(outDir, `${pluginId}.zip`);
const zipBytes = zipSync(files);
writeFileSync(zipPath, zipBytes);

const count = Object.keys(files).length;
const sizeKb = (zipBytes.byteLength / 1024).toFixed(1);
console.log(`✓ Packaged ${pluginId} (${count} files, ${sizeKb} KB) → ${relative(root, zipPath)}`);
