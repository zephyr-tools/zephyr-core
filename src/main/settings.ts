import type { AppSettings } from '@shared/types';
import { cachePaths, readJson, writeJson } from './cache.js';

const DEFAULTS: AppSettings = {
  geminiApiKey: process.env.GEMINI_API_KEY ?? null,
  youtubeApiKey: process.env.YOUTUBE_API_KEY ?? null,
  realDebridApiKey: null,
  virusTotalApiKey: null,
  autoStartEnabled: false,
};

export class SettingsStore {
  private current: AppSettings = DEFAULTS;
  private ready: Promise<void>;

  constructor() {
    this.ready = readJson<Partial<AppSettings>>(cachePaths.settings, {}).then((stored) => {
      // Merge stored values over defaults, but only when the stored value is
      // non-null so that env-based defaults (GEMINI_API_KEY, etc.) aren't
      // wiped out by a previously-saved null.
      this.current = { ...DEFAULTS };
      for (const key of Object.keys(stored) as (keyof AppSettings)[]) {
        const v = stored[key];
        if (v != null && v !== '') {
          (this.current as unknown as Record<string, unknown>)[key] = v;
        }
      }
    });
  }

  async get(): Promise<AppSettings> {
    await this.ready;
    return this.current;
  }

  async set(patch: Partial<AppSettings>): Promise<AppSettings> {
    await this.ready;
    this.current = { ...this.current, ...patch };
    await writeJson(cachePaths.settings, this.current);
    return this.current;
  }

  /** Synchronous access — only safe to use after `get()` has resolved once. */
  snapshot(): AppSettings {
    return this.current;
  }
}
