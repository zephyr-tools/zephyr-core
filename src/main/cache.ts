/**
 * Lightweight on-disk JSON + binary cache living under the Electron
 * `userData` directory. Used for both artwork blobs and the persisted
 * `Artwork` index, plus app settings.
 */

import { createHash } from 'node:crypto';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

const ROOT = path.join(app.getPath('userData'), 'cache');
const ART_DIR = path.join(ROOT, 'artwork');
const META_FILE = path.join(ROOT, 'artwork.json');
const SETTINGS_FILE = path.join(app.getPath('userData'), 'settings.json');

async function ensureDir(dir: string): Promise<void> {
  await fs.mkdir(dir, { recursive: true });
}

export function hashKey(input: string): string {
  return createHash('sha1').update(input.toLowerCase().trim()).digest('hex').slice(0, 24);
}

export async function readJson<T>(file: string, fallback: T): Promise<T> {
  try {
    const text = await fs.readFile(file, 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return fallback;
  }
}

export async function writeJson<T>(file: string, value: T): Promise<void> {
  await ensureDir(path.dirname(file));
  const tmp = `${file}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), 'utf8');
  await fs.rename(tmp, file);
}

export async function writeArtworkBlob(key: string, ext: string, data: Buffer): Promise<string> {
  await ensureDir(ART_DIR);
  const safeExt = ext.replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'img';
  const file = path.join(ART_DIR, `${key}.${safeExt}`);
  await fs.writeFile(file, data);
  return file;
}

export const cachePaths = {
  root: ROOT,
  artworkDir: ART_DIR,
  artworkMeta: META_FILE,
  settings: SETTINGS_FILE,
};
