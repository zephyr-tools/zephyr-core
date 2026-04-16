/**
 * Artwork lookup service.
 *
 * Strategy (in order):
 *   1. Steam search API (free, no key) — search by title, get App ID, pull
 *      library_600x900.jpg from Steam CDN. Works for the vast majority of
 *      scene releases since most are Steam games.
 *   2. Gemini grounding (optional, requires API key) — used when Steam search
 *      finds nothing, to locate cover art from IGDB / GOG / official sites.
 *
 * All downloaded images are cached on disk; subsequent calls return file:// URLs.
 */

import path from 'node:path';
import { GoogleGenAI, Type } from '@google/genai';
import type { Artwork } from '@shared/types';
import { net } from 'electron';
import { cachePaths, hashKey, readJson, writeArtworkBlob, writeJson } from './cache.js';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

const STEAM_PORTRAIT_URL = (id: number) =>
  `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;

const GEMINI_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    steam_app_id: {
      type: Type.INTEGER,
      description: 'Steam App ID from store.steampowered.com/app/XXXXXX. Return 0 if not on Steam.',
    },
    image_url: {
      type: Type.STRING,
      description:
        'Direct HTTPS image URL (jpg/png/webp, portrait preferred) from IGDB, GOG, or official site. Empty string if steam_app_id is set.',
    },
  },
  required: ['steam_app_id', 'image_url'],
} as const;

function extFromMime(contentType: string): string {
  const subtype = contentType.split(';')[0]?.trim().split('/').pop() ?? 'jpg';
  if (subtype === 'jpeg') return 'jpg';
  if (/^[a-z0-9]+$/.test(subtype)) return subtype;
  return 'jpg';
}

async function downloadImage(url: string): Promise<{ buf: Buffer; ext: string }> {
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  return { buf, ext: extFromMime(res.headers.get('content-type') ?? 'image/jpeg') };
}

/** Fetch art for a known App ID using appdetails to get confirmed image URLs. */
async function fetchSteamArtById(
  appId: number,
  appName: string,
  title: string,
  key: string,
): Promise<Artwork> {
  const detailsRes = await net.fetch(
    `https://store.steampowered.com/api/appdetails?appids=${appId}&filters=basic`,
  );
  if (!detailsRes.ok) throw new Error(`appdetails HTTP ${detailsRes.status}`);

  const details = (await detailsRes.json()) as {
    [appid: string]: { success: boolean; data?: { type?: string; header_image?: string } };
  };
  const appData = details[String(appId)];
  if (!appData?.success || !appData.data) throw new Error(`appdetails: no data for ${appId}`);

  const {
    type,
    header_image: headerImage,
    fullgame,
  } = appData.data as {
    type?: string;
    header_image?: string;
    fullgame?: { appid?: string; name?: string };
  };

  // DLC: fetch art from the base game and mark it
  if (type === 'dlc' && fullgame?.appid) {
    const baseId = Number(fullgame.appid);
    const baseName = fullgame.name ?? String(baseId);
    const base = await fetchSteamArtById(baseId, baseName, title, key);
    return { ...base, isDlc: true };
  }

  if (type !== 'game') throw new Error(`App ${appId} is "${type}", not a game`);
  if (!headerImage) throw new Error(`appdetails: no header_image for ${appId}`);

  // Prefer portrait art; fall back to the confirmed header image
  const candidates = [STEAM_PORTRAIT_URL(appId), headerImage];
  for (const artUrl of candidates) {
    try {
      const { buf, ext } = await downloadImage(artUrl);
      const file = await writeArtworkBlob(key, ext, buf);
      console.log(`[artwork] Steam hit: "${appName}" (${appId})`);
      return {
        title,
        imageUrl: `artwork://local/${path.basename(file)}`,
        sourceUrl: artUrl,
        fetchedAt: Date.now(),
        origin: 'gemini',
      };
    } catch {
      /* try next candidate */
    }
  }
  throw new Error(`No usable art for App ID ${appId}`);
}

async function fetchSteamArt(title: string, key: string): Promise<Artwork> {
  const res = await net.fetch(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`,
  );
  if (!res.ok) throw new Error(`Steam search HTTP ${res.status}`);

  const data = (await res.json()) as {
    total?: number;
    items?: Array<{ id: number; name: string }>;
  };
  if (!data.items?.length) throw new Error(`No Steam results for "${title}"`);

  // Try each result in order — scene titles sometimes don't match the top hit
  for (const item of data.items.slice(0, 3)) {
    try {
      return await fetchSteamArtById(item.id, item.name, title, key);
    } catch (err) {
      console.log(
        `[artwork] Steam skip app ${item.id} ("${item.name}"): ${(err as Error).message}`,
      );
    }
  }
  throw new Error(`Steam results found but no usable art for "${title}"`);
}

async function fetchGeminiArt(title: string, key: string, apiKey: string): Promise<Artwork> {
  const client = new GoogleGenAI({ apiKey });

  const prompt =
    `Search for the PC video game titled "${title}". ` +
    `If it exists on Steam, return its App ID (the number from store.steampowered.com/app/XXXXXX/). ` +
    `If not on Steam, return a direct image URL for the cover art from IGDB or GOG. ` +
    `Prefer tall portrait cover art (2:3 or 3:4 ratio). Do not fabricate URLs.`;

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
      responseSchema: GEMINI_SCHEMA,
    },
  });

  const text = response.text?.trim();
  if (!text) throw new Error('Gemini returned empty response');

  const parsed = JSON.parse(text) as { steam_app_id?: number; image_url?: string };
  const steamId = typeof parsed.steam_app_id === 'number' ? parsed.steam_app_id : 0;

  if (steamId > 0) {
    return fetchSteamArtById(steamId, String(steamId), title, key);
  }

  const remoteUrl = parsed.image_url;
  if (!remoteUrl || !/^https:\/\//i.test(remoteUrl)) {
    throw new Error(`Gemini returned no usable result for "${title}"`);
  }
  const { buf, ext } = await downloadImage(remoteUrl);
  const file = await writeArtworkBlob(key, ext, buf);
  return {
    title,
    imageUrl: `artwork://local/${path.basename(file)}`,
    sourceUrl: remoteUrl,
    fetchedAt: Date.now(),
    origin: 'gemini',
  };
}

interface ArtworkIndex {
  [key: string]: Artwork;
}

export class ArtworkService {
  private index: ArtworkIndex = {};
  private inflight = new Map<string, Promise<Artwork | null>>();
  private ready: Promise<void>;
  private writeQueue: Promise<void> = Promise.resolve();

  constructor(private getApiKey: () => string | null) {
    this.ready = readJson<ArtworkIndex>(cachePaths.artworkMeta, {}).then((idx) => {
      for (const k of Object.keys(idx)) {
        if (idx[k]?.origin === 'placeholder' || idx[k]?.imageUrl?.startsWith('file://'))
          delete idx[k];
      }
      this.index = idx;
    });
  }

  async get(title: string): Promise<Artwork | null> {
    await this.ready;
    const key = hashKey(title);
    if (this.index[key]) return this.index[key]!;
    return this.fetch(title, false);
  }

  async refresh(title: string): Promise<Artwork | null> {
    await this.ready;
    return this.fetch(title, true);
  }

  async clearCache(): Promise<void> {
    await this.ready;
    this.index = {};
    this.inflight.clear();
    await writeJson(cachePaths.artworkMeta, {});
    const { promises: fs } = await import('node:fs');
    const files = await fs.readdir(cachePaths.artworkDir).catch(() => []);
    await Promise.all(files.map((f) => fs.unlink(`${cachePaths.artworkDir}/${f}`).catch(() => {})));
  }

  private fetch(title: string, force: boolean): Promise<Artwork | null> {
    const key = hashKey(title);
    if (!force && this.inflight.has(key)) return this.inflight.get(key)!;
    const promise = this.doFetch(title, key).finally(() => this.inflight.delete(key));
    this.inflight.set(key, promise);
    return promise;
  }

  private async doFetch(title: string, key: string): Promise<Artwork | null> {
    const apiKey = this.getApiKey();
    let artwork: Artwork | null = null;

    // 1. Try Steam (free, no key needed)
    try {
      artwork = await fetchSteamArt(title, key);
    } catch (steamErr) {
      console.log(`[artwork] Steam miss for "${title}": ${(steamErr as Error).message}`);
    }

    // 2. Try Gemini if Steam failed and a key is available
    if (!artwork && apiKey) {
      try {
        artwork = await fetchGeminiArt(title, key, apiKey);
      } catch (geminiErr) {
        console.warn(`[artwork] Gemini miss for "${title}": ${(geminiErr as Error).message}`);
      }
    }

    if (!artwork) return null;

    this.index[key] = artwork;
    this.writeQueue = this.writeQueue.then(() =>
      writeJson(cachePaths.artworkMeta, this.index).catch((e) =>
        console.warn('[artwork] index persist failed:', (e as Error).message),
      ),
    );
    return artwork;
  }
}
