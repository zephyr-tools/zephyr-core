import fs from 'node:fs';
import path from 'node:path';
import type { DownloadJob } from '@shared/types';
import { app, net } from 'electron';
import type { TorrentClient } from './torrent-client.js';

const API_BASE = 'https://api.real-debrid.com/rest/1.0';

// ---- API response types ---------------------------------------------------

interface RdAddMagnetResponse {
  id: string;
  uri: string;
}

interface RdTorrentInfo {
  id: string;
  filename: string;
  hash: string;
  bytes: number;
  progress: number; // 0–100
  status: string;
  links: string[];
  speed: number;
  seeders: number;
}

interface RdUnrestrictResponse {
  download: string;
  filename: string;
  filesize: number;
}

const RD_ERROR_STATUSES = new Set(['error', 'virus', 'dead', 'magnet_error']);
const RD_PROGRESS_STATUSES = new Set([
  'downloading',
  'queued',
  'compressing',
  'uploading',
  'magnet_conversion',
  'waiting_files_selection',
]);

// ---- Service --------------------------------------------------------------

export class RealDebridService {
  private polls = new Map<string, ReturnType<typeof setInterval>>();

  constructor(
    private getApiKey: () => string | null,
    private client: TorrentClient,
  ) {}

  private authHeaders(): Record<string, string> {
    const key = this.getApiKey();
    if (!key) throw new Error('Real-Debrid API key not configured');
    return { Authorization: `Bearer ${key}` };
  }

  private async api<T>(method: string, apiPath: string, body?: Record<string, string>): Promise<T> {
    const url = `${API_BASE}${apiPath}`;
    const headers: Record<string, string> = { ...this.authHeaders() };
    let reqBody: string | undefined;
    if (body) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      reqBody = new URLSearchParams(body).toString();
    }
    const res = await net.fetch(url, { method, headers, body: reqBody });
    if (res.status === 204) return undefined as T;
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(err.error ?? `Real-Debrid HTTP ${res.status}`);
    }
    return res.json() as Promise<T>;
  }

  // ---- Public API ---------------------------------------------------------

  async download(magnetUri: string, expectedSize?: number): Promise<DownloadJob> {
    const hashMatch = /urn:btih:([a-fA-F0-9]{40})/i.exec(magnetUri);
    if (!hashMatch?.[1]) throw new Error('Invalid magnet URI');
    const infoHash = hashMatch[1].toLowerCase();

    // 1. Submit magnet
    const { id: rdId } = await this.api<RdAddMagnetResponse>('POST', '/torrents/addMagnet', {
      magnet: magnetUri,
    });

    // 2. Select all files
    await this.api<void>('POST', `/torrents/selectFiles/${rdId}`, { files: 'all' });

    // 3. Create tracked job
    const job: DownloadJob = {
      infoHash,
      name: displayNameFromMagnet(magnetUri),
      magnetUri,
      savePath: app.getPath('downloads'),
      progress: 0,
      downloadSpeed: 0,
      uploadSpeed: 0,
      numPeers: 0,
      status: 'queued',
      totalSize: expectedSize ?? 0,
      downloaded: 0,
      addedAt: Date.now(),
      origin: 'real-debrid',
    };
    this.client.trackExternal(job);

    // 4. Start polling RD for completion
    this._poll(infoHash, rdId);

    return job;
  }

  destroy(): void {
    for (const timer of this.polls.values()) clearInterval(timer);
    this.polls.clear();
  }

  // ---- Internals ----------------------------------------------------------

  private _poll(infoHash: string, rdId: string): void {
    const timer = setInterval(async () => {
      try {
        const info = await this.api<RdTorrentInfo>('GET', `/torrents/info/${rdId}`);

        if (info.status === 'downloaded') {
          clearInterval(timer);
          this.polls.delete(infoHash);
          this.client.updateExternal(infoHash, {
            name: info.filename || infoHash,
            totalSize: info.bytes,
            progress: 0.5, // RD phase done — local transfer starts
            status: 'downloading',
            downloadSpeed: 0,
          });
          await this._transferFiles(infoHash, info.links, info.bytes);
        } else if (RD_PROGRESS_STATUSES.has(info.status)) {
          const rdProgress = info.progress / 100; // 0–1
          this.client.updateExternal(infoHash, {
            name: info.filename || infoHash,
            totalSize: info.bytes || 0,
            downloaded: Math.round((info.bytes || 0) * rdProgress),
            progress: rdProgress * 0.5, // 0–50% for RD phase
            downloadSpeed: info.speed || 0,
            numPeers: info.seeders || 0,
            status: 'downloading',
          });
        } else if (RD_ERROR_STATUSES.has(info.status)) {
          clearInterval(timer);
          this.polls.delete(infoHash);
          // Clean up the RD torrent
          await this.api<void>('DELETE', `/torrents/delete/${rdId}`).catch(() => {});
          this.client.updateExternal(infoHash, {
            status: 'error',
            error: `Real-Debrid: ${info.status}`,
          });
        }
      } catch (err) {
        console.error('[RealDebrid] poll error:', (err as Error).message);
      }
    }, 3000);

    this.polls.set(infoHash, timer);
  }

  private async _transferFiles(
    infoHash: string,
    links: string[],
    rdTotalBytes: number,
  ): Promise<void> {
    try {
      // Unrestrict all links to get direct download URLs
      const files: RdUnrestrictResponse[] = [];
      for (const link of links) {
        const unrestricted = await this.api<RdUnrestrictResponse>('POST', '/unrestrict/link', {
          link,
        });
        files.push(unrestricted);
      }

      const totalSize = files.reduce((s, f) => s + (f.filesize || 0), 0) || rdTotalBytes;
      this.client.updateExternal(infoHash, { totalSize });

      const savePath = app.getPath('downloads');
      let totalDownloaded = 0;
      let lastSpeedCheck = Date.now();
      let lastSpeedBytes = 0;

      for (const file of files) {
        const filePath = path.join(savePath, file.filename);
        await fs.promises.mkdir(path.dirname(filePath), { recursive: true });

        const res = await net.fetch(file.download);
        if (!res.ok || !res.body) throw new Error(`Download failed: HTTP ${res.status}`);

        const writer = fs.createWriteStream(filePath);
        const reader = res.body.getReader();

        try {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            writer.write(Buffer.from(value));
            totalDownloaded += value.byteLength;

            // Calculate speed once per second
            const now = Date.now();
            const elapsed = (now - lastSpeedCheck) / 1000;
            if (elapsed >= 1) {
              const speed = Math.round((totalDownloaded - lastSpeedBytes) / elapsed);
              lastSpeedCheck = now;
              lastSpeedBytes = totalDownloaded;
              this.client.updateExternal(infoHash, {
                downloaded: totalDownloaded,
                progress: 0.5 + (totalSize > 0 ? (totalDownloaded / totalSize) * 0.5 : 0),
                downloadSpeed: speed,
              });
            }
          }
        } finally {
          writer.end();
        }
      }

      this.client.updateExternal(infoHash, {
        downloaded: totalDownloaded,
        progress: 1,
        status: 'seeding', // complete
        downloadSpeed: 0,
      });
    } catch (err) {
      this.client.updateExternal(infoHash, {
        status: 'error',
        error: (err as Error).message,
        downloadSpeed: 0,
      });
    }
  }
}

function displayNameFromMagnet(magnetUri: string): string {
  try {
    const dn = new URLSearchParams(magnetUri.split('?')[1] ?? '').get('dn');
    return dn ? decodeURIComponent(dn.replace(/\+/g, ' ')) : 'Unknown torrent';
  } catch {
    return 'Unknown torrent';
  }
}
