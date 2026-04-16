import path from 'node:path';
import type { AppSettings, ReleaseListQuery } from '@shared/types';
import { app, BrowserWindow, ipcMain, protocol, session, shell } from 'electron';
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
    if (typeof fullPath === 'string') shell.showItemInFolder(fullPath);
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
  // images regardless of whether it's running on http://localhost (dev) or
  // file:// (prod). Chromium blocks cross-origin file:// loads, so we use
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

  // YouTube rejects iframes with no Referer (file:// sends none).
  // Inject one so embeds work in both dev and production.
  session.defaultSession.webRequest.onBeforeSendHeaders(
    { urls: ['*://*.youtube.com/*', '*://*.googlevideo.com/*', '*://*.ytimg.com/*'] },
    (details, callback) => {
      const headers = { ...details.requestHeaders };
      if (!headers.Referer) headers.Referer = 'https://www.youtube.com/';
      callback({ requestHeaders: headers });
    },
  );

  registerIpc();
  await ensureServices();
  await torrentClient.init();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  realDebrid.destroy();
  torrentClient.destroy();
  if (process.platform !== 'darwin') app.quit();
});
