import { existsSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';
import type { AppSettings, LibraryEntry, LibraryReleaseInfo, ReleaseListQuery, ScanStatus } from '@shared/types';
import { app, BrowserWindow, dialog, ipcMain, protocol, shell } from 'electron';
import { checkForUpdate, initAutoUpdater, quitAndInstall } from './auto-updater.js';
import { cachePaths } from './cache.js';
import { GameDetailsService } from './details.js';
import { ArtworkService } from './gemini.js';
import { LibraryService } from './library.js';
import { PluginHost } from './plugin-host.js';
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
const libraryService = new LibraryService();

torrentClient.setOnComplete(async (job) => {
  const vtKey = settings.snapshot().virusTotalApiKey;
  torrentClient.updateExternal(job.infoHash, { scanStatus: 'scanning' });
  let scanStatus: ScanStatus = 'error';
  let scanInfo: string | undefined = 'Scan failed unexpectedly';
  try {
    const result = await scanDownload(job.savePath, job.name, vtKey);
    scanStatus = result.status;
    scanInfo = result.info;
  } catch {
    // defaults already set above
  }
  torrentClient.updateExternal(job.infoHash, { scanStatus, scanInfo });
  const entry = await libraryService.onJobComplete(job.infoHash, job.savePath).catch(() => undefined);
  if (entry) pluginHost.notifyLibraryEntryComplete(entry);
  pluginHost.notifyDownloadComplete({ ...job, scanStatus, scanInfo });
});

const realDebrid = new RealDebridService(() => settings.snapshot().realDebridApiKey, torrentClient);
const pluginHost = new PluginHost();

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
  const iconExt =
    process.platform === 'darwin' ? 'icns' : process.platform === 'win32' ? 'ico' : 'png';
  const iconPath = path.join(__dirname, `../../build/icon.${iconExt}`);

  mainWindow = new BrowserWindow({
    width: 1320,
    height: 880,
    minWidth: 920,
    minHeight: 640,
    backgroundColor: '#09090b',
    icon: iconPath,
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

  if (isDev) {
    for (const level of ['log', 'warn', 'error'] as const) {
      const orig = console[level].bind(console);
      console[level] = (...args: unknown[]) => {
        orig(...args);
        mainWindow?.webContents.send('console:forward', level, args.map(String).join(' '));
      };
    }
  }

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

  ipcMain.handle(
    'torrent:add',
    async (_event, magnetUri: string, expectedSize?: number, releaseInfo?: LibraryReleaseInfo) => {
      const rdKey = settings.snapshot().realDebridApiKey;
      const job = rdKey
        ? await realDebrid.download(magnetUri, expectedSize)
        : await torrentClient.add(magnetUri, expectedSize);
      if (releaseInfo) {
        await libraryService.onJobAdded(
          job.infoHash,
          job.savePath,
          job.totalSize,
          job.addedAt,
          releaseInfo,
        );
      }
      return job;
    },
  );

  ipcMain.handle('torrent:list', async () => torrentClient.list());

  ipcMain.handle('torrent:pause', async (_event, infoHash: string) =>
    torrentClient.pause(infoHash),
  );

  ipcMain.handle('torrent:resume', async (_event, infoHash: string) =>
    torrentClient.resume(infoHash),
  );

  ipcMain.handle('torrent:remove', async (_event, infoHash: string, deleteFiles?: boolean) => {
    await torrentClient.remove(infoHash, deleteFiles);
    if (libraryService.getEntry(infoHash)?.installStatus === 'downloading') {
      await libraryService.remove(infoHash);
    }
  });

  ipcMain.handle('plugins:get-ui', () => pluginHost.getUi());
  ipcMain.handle('plugins:get-renderer-paths', () => pluginHost.getRendererPaths());
  ipcMain.handle('plugins:list', () => pluginHost.getLoadedPlugins());
  ipcMain.handle('plugins:install', async (_event, url: string) => pluginHost.installFromUrl(url));
  ipcMain.handle('plugins:install-zip', async (_event, zipPath: string) =>
    pluginHost.installFromZip(zipPath),
  );
  ipcMain.handle('plugins:remove', async (_event, pluginId: string) =>
    pluginHost.removePlugin(pluginId),
  );
  ipcMain.handle(
    'plugins:set-setting',
    async (_event, pluginId: string, key: string, value: unknown) =>
      pluginHost.setPluginSetting(pluginId, key, value),
  );

  // Zip file picker — scoped to the Plugins tab. Returns null if cancelled.
  ipcMain.handle('shell:pick-zip', async (): Promise<string | null> => {
    const owner = mainWindow ?? undefined;
    const result = await (owner
      ? dialog.showOpenDialog(owner, {
          title: 'Select plugin ZIP',
          filters: [{ name: 'Zip archive', extensions: ['zip'] }],
          properties: ['openFile'],
        })
      : dialog.showOpenDialog({
          title: 'Select plugin ZIP',
          filters: [{ name: 'Zip archive', extensions: ['zip'] }],
          properties: ['openFile'],
        }));
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0] ?? null;
  });

  ipcMain.handle('app:restart', () => {
    app.relaunch();
    app.exit(0);
  });

  // Library
  ipcMain.handle('library:list', (_event, page: number, perPage: number) =>
    libraryService.list(page, perPage),
  );
  ipcMain.handle('library:update', async (_event, id: string, patch: Partial<LibraryEntry>) =>
    libraryService.update(id, patch),
  );
  ipcMain.handle('library:remove', async (_event, id: string) => libraryService.remove(id));
  ipcMain.handle('library:verify', async () => libraryService.verifyAll());
  ipcMain.handle('library:pick-executable', async (_event, id: string): Promise<string | null> => {
    const owner = mainWindow ?? undefined;
    const result = await (owner
      ? dialog.showOpenDialog(owner, {
          title: 'Locate game executable',
          filters: [{ name: 'Executable', extensions: ['exe'] }],
          properties: ['openFile'],
        })
      : dialog.showOpenDialog({
          title: 'Locate game executable',
          filters: [{ name: 'Executable', extensions: ['exe'] }],
          properties: ['openFile'],
        }));
    if (result.canceled || result.filePaths.length === 0) return null;
    const exePath = result.filePaths[0] ?? null;
    if (exePath) await libraryService.update(id, { executablePath: exePath, installStatus: 'verified' });
    return exePath;
  });
  ipcMain.handle('library:launch', async (_event, id: string) => {
    const entry = libraryService.getEntry(id);
    if (entry?.executablePath) await shell.openPath(entry.executablePath);
  });
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
  await libraryService.init();
  await libraryService.verifyAll();
  pluginHost.setLibraryService(libraryService);
  pluginHost.setAppSettingsAccessor(settings);
  await pluginHost.load();
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
