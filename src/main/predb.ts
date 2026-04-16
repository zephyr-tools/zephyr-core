/**
 * predb data layer.
 *
 * Fetches scene release metadata from api.predb.net and normalizes it into
 * the `ReleaseListResult` shape consumed by the renderer.
 */

import { parseTitle, releaseIdFromName, splitGroup } from '@shared/release-name';
import type { Release, ReleaseListQuery, ReleaseListResult } from '@shared/types';
import { net } from 'electron';

const DEFAULT_ROWS = 50;
const REQUEST_TIMEOUT_MS = 12_000;
const API_BASE = 'https://api.predb.net/';

async function fetchWithTimeout(url: string, init: RequestInit = {}): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await net.fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function normalizeRow(raw: Record<string, unknown>): Release {
  const name = String(raw.release ?? '').trim();
  if (!name) throw new Error('Release row missing name');

  const { group } = splitGroup(name);
  const team = String(raw.group ?? group ?? '').trim() || null;
  const category = String(raw.section ?? '').toUpperCase();
  const pretime = typeof raw.pretime === 'number' ? raw.pretime : null;
  const sizeMb = typeof raw.size === 'number' ? raw.size : null;
  const size = sizeMb !== null ? sizeMb * 1024 * 1024 : null;
  const files = typeof raw.files === 'number' ? raw.files : null;
  const nuke = raw.status === 1 && raw.reason ? String(raw.reason) : null;
  const relUrl = typeof raw.url === 'string' ? raw.url : null;

  return {
    id: String(raw.id ?? releaseIdFromName(name)),
    name,
    team,
    category,
    genre: typeof raw.genre === 'string' && raw.genre ? raw.genre : null,
    pretime,
    size,
    files,
    nuke,
    url: relUrl ? `https://predb.net${relUrl}` : null,
    title: parseTitle(name),
  };
}

export class PredbClient {
  async list(query: ReleaseListQuery): Promise<ReleaseListResult> {
    const url = new URL(API_BASE);
    if (query.q) url.searchParams.set('q', query.q);
    if (query.category) url.searchParams.set('section', query.category.toUpperCase());
    url.searchParams.set('count', String(query.rows ?? DEFAULT_ROWS));
    url.searchParams.set('page', String(query.page ?? 1));

    const started = Date.now();
    const response = await fetchWithTimeout(url.toString());
    if (!response.ok) throw new Error(`predb.net HTTP ${response.status}`);

    const json = (await response.json()) as {
      status?: string;
      message?: string;
      results?: number;
      results_total?: number;
      data?: unknown[];
      page?: number;
    };
    if (json.status && json.status !== 'success') {
      throw new Error(`predb.net: ${json.message ?? 'unknown error'}`);
    }
    const rows = Array.isArray(json.data) ? json.data : [];
    return {
      rows: rows.map((row) => normalizeRow(row as Record<string, unknown>)),
      total: json.results_total ?? rows.length,
      page: json.page ?? query.page ?? 1,
      rows_per_page: query.rows ?? DEFAULT_ROWS,
      source: 'predb.net',
      durationMs: Date.now() - started,
    };
  }
}
