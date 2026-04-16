import { net } from 'electron';

const NEWTRACKON_URL = 'https://newtrackon.com/api/all';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

let cached: string[] = [];
let cachedAt = 0;

/**
 * Returns a list of stable public trackers from newtrackon.com.
 * Results are cached in-memory for 24 hours; stale cache is used on error.
 */
export async function getTrackers(): Promise<string[]> {
  const now = Date.now();
  if (cached.length > 0 && now - cachedAt < CACHE_TTL_MS) return cached;

  try {
    const res = await net.fetch(NEWTRACKON_URL, { headers: { Accept: 'text/plain' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const trackers = text
      .split('\n')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);
    if (trackers.length > 0) {
      cached = trackers;
      cachedAt = now;
    }
  } catch {
    // Fall through — return stale cache or empty list
  }

  return cached;
}
