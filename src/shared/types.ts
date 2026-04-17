/**
 * Types shared between the Electron main process, preload bridge, and renderer.
 * Keep this file dependency-free so it can be imported from anywhere.
 */

export interface Release {
  /** Stable id, derived from the release name when the source has none. */
  id: string;
  /** Scene release name, e.g. `Some.Game.MULTi5-RELOADED`. */
  name: string;
  /** Release group, e.g. `RELOADED`. */
  team: string | null;
  /** Section/category, e.g. `GAMES`, `0DAY`, `XXX`. */
  category: string;
  /** Optional genre or platform hint when the source provides it. */
  genre?: string | null;
  /** Pre time as Unix epoch seconds, or null if unknown. */
  pretime: number | null;
  /** Total release size in bytes, or null. */
  size: number | null;
  /** Number of files, or null. */
  files: number | null;
  /** Nuke reason, if the release was nuked. */
  nuke?: string | null;
  /** Permalink to the release page on the source. */
  url?: string | null;
  /** Friendly title parsed out of the release name (used to query Gemini). */
  title: string;
}

export interface ReleaseListQuery {
  /** Free-text search. Empty string fetches latest in the section. */
  q?: string;
  /** Section filter, e.g. `GAMES`. */
  category?: string;
  /** 1-based page index. */
  page?: number;
  /** Page size. */
  rows?: number;
}

export interface ReleaseListResult {
  rows: Release[];
  total: number;
  page: number;
  rows_per_page: number;
  /** Which adapter served this response. */
  source: 'predb.net';
  /** Time, in ms, the request took end-to-end. */
  durationMs: number;
}

export interface Artwork {
  /** Title used to identify the game. */
  title: string;
  /** Local file:// URL pointing at a cached image, or remote https URL. */
  imageUrl: string;
  /** Original remote URL the artwork was downloaded from. */
  sourceUrl: string;
  /** When this artwork was resolved (epoch ms). */
  fetchedAt: number;
  /** Origin: `gemini` (AI lookup) or `placeholder`. */
  origin: 'gemini' | 'placeholder';
  /** True when the Steam app was a DLC — art is sourced from the base game. */
  isDlc?: boolean;
}

export interface AppSettings {
  geminiApiKey: string | null;
  youtubeApiKey: string | null;
  realDebridApiKey: string | null;
  virusTotalApiKey: string | null;
}

export interface GameTrailer {
  /** 'steam-mp4' = direct mp4 from Steam CDN; 'youtube' = YouTube embed */
  type: 'steam-mp4' | 'youtube';
  /** Steam: full mp4 URL. YouTube: 11-character video ID. */
  url: string;
  thumbnailUrl?: string;
}

export interface GameDetails {
  title: string;
  steamAppId?: number;
  shortDescription?: string;
  genres?: string[];
  developer?: string;
  publisher?: string;
  /** Human-readable release date string, e.g. "21 Aug, 2023". */
  releaseDate?: string;
  metacriticScore?: number;
  /** Steam screenshot thumbnail URLs. */
  screenshots?: string[];
  trailer?: GameTrailer;
  /** Where the data came from. */
  origin: 'steam' | 'gemini' | 'none';
  fetchedAt: number;
}

// ---- Torrent types ----

export interface TorrentResult {
  infoHash: string;
  name: string;
  size: number;
  seeders: number;
  leechers: number;
  magnetUri: string;
  source: 'tpb' | 'yts' | 'eztv';
  category?: string;
  uploadedAt?: number; // epoch ms
}

export type DownloadStatus = 'queued' | 'downloading' | 'seeding' | 'paused' | 'error';

export type ScanStatus = 'pending' | 'scanning' | 'clean' | 'threat' | 'error';

/**
 * Real-Debrid pipeline phases. The first four live on the RD cloud side
 * (progress 0–50%), `transferring` is the local HTTP stream to disk (50–100%).
 */
export type RdPhase =
  | 'fetching-metadata'
  | 'queued-remote'
  | 'rd-downloading'
  | 'rd-processing'
  | 'transferring';

export interface DownloadJob {
  infoHash: string;
  name: string;
  magnetUri: string;
  savePath: string;
  progress: number; // 0–1
  downloadSpeed: number; // bytes/s
  uploadSpeed: number; // bytes/s
  numPeers: number;
  status: DownloadStatus;
  totalSize: number; // bytes
  downloaded: number; // bytes
  addedAt: number; // epoch ms
  origin?: 'webtorrent' | 'real-debrid';
  scanStatus?: ScanStatus;
  /** Human-readable scan result (e.g. threat name, VT detection ratio). */
  scanInfo?: string;
  error?: string;
  /** Real-Debrid pipeline phase (only set when origin === 'real-debrid'). */
  rdPhase?: RdPhase;
  /** Raw RD status string ("magnet_conversion", "downloading", …) for diagnostics. */
  rdRawStatus?: string;
  /** Non-fatal hint shown under a job (e.g. "No seeders yet — may be unavailable"). */
  rdMessage?: string;
  /**
   * Absolute path to reveal when the user clicks the folder icon on a complete
   * job. Either a single file (highlighted in its folder) or a directory. Set
   * by the origin on completion — renderer should treat as opaque.
   */
  revealPath?: string;
}

export interface GroupPrerequisites {
  group: string;
  /** Short summary of the group and their release style. */
  summary: string;
  /** Software/runtimes needed before installing (e.g. DirectX, VC++ Redist). */
  prerequisites: string[];
  /** Step-by-step install instructions typical for this group's releases. */
  installSteps: string[];
  /** Where the data came from. */
  origin: 'gemini' | 'none';
}

// ---- Auto-update types ----

export interface UpdateInfo {
  version: string;
  releaseNotes?: string;
}

// ---- Plugin types ----

export interface PluginButtonSpec {
  label: string;
  /**
   * Bare IPC channel name as registered by the plugin via `zephyr.ipc.handle`.
   * The `plugin:` prefix is applied transparently when the renderer invokes.
   */
  action: string;
  icon?: string;
}

export type PluginSettingType = 'text' | 'password' | 'toggle' | 'number' | 'select';

export interface PluginSettingOption {
  label: string;
  value: string | number | boolean;
}

export interface PluginSettingSpec {
  key: string;
  label: string;
  type: PluginSettingType;
  pluginId: string;
  /** Current persisted value, or null when unset. */
  value: unknown;
  /** Options for `type: 'select'`. */
  options?: PluginSettingOption[];
  /** Numeric bounds + step, for `type: 'number'`. */
  min?: number;
  max?: number;
  step?: number;
  /** Optional helper text rendered under the field. */
  hint?: string;
}

export interface PluginUi {
  detailButtons: PluginButtonSpec[];
  settings: PluginSettingSpec[];
}

export interface LoadedPlugin {
  id: string;
  name: string;
  version: string;
}

/** API exposed on `window.api` from the preload bridge. */
export interface BridgeApi {
  listReleases(query: ReleaseListQuery): Promise<ReleaseListResult>;
  getArtwork(title: string): Promise<Artwork | null>;
  refreshArtwork(title: string): Promise<Artwork | null>;
  getGameDetails(title: string): Promise<GameDetails>;
  getGameTrailer(title: string): Promise<GameTrailer | null>;
  getSettings(): Promise<AppSettings>;
  setSettings(patch: Partial<AppSettings>): Promise<AppSettings>;
  clearArtworkCache(): Promise<void>;
  openExternal(url: string): Promise<void>;
  showItemInFolder(fullPath: string): void;
  // Torrent search + prerequisites
  searchTorrents(name: string, title: string): Promise<TorrentResult[]>;
  getGroupPrerequisites(group: string, releaseName: string): Promise<GroupPrerequisites>;
  addTorrent(magnetUri: string, expectedSize?: number): Promise<DownloadJob>;
  // Download management — shown in UI
  listDownloads(): Promise<DownloadJob[]>;
  pauseDownload(infoHash: string): Promise<void>;
  resumeDownload(infoHash: string): Promise<void>;
  removeDownload(infoHash: string, deleteFiles?: boolean): Promise<void>;
  onDownloadProgress(callback: (jobs: DownloadJob[]) => void): () => void;
  getTrailerOrigin(): Promise<string | null>;

  // Auto-update
  getAppVersion(): Promise<string>;
  checkForUpdate(): Promise<void>;
  onUpdateAvailable(callback: (info: UpdateInfo) => void): () => void;
  onUpdateDownloaded(callback: () => void): () => void;
  installUpdate(): void;

  // Plugin system
  getPluginUi(): Promise<PluginUi>;
  getPluginRendererPaths(): Promise<PluginRendererPath[]>;
  /**
   * Invoke a plugin-registered IPC handler. Pass the bare channel name
   * (`pluginId:action`) — the `plugin:` prefix is applied in preload so
   * this method can never reach a non-plugin channel.
   */
  invokePlugin(channel: string, payload: unknown): Promise<unknown>;
  installPlugin(url: string): Promise<string>;
  /** Install a plugin from a local .zip file path. */
  installPluginFromZip(zipPath: string): Promise<string>;
  /** Show a native file dialog for picking a plugin .zip. Returns null if the user cancels. */
  pickPluginZip(): Promise<string | null>;
  /** Delete a plugin from disk. Running code is unloaded on the next restart. */
  removePlugin(pluginId: string): Promise<void>;
  listPlugins(): Promise<LoadedPlugin[]>;
  setPluginSetting(pluginId: string, key: string, value: unknown): Promise<void>;
  /** Relaunch the app so install/remove changes take effect across both processes. */
  restartApp(): Promise<void>;
}

export interface PluginRendererPath {
  pluginId: string;
  /** file:// URL to the renderer.js for this plugin. */
  url: string;
}

declare global {
  interface Window {
    api: BridgeApi;
  }
}
