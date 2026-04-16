import type {
  AppSettings,
  Artwork,
  BridgeApi,
  DownloadJob,
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
  addTorrent: (magnetUri: string, expectedSize?: number) =>
    ipcRenderer.invoke('torrent:add', magnetUri, expectedSize),
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
};

contextBridge.exposeInMainWorld('api', api);
