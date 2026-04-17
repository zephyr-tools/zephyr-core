/**
 * Extracts DownloadJob and its dependent types from src/shared/types.ts and
 * splices them into the <generated> block in examples/plugins/zephyr-plugin.d.ts.
 *
 * Run: npm run generate:plugin-types
 * CI:  runs automatically before typecheck on every release tag push.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Extracts `export interface <name> { ... }` (handles nested braces). */
function extractInterface(src, name) {
  const marker = `export interface ${name}`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Interface "${name}" not found`);
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) return src.slice(start, i + 1);
  }
  throw new Error(`Unterminated interface "${name}"`);
}

/** Extracts `export type <name> = ...;` (single statement, ends at semicolon). */
function extractTypeAlias(src, name) {
  const marker = `export type ${name}`;
  const start = src.indexOf(marker);
  if (start === -1) throw new Error(`Type alias "${name}" not found`);
  const end = src.indexOf(';', start);
  if (end === -1) throw new Error(`Unterminated type alias "${name}"`);
  return src.slice(start, end + 1);
}

const sharedSrc = readFileSync(resolve(root, 'src/shared/types.ts'), 'utf8');

const generated = [
  extractTypeAlias(sharedSrc, 'DownloadStatus'),
  extractTypeAlias(sharedSrc, 'ScanStatus'),
  extractTypeAlias(sharedSrc, 'RdPhase'),
  extractInterface(sharedSrc, 'DownloadJob'),
].join('\n\n');

const dtsPath = resolve(root, 'examples/plugins/zephyr-plugin.d.ts');
const dts = readFileSync(dtsPath, 'utf8');

const OPEN = '// <generated>';
const CLOSE = '// </generated>';
const startIdx = dts.indexOf(OPEN);
const endIdx = dts.indexOf(CLOSE);
if (startIdx === -1 || endIdx === -1) {
  throw new Error('<generated> markers not found in zephyr-plugin.d.ts');
}

const block = [
  OPEN,
  '// Auto-generated from src/shared/types.ts — do not edit manually.',
  '// Run `npm run generate:plugin-types` to update.',
  generated,
  CLOSE,
].join('\n');

const updated = dts.slice(0, startIdx) + block + dts.slice(endIdx + CLOSE.length);
writeFileSync(dtsPath, updated, 'utf8');
console.log('✓ Generated DownloadJob and dependent types in examples/plugins/zephyr-plugin.d.ts');
