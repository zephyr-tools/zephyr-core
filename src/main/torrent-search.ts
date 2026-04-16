import type { TorrentResult } from '@shared/types';
import { net } from 'electron';
import { getTrackers } from './tracker-list.js';

// ---- The Pirate Bay via apibay.org ----------------------------------------

interface TpbRow {
  info_hash: string;
  name: string;
  size: string;
  seeders: string;
  leechers: string;
  category: string;
  added: string;
}

async function searchTpb(query: string): Promise<TorrentResult[]> {
  const url = `https://apibay.org/q.php?q=${encodeURIComponent(query)}&cat=0`;
  const res = await net.fetch(url);
  if (!res.ok) throw new Error(`TPB search failed: HTTP ${res.status}`);

  const data = (await res.json()) as TpbRow[];

  if (
    !Array.isArray(data) ||
    (data.length === 1 && data[0]?.info_hash === '0000000000000000000000000000000000000000')
  ) {
    return [];
  }

  const trackers = await getTrackers();
  const trackerParams = trackers
    .slice(0, 12)
    .map((t) => `&tr=${encodeURIComponent(t)}`)
    .join('');

  return data.map((r): TorrentResult => {
    const infoHash = r.info_hash.toLowerCase();
    const magnetUri = `magnet:?xt=urn:btih:${infoHash}&dn=${encodeURIComponent(r.name)}${trackerParams}`;
    return {
      infoHash,
      name: r.name,
      size: parseInt(r.size, 10) || 0,
      seeders: parseInt(r.seeders, 10) || 0,
      leechers: parseInt(r.leechers, 10) || 0,
      magnetUri,
      source: 'tpb',
      category: r.category,
      uploadedAt: r.added ? parseInt(r.added, 10) * 1000 : undefined,
    };
  });
}

// ---- Query derivation -----------------------------------------------------

/** Strip scene group tag, dots→spaces, remove common noise tags. */
function cleanSceneName(name: string): string {
  return (
    name
      // Remove group tag: everything after the last hyphen (e.g., -RELOADED)
      .replace(/-[A-Za-z0-9]+$/, '')
      // Dots and underscores → spaces
      .replace(/[._]/g, ' ')
      // Remove common scene tags
      .replace(
        /\b(MULTi\d*|PROPER|REPACK|INTERNAL|READNFO|DIRFIX|NFOFIX|iNTERNAL|x86|x64|v\d[\d.]*)\b/gi,
        '',
      )
      // Collapse whitespace
      .replace(/\s{2,}/g, ' ')
      .trim()
  );
}

/** Build a deduplicated set of useful search queries from a scene name + title. */
function deriveQueries(name: string, title: string): string[] {
  const queries: string[] = [];
  const seen = new Set<string>();

  const add = (q: string): void => {
    const key = q.toLowerCase().trim();
    if (key.length > 1 && !seen.has(key)) {
      seen.add(key);
      queries.push(key);
    }
  };

  // 1. Parsed title — broadest, most likely to return results
  add(title);

  // 2. Cleaned scene name — keeps version/edition hints but drops noise
  add(cleanSceneName(name));

  // 3. Full scene name with dots→spaces — for exact scene-match hunting
  add(name.replace(/[._]/g, ' '));

  return queries;
}

// ---- Filtering ------------------------------------------------------------

/** Scene convention: name must end with `-GROUP` (alphanumeric, 2+ chars). */
const GROUP_TAG_RE = /-[A-Za-z0-9]{2,}$/;

function hasGroupTag(name: string): boolean {
  return GROUP_TAG_RE.test(name.trim());
}

// ---- Public entry point ---------------------------------------------------

export async function searchTorrents(name: string, title: string): Promise<TorrentResult[]> {
  const queries = deriveQueries(name, title);

  // Run all queries in parallel
  const batches = await Promise.all(
    queries.map((q) => searchTpb(q).catch(() => [] as TorrentResult[])),
  );

  // Deduplicate by infoHash, preserving first-seen order
  const seen = new Set<string>();
  const merged: TorrentResult[] = [];
  for (const batch of batches) {
    for (const r of batch) {
      if (!seen.has(r.infoHash) && hasGroupTag(r.name)) {
        seen.add(r.infoHash);
        merged.push(r);
      }
    }
  }

  return merged.sort((a, b) => b.seeders - a.seeders);
}
