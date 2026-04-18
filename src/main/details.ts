/**
 * Game details lookup service.
 *
 *   get(title)        — Steam storesearch → appdetails. 3 appdetails calls run in
 *                       parallel. If the full title finds nothing, progressively
 *                       shorter prefixes are tried so season/DLC titles fall back
 *                       to the base game.
 *
 *   getTrailer(title) — YouTube Data API v3 (preferred: real IDs, embeddable filter)
 *                       with Gemini grounding as fallback when the YouTube API is
 *                       not enabled for the key.
 */

import { GoogleGenAI, Type } from '@google/genai';
import type { GameDetails, GameTrailer, GroupPrerequisites } from '@shared/types';
import { net } from 'electron';

const GEMINI_MODEL = 'gemini-3.1-flash-lite-preview';

interface SteamAppData {
  type?: string;
  name?: string;
  short_description?: string;
  developers?: string[];
  publishers?: string[];
  release_date?: { coming_soon: boolean; date: string };
  genres?: Array<{ id: string; description: string }>;
  metacritic?: { score: number; url: string };
  screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
  movies?: Array<{
    id: number;
    name: string;
    thumbnail: string;
    mp4?: { '480': string; max: string };
    highlight: boolean;
  }>;
}

async function fetchSteamDetails(appId: number): Promise<GameDetails | null> {
  const res = await net.fetch(
    `https://store.steampowered.com/api/appdetails?appids=${appId}` +
      `&filters=basic,short_description,genres,movies,screenshots,metacritic,release_date,developers,publishers`,
  );
  if (!res.ok) return null;

  const json = (await res.json()) as {
    [id: string]: { success: boolean; data?: SteamAppData };
  };
  const entry = json[String(appId)];
  if (!entry?.success || !entry.data) return null;

  const d = entry.data;
  if (d.type !== 'game') return null;

  let trailer: GameTrailer | undefined;
  const movie = d.movies?.find((m) => m.highlight) ?? d.movies?.[0];
  if (movie?.mp4?.max) {
    const mp4Url = movie.mp4.max.replace(/^http:\/\//i, 'https://');
    trailer = { type: 'steam-mp4', url: mp4Url, thumbnailUrl: movie.thumbnail };
  }

  return {
    title: d.name ?? String(appId),
    steamAppId: appId,
    shortDescription: d.short_description,
    genres: d.genres?.map((g) => g.description),
    developer: d.developers?.[0],
    publisher: d.publishers?.[0],
    releaseDate: d.release_date?.date,
    metacriticScore: d.metacritic?.score,
    screenshots: d.screenshots?.slice(0, 8).map((s) => s.path_full),
    trailer,
    origin: 'steam',
    fetchedAt: Date.now(),
  };
}

/** Try a single search term against Steam; return the first valid game found. */
async function steamSearchTerm(term: string): Promise<GameDetails | null> {
  const res = await net.fetch(
    `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(term)}&l=english&cc=US`,
  );
  if (!res.ok) return null;

  const data = (await res.json()) as { items?: Array<{ id: number }> };
  const ids = data.items?.slice(0, 3).map((i) => i.id) ?? [];
  if (!ids.length) return null;

  const results = await Promise.allSettled(ids.map((id) => fetchSteamDetails(id)));
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value !== null) return r.value;
  }
  return null;
}

/**
 * Search Steam with progressive title shortening.
 * "Last Epoch Shattered Omens" → "Last Epoch Shattered" → "Last Epoch"
 * Handles season updates and DLC that don't have their own Steam page.
 */
async function steamSearch(title: string): Promise<GameDetails | null> {
  const words = title.trim().split(/\s+/);

  for (let len = words.length; len >= 1; len--) {
    const term = words.slice(0, len).join(' ');
    try {
      const result = await steamSearchTerm(term);
      if (result) {
        if (len < words.length) {
          console.log(`[details] Steam: matched "${term}" for full title "${title}"`);
        }
        return result;
      }
    } catch (err) {
      console.log(`[details] Steam error for "${term}": ${(err as Error).message}`);
    }
  }
  return null;
}

interface YouTubeSearchItem {
  id: { videoId: string };
  snippet: { title: string; channelTitle: string };
}

interface YouTubeSearchResponse {
  items?: YouTubeSearchItem[];
  error?: { status: string; message: string };
}

/**
 * Search YouTube Data API v3 for an embeddable trailer.
 * Throws 'youtube-api-disabled' if the key doesn't have the API enabled.
 */
async function fetchTrailerByYouTubeApi(
  title: string,
  apiKey: string,
): Promise<GameTrailer | null> {
  const url =
    `https://www.googleapis.com/youtube/v3/search` +
    `?key=${encodeURIComponent(apiKey)}` +
    `&q=${encodeURIComponent(`${title} official trailer`)}` +
    `&type=video&part=snippet&maxResults=5&videoEmbeddable=true&order=relevance`;

  const res = await net.fetch(url);
  const data = (await res.json()) as YouTubeSearchResponse;

  if (!res.ok) {
    const status = data.error?.status ?? '';
    if (res.status === 403 || status === 'PERMISSION_DENIED' || status === 'API_KEY_INVALID') {
      throw new Error('youtube-api-disabled');
    }
    console.warn(`[trailer] YouTube API error ${res.status}:`, data.error?.message);
    return null;
  }

  const videoId = data.items?.[0]?.id?.videoId;
  if (!videoId) return null;

  const snippet = data.items?.[0]?.snippet;
  console.log(
    `[trailer] YouTube API hit for "${title}": ${videoId} - "${snippet?.title}" by ${snippet?.channelTitle}`,
  );
  return { type: 'youtube', url: videoId };
}

function extractAllYouTubeIds(text: string): string[] {
  const patterns = [
    /youtube\.com\/watch\?[^"'\s]*v=([a-zA-Z0-9_-]{11})/g,
    /youtu\.be\/([a-zA-Z0-9_-]{11})/g,
    /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/g,
    /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/g,
  ];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const re of patterns) {
    for (const m of text.matchAll(re)) {
      const id = m[1];
      if (id && !seen.has(id)) {
        seen.add(id);
        ids.push(id);
      }
    }
  }
  return ids;
}

async function validateYouTubeId(id: string): Promise<boolean> {
  try {
    const res = await net.fetch(
      `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${id}&format=json`,
    );
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchTrailerByGemini(title: string, apiKey: string): Promise<GameTrailer | null> {
  const client = new GoogleGenAI({ apiKey });

  const response = await client.models.generateContent({
    model: GEMINI_MODEL,
    contents:
      `Find YouTube trailer videos for the video game "${title}". ` +
      `List several options in order of preference: official trailer first, ` +
      `then base-game trailer if this is DLC, then gameplay or fan-made videos as a last resort. ` +
      `Include the full YouTube URLs.`,
    config: { tools: [{ googleSearch: {} }] },
  });

  const text = response.text?.trim();
  console.log(`[trailer] Gemini response for "${title}":\n${text}`);
  if (!text) return null;

  const ids = extractAllYouTubeIds(text);
  console.log(`[trailer] Gemini candidates for "${title}":`, ids);

  for (const id of ids) {
    if (await validateYouTubeId(id)) {
      console.log(`[trailer] Gemini valid ID for "${title}": ${id}`);
      return { type: 'youtube', url: id };
    }
  }
  return null;
}

export class GameDetailsService {
  private detailsCache = new Map<string, GameDetails>();
  private trailerCache = new Map<string, GameTrailer | null>();
  private prereqCache = new Map<string, GroupPrerequisites>();
  private detailsInflight = new Map<string, Promise<GameDetails>>();
  private trailerInflight = new Map<string, Promise<GameTrailer | null>>();
  private prereqInflight = new Map<string, Promise<GroupPrerequisites>>();
  private youtubeApiDisabled = false;

  constructor(
    private getApiKey: () => string | null,
    private getYouTubeApiKey: () => string | null = () => null,
  ) {}

  get(title: string): Promise<GameDetails> {
    const key = title.toLowerCase().trim();
    const cached = this.detailsCache.get(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.detailsInflight.get(key);
    if (inFlight) return inFlight;

    const promise = this.fetchDetails(title, key).finally(() => this.detailsInflight.delete(key));
    this.detailsInflight.set(key, promise);
    return promise;
  }

  getTrailer(title: string): Promise<GameTrailer | null> {
    const key = title.toLowerCase().trim();
    if (this.trailerCache.has(key)) return Promise.resolve(this.trailerCache.get(key) ?? null);

    const inFlight = this.trailerInflight.get(key);
    if (inFlight) return inFlight;

    const apiKey = this.getApiKey();
    if (!apiKey) return Promise.resolve(null);

    const promise = (async () => {
      try {
        const trailer = await this.fetchTrailer(title, apiKey);
        this.trailerCache.set(key, trailer);
        return trailer;
      } catch (err) {
        console.warn(`[trailer] failed for "${title}": ${(err as Error).message}`);
        this.trailerCache.set(key, null);
        return null;
      } finally {
        this.trailerInflight.delete(key);
      }
    })();

    this.trailerInflight.set(key, promise);
    return promise;
  }

  private async fetchTrailer(title: string, apiKey: string): Promise<GameTrailer | null> {
    const ytKey = this.getYouTubeApiKey();
    if (!this.youtubeApiDisabled && ytKey) {
      try {
        const trailer = await fetchTrailerByYouTubeApi(title, ytKey);
        if (trailer) return trailer;
      } catch (err) {
        if ((err as Error).message === 'youtube-api-disabled') {
          console.log('[trailer] YouTube Data API not enabled - falling back to Gemini');
          this.youtubeApiDisabled = true;
        } else {
          throw err;
        }
      }
    }

    return fetchTrailerByGemini(title, apiKey);
  }

  private async fetchDetails(title: string, key: string): Promise<GameDetails> {
    let result: GameDetails;
    try {
      const steam = await steamSearch(title);
      result = steam ?? { title, origin: 'none', fetchedAt: Date.now() };
    } catch (err) {
      console.log(`[details] Steam error for "${title}": ${(err as Error).message}`);
      result = { title, origin: 'none', fetchedAt: Date.now() };
    }
    this.detailsCache.set(key, result);
    return result;
  }

  getGroupPrerequisites(group: string, releaseName: string): Promise<GroupPrerequisites> {
    const key = group.toLowerCase().trim();
    const cached = this.prereqCache.get(key);
    if (cached) return Promise.resolve(cached);

    const inFlight = this.prereqInflight.get(key);
    if (inFlight) return inFlight;

    const none: GroupPrerequisites = {
      group,
      summary: '',
      prerequisites: [],
      installSteps: [],
      origin: 'none',
    };

    const apiKey = this.getApiKey();
    if (!apiKey || !group) {
      this.prereqCache.set(key, none);
      return Promise.resolve(none);
    }

    const promise = (async () => {
      try {
        const result = await fetchGroupPrerequisites(group, releaseName, apiKey);
        this.prereqCache.set(key, result);
        return result;
      } catch (err) {
        console.warn(`[prereqs] failed for "${group}": ${(err as Error).message}`);
        this.prereqCache.set(key, none);
        return none;
      } finally {
        this.prereqInflight.delete(key);
      }
    })();

    this.prereqInflight.set(key, promise);
    return promise;
  }
}

const PREREQ_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.STRING,
      description:
        'One or two sentences describing the scene group, what kind of releases they produce (repacks, cracks, etc.) and their general reputation.',
    },
    prerequisites: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'List of software or runtimes the user must install BEFORE running this group\'s releases. Examples: "DirectX End-User Runtime", "Visual C++ Redistributable 2015-2022 (x64)", ".NET Framework 4.8". Only include items that are genuinely required — do not list Windows itself or obvious things.',
    },
    install_steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description:
        'Step-by-step installation instructions typical for releases from this group. Be specific — e.g. "Mount the ISO or extract with 7-Zip", "Run setup.exe as administrator", "Copy crack files from CODEX folder to install directory".',
    },
  },
  required: ['summary', 'prerequisites', 'install_steps'],
} as const;

interface GeminiPrereqResponse {
  summary?: string;
  prerequisites?: string[];
  install_steps?: string[];
}

async function fetchGroupPrerequisites(
  group: string,
  releaseName: string,
  apiKey: string,
): Promise<GroupPrerequisites> {
  const ai = new GoogleGenAI({ apiKey });
  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: `I have a PC game scene release called "${releaseName}" from the group "${group}". What software prerequisites does a user need to install before running releases from this group, and what are the typical installation steps? Search the web for current information about this specific group.`,
          },
        ],
      },
    ],
    config: {
      temperature: 0.2,
      tools: [{ googleSearch: {} }],
      responseMimeType: 'application/json',
      responseSchema: PREREQ_SCHEMA,
    },
  });

  const text = res.text?.trim();
  if (!text) return { group, summary: '', prerequisites: [], installSteps: [], origin: 'none' };

  const parsed = JSON.parse(text) as GeminiPrereqResponse;
  return {
    group,
    summary: parsed.summary ?? '',
    prerequisites: parsed.prerequisites ?? [],
    installSteps: parsed.install_steps ?? [],
    origin: 'gemini',
  };
}
