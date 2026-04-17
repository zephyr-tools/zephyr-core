import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import type { AppSettings, ReleaseListQuery } from '@shared/types';
import { app, BrowserWindow, ipcMain, protocol, shell } from 'electron';
import { checkForUpdate, initAutoUpdater, quitAndInstall } from './auto-updater.js';
import { cachePaths } from './cache.js';
import { GameDetailsService } from './details.js';
import { ArtworkService } from './gemini.js';
import { PredbClient } from './predb.js';
import { RealDebridService } from './real-debrid.js';
import { SettingsStore } from './settings.js';
import { TorrentClient } from './torrent-client.js';
import { searchTorrents } from './torrent-search.js';
import { scanDownload } from './virus-scan.js';

// Must be called before app.whenReady().
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'artwork',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
]);

const isDev = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let trailerOrigin: string | null = null;

const settings = new SettingsStore();
const predb = new PredbClient();
let artwork: ArtworkService | null = null;
let gameDetails: GameDetailsService | null = null;
const torrentClient = new TorrentClient(() => mainWindow);

torrentClient.setOnComplete((job) => {
  const vtKey = settings.snapshot().virusTotalApiKey;
  torrentClient.updateExternal(job.infoHash, { scanStatus: 'scanning' });
  scanDownload(job.savePath, job.name, vtKey)
    .then((result) => {
      torrentClient.updateExternal(job.infoHash, {
        scanStatus: result.status,
        scanInfo: result.info,
      });
    })
    .catch(() => {
      torrentClient.updateExternal(job.infoHash, {
        scanStatus: 'error',
        scanInfo: 'Scan failed unexpectedly',
      });
    });
});

const realDebrid = new RealDebridService(() => settings.snapshot().realDebridApiKey, torrentClient);

async function ensureServices(): Promise<void> {
  await settings.get();
  if (!artwork) {
    artwork = new ArtworkService(() => settings.snapshot().geminiApiKey);
  }
  if (!gameDetails) {
    gameDetails = new GameDetailsService(
      () => settings.snapshot().geminiApiKey,
      () => settings.snapshot().youtubeApiKey,
    );
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#09090b',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.mjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow.on('ready-to-show', () => mainWindow?.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    void shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev && process.env.ELECTRON_RENDERER_URL) {
    void mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    void mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// YouTube rejects embeds whose parent origin isn't http(s) (error 152-4).
// Wrap each embed in an iframe served from http://127.0.0.1 so YouTube sees
// localhost as the parent instead of file://.
// Returns null if the server fails to start — trailers will be unavailable
// but the app still boots.
async function startTrailerServer(): Promise<string | null> {
  const server = createServer((req, res) => {
    const videoId = new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('v') ?? '';
    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      res.writeHead(400).end();
      return;
    }
    const embed = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1&autoplay=0`;
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(
      `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}</style><iframe src="${embed}" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe>`,
    );
  });

  return new Promise((resolve) => {
    server.once('error', (err) => {
      console.error('[trailer-server] failed to start', err);
      resolve(null);
    });
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      resolve(`http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`);
    });
  });
}

function registerIpc(): void {
  ipcMain.handle('predb:list', async (_event, query: ReleaseListQuery) => {
    await ensureServices();
    return predb.list(query);
  });

  ipcMain.handle('artwork:get', async (_event, title: string) => {
    await ensureServices();
    return artwork!.get(title);
  });

  ipcMain.handle('artwork:refresh', async (_event, title: string) => {
    await ensureServices();
    return artwork!.refresh(title);
  });

  ipcMain.handle('artwork:clear-cache', async () => {
    await ensureServices();
    await artwork!.clearCache();
  });

  ipcMain.handle('settings:get', async () => settings.get());

  ipcMain.handle('settings:set', async (_event, patch: Partial<AppSettings>) => {
    const next = await settings.set(patch);
    await ensureServices();
    return next;
  });

  ipcMain.handle('game:details', async (_event, title: string) => {
    await ensureServices();
    return gameDetails!.get(title);
  });

  ipcMain.handle('game:trailer', async (_event, title: string) => {
    await ensureServices();
    return gameDetails!.getTrailer(title);
  });

  ipcMain.handle('game:group-prereqs', async (_event, group: string, releaseName: string) => {
    await ensureServices();
    return gameDetails!.getGroupPrerequisites(group, releaseName);
  });

  ipcMain.handle('shell:open-external', async (_event, url: string) => {
    if (typeof url !== 'string' || !/^https?:\/\//.test(url)) return;
    await shell.openExternal(url);
  });

  ipcMain.on('shell:show-item-in-folder', (_event, fullPath: string) => {
    if (typeof fullPath !== 'string' || fullPath.length === 0) return;
    // `shell.showItemInFolder` silently no-ops on non-existent paths on Windows.
    // Walk up to the nearest existing ancestor so the click always does *something*.
    let target = fullPath;
    while (target && !existsSync(target)) {
      const parent = path.dirname(target);
      if (parent === target) return; // hit the root without finding anything
      target = parent;
    }
    if (target === fullPath) {
      shell.showItemInFolder(target);
    } else {
      // Path moved/deleted — just open the nearest surviving folder.
      void shell.openPath(target);
    }
  });

  ipcMain.handle('torrent:search', async (_event, name: string, title: string) =>
    searchTorrents(name, title),
  );

  ipcMain.handle('torrent:add', async (_event, magnetUri: string, expectedSize?: number) => {
    const rdKey = settings.snapshot().realDebridApiKey;
    if (rdKey) return realDebrid.download(magnetUri, expectedSize);
    return torrentClient.add(magnetUri, expectedSize);
  });

  ipcMain.handle('torrent:list', async () => torrentClient.list());

  ipcMain.handle('torrent:pause', async (_event, infoHash: string) =>
    torrentClient.pause(infoHash),
  );

  ipcMain.handle('torrent:resume', async (_event, infoHash: string) =>
    torrentClient.resume(infoHash),
  );

  ipcMain.handle('torrent:remove', async (_event, infoHash: string, deleteFiles?: boolean) =>
    torrentClient.remove(infoHash, deleteFiles),
  );
}

app.whenReady().then(async () => {
  // Serve cached artwork via a custom scheme so the renderer can load local
  // images. Chromium blocks cross-origin file:// loads, so we use
  // artwork://local/<filename> instead.
  protocol.handle('artwork', async (req) => {
    const { createReadStream } = await import('node:fs');
    const filename = new URL(req.url).pathname.replace(/^\//, '');
    const ext = path.extname(filename).slice(1).toLowerCase();
    const mime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const filePath = path.join(cachePaths.artworkDir, filename);
    return new Response(createReadStream(filePath) as unknown as ReadableStream, {
      headers: { 'content-type': mime[ext] ?? 'image/jpeg' },
    });
  });

  registerIpc();
  ipcMain.handle('app:version', () => app.getVersion());
  ipcMain.handle('app:trailer-origin', () => trailerOrigin);
  ipcMain.handle('update:check', () => (isDev ? Promise.resolve() : checkForUpdate()));
  ipcMain.on('update:install', () => quitAndInstall());
  await ensureServices();
  await torrentClient.init();
  trailerOrigin = await startTrailerServer();
  createWindow();

  if (!isDev) {
    initAutoUpdater(() => mainWindow);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  realDebrid.destroy();
  torrentClient.destroy();
  if (process.platform !== 'darwin') app.quit();
});
