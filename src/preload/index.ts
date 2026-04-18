import type {
  AppSettings,
  Artwork,
  BridgeApi,
  DownloadJob,
  LibraryEntry,
  LibraryReleaseInfo,
  LoadedPlugin,
  PluginRendererPath,
  PluginUi,
  ReleaseListQuery,
  ReleaseListResult,
} from '@shared/types';
import { contextBridge, ipcRenderer } from 'electron';

const api: BridgeApi = {
  listReleases: (query: ReleaseListQuery): Promise<ReleaseListResult> =>
    ipcRenderer.invoke('predb:list', query),
  getArtwork: (title: string): Promise<Artwork | null> => ipcRenderer.invoke('artwork:get', title),
  refreshArtwork: (title: string): Promise<Artwork | null> =>
    ipcRenderer.invoke('artwork:refresh', title),
  getGameDetails: (title: string) => ipcRenderer.invoke('game:details', title),
  getGameTrailer: (title: string) => ipcRenderer.invoke('game:trailer', title),
  getGroupPrerequisites: (group: string, releaseName: string) =>
    ipcRenderer.invoke('game:group-prereqs', group, releaseName),
  getSettings: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
  setSettings: (patch: Partial<AppSettings>): Promise<AppSettings> =>
    ipcRenderer.invoke('settings:set', patch),
  clearArtworkCache: (): Promise<void> => ipcRenderer.invoke('artwork:clear-cache'),
  openExternal: (url: string): Promise<void> => ipcRenderer.invoke('shell:open-external', url),
  showItemInFolder: (fullPath: string): void =>
    ipcRenderer.send('shell:show-item-in-folder', fullPath),

  searchTorrents: (name: string, title: string) =>
    ipcRenderer.invoke('torrent:search', name, title),
  addTorrent: (magnetUri: string, expectedSize?: number, releaseInfo?: LibraryReleaseInfo) =>
    ipcRenderer.invoke('torrent:add', magnetUri, expectedSize, releaseInfo),
  listDownloads: (): Promise<DownloadJob[]> => ipcRenderer.invoke('torrent:list'),
  pauseDownload: (infoHash: string): Promise<void> => ipcRenderer.invoke('torrent:pause', infoHash),
  resumeDownload: (infoHash: string): Promise<void> =>
    ipcRenderer.invoke('torrent:resume', infoHash),
  removeDownload: (infoHash: string, deleteFiles?: boolean): Promise<void> =>
    ipcRenderer.invoke('torrent:remove', infoHash, deleteFiles),
  onDownloadProgress: (callback: (jobs: DownloadJob[]) => void): (() => void) => {
    const handler = (_: unknown, jobs: DownloadJob[]) => callback(jobs);
    ipcRenderer.on('torrent:progress', handler);
    return () => ipcRenderer.removeListener('torrent:progress', handler);
  },

  getTrailerOrigin: (): Promise<string | null> => ipcRenderer.invoke('app:trailer-origin'),

  // Auto-update
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('app:version'),
  checkForUpdate: (): Promise<void> => ipcRenderer.invoke('update:check'),
  onUpdateAvailable: (callback: (info: { version: string; releaseNotes?: string }) => void) => {
    const handler = (_: unknown, info: { version: string; releaseNotes?: string }) =>
      callback(info);
    ipcRenderer.on('update:available', handler);
    return () => ipcRenderer.removeListener('update:available', handler);
  },
  onUpdateDownloaded: (callback: () => void) => {
    const handler = () => callback();
    ipcRenderer.on('update:downloaded', handler);
    return () => ipcRenderer.removeListener('update:downloaded', handler);
  },
  installUpdate: () => ipcRenderer.send('update:install'),

  // Plugin system
  getPluginUi: (): Promise<PluginUi> => ipcRenderer.invoke('plugins:get-ui'),
  getPluginRendererPaths: (): Promise<PluginRendererPath[]> =>
    ipcRenderer.invoke('plugins:get-renderer-paths'),
  invokePlugin: (channel: string, payload: unknown): Promise<unknown> => {
    // Callers pass the bare channel name (`pluginId:action`); the `plugin:`
    // prefix is applied here so renderer code — including Layer-2 plugins —
    // cannot reach any non-plugin IPC channel through this function.
    if (typeof channel !== 'string' || channel.length === 0) {
      return Promise.reject(new Error('invokePlugin: channel must be a non-empty string'));
    }
    const bare = channel.startsWith('plugin:') ? channel.slice('plugin:'.length) : channel;
    return ipcRenderer.invoke(`plugin:${bare}`, payload);
  },
  installPlugin: (url: string): Promise<string> => ipcRenderer.invoke('plugins:install', url),
  installPluginFromZip: (zipPath: string): Promise<string> =>
    ipcRenderer.invoke('plugins:install-zip', zipPath),
  pickPluginZip: (): Promise<string | null> => ipcRenderer.invoke('shell:pick-zip'),
  removePlugin: (pluginId: string): Promise<void> => ipcRenderer.invoke('plugins:remove', pluginId),
  listPlugins: (): Promise<LoadedPlugin[]> => ipcRenderer.invoke('plugins:list'),
  setPluginSetting: (pluginId: string, key: string, value: unknown): Promise<void> =>
    ipcRenderer.invoke('plugins:set-setting', pluginId, key, value),
  restartApp: (): Promise<void> => ipcRenderer.invoke('app:restart'),

  // Library
  listLibrary: (page: number, perPage: number) =>
    ipcRenderer.invoke('library:list', page, perPage),
  updateLibraryEntry: (id: string, patch: Partial<LibraryEntry>) =>
    ipcRenderer.invoke('library:update', id, patch),
  removeLibraryEntry: (id: string): Promise<void> => ipcRenderer.invoke('library:remove', id),
  pickExecutable: (id: string): Promise<string | null> =>
    ipcRenderer.invoke('library:pick-executable', id),
  launchGame: (id: string): Promise<void> => ipcRenderer.invoke('library:launch', id),
  verifyLibrary: (): Promise<void> => ipcRenderer.invoke('library:verify'),

};

contextBridge.exposeInMainWorld('api', api);

ipcRenderer.on('console:forward', (_event, level: string, msg: string) => {
  if (level === 'error') console.error('[main]', msg);
  else if (level === 'warn') console.warn('[main]', msg);
  else console.log('[main]', msg);
});
