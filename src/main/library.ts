import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { InstallStatus, LibraryEntry, LibraryListResult, LibraryReleaseInfo } from '@shared/types';
import { app } from 'electron';

export class LibraryService {
  private entries = new Map<string, LibraryEntry>();
  private readonly filePath: string;

  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'library.json');
  }

  async init(): Promise<void> {
    try {
      const raw = await readFile(this.filePath, 'utf-8');
      const data = JSON.parse(raw) as LibraryEntry[];
      for (const entry of data) {
        this.entries.set(entry.id, entry);
      }
    } catch {
      // no existing file — fresh start
    }
  }

  private async save(): Promise<void> {
    await writeFile(this.filePath, JSON.stringify([...this.entries.values()], null, 2));
  }

  list(page = 1, perPage = 20): LibraryListResult {
    const all = [...this.entries.values()].sort((a, b) => b.addedAt - a.addedAt);
    const start = (page - 1) * perPage;
    return { entries: all.slice(start, start + perPage), total: all.length, page, perPage };
  }

  getEntry(id: string): LibraryEntry | undefined {
    return this.entries.get(id);
  }

  /** Called immediately when a download is queued, so the entry survives restarts. */
  async onJobAdded(
    infoHash: string,
    savePath: string,
    totalSize: number,
    addedAt: number,
    releaseInfo: LibraryReleaseInfo,
  ): Promise<void> {
    if (this.entries.has(infoHash)) return;
    const entry: LibraryEntry = {
      id: infoHash,
      releaseName: releaseInfo.releaseName,
      releaseTitle: releaseInfo.releaseTitle,
      team: releaseInfo.team,
      category: releaseInfo.category,
      artworkTitle: releaseInfo.releaseTitle,
      addedAt,
      savePath,
      totalSize,
      installStatus: 'downloading',
    };
    this.entries.set(infoHash, entry);
    await this.save();
  }

  /** Called when a download transitions to seeding (after scan resolves). Returns the updated entry, or undefined if not in the library. */
  async onJobComplete(infoHash: string, savePath: string): Promise<LibraryEntry | undefined> {
    const entry = this.entries.get(infoHash);
    if (!entry) return undefined;
    const installStatus: InstallStatus = entry.executablePath ? 'verified' : 'unlocated';
    const updated: LibraryEntry = {
      ...entry,
      completedAt: Date.now(),
      savePath,
      installStatus,
    };
    this.entries.set(infoHash, updated);
    await this.save();
    return updated;
  }

  /** Add a new entry. No-op if an entry with the same id already exists. */
  async add(entry: LibraryEntry): Promise<void> {
    if (this.entries.has(entry.id)) return;
    this.entries.set(entry.id, entry);
    await this.save();
  }

  async update(id: string, patch: Partial<LibraryEntry>): Promise<void> {
    const existing = this.entries.get(id);
    if (!existing) return;
    this.entries.set(id, { ...existing, ...patch });
    await this.save();
  }

  async remove(id: string): Promise<void> {
    this.entries.delete(id);
    await this.save();
  }

  async verifyAll(): Promise<void> {
    let changed = false;
    for (const [id, entry] of this.entries) {
      if (!entry.executablePath || entry.installStatus === 'downloading') continue;
      const next: InstallStatus = existsSync(entry.executablePath) ? 'verified' : 'missing';
      if (next !== entry.installStatus) {
        this.entries.set(id, { ...entry, installStatus: next });
        changed = true;
      }
    }
    if (changed) await this.save();
  }
}
