import fs from 'node:fs/promises';
import path from 'node:path';
import type { DownloadJob, DownloadStatus } from '@shared/types';
import type { BrowserWindow } from 'electron';
import { app } from 'electron';
import type WebTorrent from 'webtorrent';
import type { Torrent } from 'webtorrent';
import { getTrackers } from './tracker-list.js';

const STATE_FILE = path.join(app.getPath('userData'), 'downloads.json');

interface PersistedJob {
  infoHash: string;
  name: string;
  magnetUri: string;
  savePath: string;
  addedAt: number;
  status: DownloadStatus;
  origin: 'webtorrent' | 'real-debrid';
}

export function displayNameFromMagnet(magnetUri: string): string {
  try {
    const dn = new URLSearchParams(magnetUri.split('?')[1] ?? '').get('dn');
    return dn ? decodeURIComponent(dn.replace(/\+/g, ' ')) : magnetUri.slice(20, 60);
  } catch {
    return 'Unknown torrent';
  }
}

/** Guard against NaN/undefined that WebTorrent returns before metadata resolves. */
function num(v: number | undefined | null): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

function jobFromTorrent(torrent: Torrent, base: DownloadJob): DownloadJob {
  return {
    ...base,
    name: torrent.name || base.name,
    progress: num(torrent.progress),
    downloadSpeed: num(torrent.downloadSpeed),
    uploadSpeed: num(torrent.uploadSpeed),
    numPeers: num(torrent.numPeers),
    totalSize: num(torrent.length) || base.totalSize,
    downloaded: num(torrent.downloaded),
    status:
      base.status === 'error'
        ? 'error'
        : torrent.paused
          ? 'paused'
          : torrent.done
            ? 'seeding'
            : 'downloading',
  };
}

export class TorrentClient {
  private wt: InstanceType<typeof WebTorrent> | null = null;
  private jobs = new Map<string, DownloadJob>();
  private progressTimer: ReturnType<typeof setInterval> | null = null;
  private onComplete: ((job: DownloadJob) => void) | null = null;

  constructor(private getWindow: () => BrowserWindow | null) {}

  /** wt.get() is async in v2.8.5 — use the torrents array for sync lookup. */
  private _getTorrent(infoHash: string): Torrent | undefined {
    return this.wt?.torrents.find((t) => t.infoHash === infoHash);
  }

  /** Register a callback that fires when any job completes (transitions to 'seeding'). */
  setOnComplete(cb: (job: DownloadJob) => void): void {
    this.onComplete = cb;
  }

  async init(): Promise<void> {
    const { default: WebTorrent } = await import('webtorrent');
    this.wt = new WebTorrent();
    this.wt.on('error', (err) => console.error('[TorrentClient]', err.message));

    try {
      const raw = await fs.readFile(STATE_FILE, 'utf-8');
      const saved = JSON.parse(raw) as PersistedJob[];
      for (const job of saved) {
        // Skip Real-Debrid jobs — they don't need a live WebTorrent instance
        if (job.origin === 'real-debrid') {
          this.jobs.set(job.infoHash, {
            infoHash: job.infoHash,
            name: job.name,
            magnetUri: job.magnetUri,
            savePath: job.savePath,
            progress: job.status === 'seeding' ? 1 : 0,
            downloadSpeed: 0,
            uploadSpeed: 0,
            numPeers: 0,
            status: job.status === 'downloading' ? 'paused' : job.status,
            totalSize: 0,
            downloaded: 0,
            addedAt: job.addedAt,
            origin: 'real-debrid',
          });
          continue;
        }
        if (job.status === 'downloading' || job.status === 'queued') {
          await this._addMagnet(job.magnetUri, job.savePath, job.addedAt).catch((err: Error) => {
            this.jobs.set(job.infoHash, {
              infoHash: job.infoHash,
              name: job.name,
              magnetUri: job.magnetUri,
              savePath: job.savePath,
              progress: 0,
              downloadSpeed: 0,
              uploadSpeed: 0,
              numPeers: 0,
              status: 'error',
              totalSize: 0,
              downloaded: 0,
              addedAt: job.addedAt,
              origin: 'webtorrent',
              error: err.message,
            });
          });
        } else {
          this.jobs.set(job.infoHash, {
            infoHash: job.infoHash,
            name: job.name,
            magnetUri: job.magnetUri,
            savePath: job.savePath,
            progress: job.status === 'seeding' ? 1 : 0,
            downloadSpeed: 0,
            uploadSpeed: 0,
            numPeers: 0,
            status: job.status,
            totalSize: 0,
            downloaded: 0,
            addedAt: job.addedAt,
            origin: 'webtorrent',
          });
        }
      }
    } catch {
      // no saved state
    }

    this.progressTimer = setInterval(() => this._broadcast(), 1000);
  }

  async add(magnetUri: string, expectedSize?: number): Promise<DownloadJob> {
    return this._addMagnet(magnetUri, app.getPath('downloads'), Date.now(), expectedSize);
  }

  /** Insert a job managed externally (e.g. Real-Debrid). */
  trackExternal(job: DownloadJob): void {
    this.jobs.set(job.infoHash, job);
    void this._save();
  }

  /** Update an externally-managed job (progress, status, etc.). */
  updateExternal(infoHash: string, patch: Partial<DownloadJob>): void {
    const existing = this.jobs.get(infoHash);
    if (existing) {
      const updated = { ...existing, ...patch };
      this.jobs.set(infoHash, updated);
      void this._save();
      if (existing.status !== 'seeding' && updated.status === 'seeding' && this.onComplete) {
        this.onComplete(updated);
      }
    }
  }

  private async _addMagnet(
    magnetUri: string,
    savePath: string,
    addedAt: number,
    expectedSize?: number,
  ): Promise<DownloadJob> {
    if (!this.wt) throw new Error('TorrentClient not initialized');

    const hashMatch = /urn:btih:([a-fA-F0-9]{40})/i.exec(magnetUri);
    if (!hashMatch?.[1]) throw new Error('Invalid magnet URI - no btih hash found');
    const infoHash = hashMatch[1].toLowerCase();

    if (this.jobs.has(infoHash)) return this.jobs.get(infoHash)!;

    const displayName = displayNameFromMagnet(magnetUri);
    const placeholder: DownloadJob = {
      infoHash,
      name: displayName,
      magnetUri,
      savePath,
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      status: 'queued',
      totalSize: expectedSize ?? 0,
      downloaded: 0,
      addedAt,
      origin: 'webtorrent',
    };
    this.jobs.set(infoHash, placeholder);
    void this._save();

    const trackers = await getTrackers();

    return new Promise<DownloadJob>((resolve, reject) => {
      const onGlobalError = (err: Error): void => reject(err);
      this.wt!.once('error', onGlobalError);

      this.wt!.add(magnetUri, { path: savePath, announce: trackers }, (torrent) => {
        // Remove the global listener now that the add succeeded
        this.wt!.removeListener('error', onGlobalError);

        const job = jobFromTorrent(torrent, { ...placeholder, status: 'downloading' });
        this.jobs.set(torrent.infoHash, job);
        void this._save();

        torrent.on('error', (err) => {
          const j = this.jobs.get(torrent.infoHash);
          if (j) {
            this.jobs.set(torrent.infoHash, { ...j, status: 'error', error: err.message });
            void this._save();
          }
        });

        torrent.on('done', () => {
          const j = this.jobs.get(torrent.infoHash);
          if (j) {
            const revealPath = torrent.name ? path.join(j.savePath, torrent.name) : j.savePath;
            const completed = {
              ...j,
              status: 'seeding' as const,
              progress: 1,
              revealPath,
            };
            this.jobs.set(torrent.infoHash, completed);
            void this._save();
            if (this.onComplete) this.onComplete(completed);
          }
        });

        resolve(job);
      });
    });
  }

  pause(infoHash: string): void {
    this._getTorrent(infoHash)?.pause();
    const job = this.jobs.get(infoHash);
    if (job) {
      this.jobs.set(infoHash, { ...job, status: 'paused' });
      void this._save();
    }
  }

  resume(infoHash: string): void {
    this._getTorrent(infoHash)?.resume();
    const job = this.jobs.get(infoHash);
    if (job) {
      this.jobs.set(infoHash, { ...job, status: 'downloading' });
      void this._save();
    }
  }

  async remove(infoHash: string, deleteFiles = false): Promise<void> {
    const torrent = this._getTorrent(infoHash);
    if (torrent) {
      return new Promise<void>((resolve) => {
        this.wt!.remove(infoHash, { destroyStore: deleteFiles }, () => {
          this.jobs.delete(infoHash);
          void this._save();
          resolve();
        });
      });
    }
    this.jobs.delete(infoHash);
    void this._save();
  }

  list(): DownloadJob[] {
    return [...this.jobs.values()].map((job) => {
      if (job.origin === 'real-debrid') return job;
      const torrent = this._getTorrent(job.infoHash);
      return torrent ? jobFromTorrent(torrent, job) : job;
    });
  }

  destroy(): void {
    if (this.progressTimer) {
      clearInterval(this.progressTimer);
      this.progressTimer = null;
    }
    this.wt?.destroy();
  }

  private _broadcast(): void {
    const win = this.getWindow();
    if (!win || win.isDestroyed()) return;
    win.webContents.send('torrent:progress', this.list());
  }

  private async _save(): Promise<void> {
    const data: PersistedJob[] = [...this.jobs.values()].map((j) => ({
      infoHash: j.infoHash,
      name: j.name,
      magnetUri: j.magnetUri,
      savePath: j.savePath,
      addedAt: j.addedAt,
      status: j.status,
      origin: j.origin ?? 'webtorrent',
    }));
    await fs.writeFile(STATE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  }
}
