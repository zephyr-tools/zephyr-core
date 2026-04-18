/**
 * Type definitions for Zephyr plugin authors.
 *
 * Usage (Layer 1 — main process `index.js`):
 * 1. Copy this file into your plugin directory alongside `index.js`.
 * 2. Add `// @ts-check` to the top of your `index.js`.
 * 3. Annotate your default export: `/** @type {import('./zephyr-plugin').ZephyrPlugin} *\/`
 *
 * Layer 2 (renderer `renderer.jsx`) types are exported from the same file —
 * see `PluginDetailSection`, `PluginRoute`, `PluginDetailButton`, and
 * `PluginPageProps` below.
 *
 * You'll get full IntelliSense in VS Code without a build step.
 *
 * IMPORTANT: The in-repo examples use `import('../zephyr-plugin')` because
 * they share a single copy at `examples/plugins/zephyr-plugin.d.ts`. When you
 * start your own plugin, copy this file into the plugin directory and use
 * `import('./zephyr-plugin')` instead.
 */

export interface PluginButtonSpec {
  /** Text shown on the button. */
  label: string;
  /**
   * IPC channel this button triggers. Do NOT include the `plugin:` prefix —
   * it is added automatically. Use your plugin ID as a namespace to avoid
   * conflicts: e.g. `steamdb:open`, not just `open`.
   */
  action: string;
  /** Reserved for future icon support. */
  icon?: string;
}

export type PluginSettingType = 'text' | 'password' | 'toggle' | 'number' | 'select';

export interface PluginSettingOption {
  label: string;
  value: string | number | boolean;
}

export interface PluginSettingSpec {
  /** Unique key used to store/retrieve this value. */
  key: string;
  /** Human-readable label shown in the settings UI. */
  label: string;
  /** Input type rendered in the settings panel. */
  type: PluginSettingType;
  /** Options for `type: 'select'`. Ignored for other types. */
  options?: PluginSettingOption[];
  /** Numeric bounds + step for `type: 'number'`. Ignored for other types. */
  min?: number;
  max?: number;
  step?: number;
  /** Helper text rendered under the input. */
  hint?: string;
}

export interface ZephyrUiApi {
  /** Add a button to the DetailPage top bar. Appears next to "View Release". */
  addDetailButton(spec: PluginButtonSpec): void;
}

export interface ZephyrIpcApi {
  /**
   * Register a handler for the given channel.
   * The channel must NOT include the `plugin:` prefix — it is added automatically.
   * The full registered channel becomes `plugin:<channel>`.
   *
   * The `payload` argument is whatever the button action passes —
   * typically the full `Release` object from Zephyr's shared types.
   */
  handle(channel: string, handler: (payload: unknown) => unknown | Promise<unknown>): void;
}

export interface ZephyrSettingsApi {
  /** Declare a settings field that appears in the Zephyr settings panel. */
  register(spec: PluginSettingSpec): void;
  /** Read a persisted setting value (synchronous, returns null if not set). */
  get(key: string): unknown;
  /**
   * Persist a setting value to disk. If `key` was not previously registered,
   * the value is still persisted but will not appear in the Settings UI —
   * a console warning is emitted.
   */
  set(key: string, value: unknown): Promise<void>;
  /**
   * Subscribe to changes to `key`, including edits made by the user in the
   * Settings dialog. Fires after the new value is persisted. Only changes
   * to registered keys flow through the UI.
   */
  onChange(key: string, handler: (value: unknown) => void): void;
}

// <generated>
// Auto-generated from src/shared/types.ts — do not edit manually.
// Run `npm run generate:plugin-types` to update.
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

export type DownloadStatus = 'queued' | 'downloading' | 'seeding' | 'paused' | 'error';

export type ScanStatus = 'pending' | 'scanning' | 'clean' | 'threat' | 'error';

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
export type InstallStatus = 'downloading' | 'verified' | 'missing' | 'unlocated';

export interface LibraryEntry {
  /** Keyed by infoHash. */
  id: string;
  releaseName: string;
  releaseTitle: string;
  team: string | null;
  category: string;
  /** Title used to fetch artwork (= releaseTitle). */
  artworkTitle: string;
  addedAt: number;
  completedAt?: number;
  savePath: string;
  totalSize: number;
  installStatus: InstallStatus;
  executablePath?: string;
}

export interface LibraryListResult {
  entries: LibraryEntry[];
  total: number;
  page: number;
  perPage: number;
}
// </generated>

export interface ZephyrHooksApi {
  /** Called once after all plugins have finished loading. */
  onAppReady(handler: () => void): void;
  /**
   * Called when a download completes. Fires **after** the post-download
   * virus scan resolves, so `job.scanStatus` and `job.scanInfo` are the
   * final scan result (`clean` | `threat` | `error`). If Windows Defender
   * or VirusTotal fail to run, `scanStatus` is `'error'` — check it before
   * acting on the download.
   */
  onDownloadComplete(handler: (job: DownloadJob) => void): void;
  /**
   * Called after a download completes and executable auto-discovery has run.
   * Fires only for downloads that were started from a release page (i.e. that
   * have release metadata attached). `entry.installStatus` is `'verified'`
   * when an executable was found automatically, `'unlocated'` otherwise.
   * Use `entry.executablePath` to launch or integrate with the installed game.
   */
  onLibraryEntryComplete(handler: (entry: LibraryEntry) => void): void;
  /**
   * Called when the user uninstalls this plugin, before its files are deleted.
   * Use this to tear down anything the plugin installed outside its own directory:
   * scheduled tasks, AppX/MSIX packages, registry entries, external data caches.
   * The handler is awaited with a 60s timeout; exceptions are logged but do not
   * block removal.
   */
  onUninstall(handler: () => void | Promise<void>): void;
}

export interface ZephyrLibraryApi {
  /**
   * Get a single library entry by its id (infoHash). Returns `undefined` if
   * the download was not started from a release page or is not yet in the library.
   */
  get(id: string): LibraryEntry | undefined;
  /**
   * List all library entries, newest first. Paginated — defaults to page 1,
   * 100 entries per page.
   */
  list(page?: number, perPage?: number): LibraryListResult;
  /** Add a new entry manually. No-op if an entry with that id already exists. */
  add(entry: LibraryEntry): Promise<void>;
  /** Patch an existing entry. No-op if the id is not in the library. */
  update(id: string, patch: Partial<LibraryEntry>): Promise<void>;
}

export interface AppSettings {
  geminiApiKey: string | null;
  youtubeApiKey: string | null;
  realDebridApiKey: string | null;
  virusTotalApiKey: string | null;
  autoStartEnabled: boolean;
}

export interface ZephyrAppApi {
  /** Synchronous snapshot of the current app settings. Always reflects the latest persisted values. */
  getSettings(): AppSettings;
}

export interface ZephyrAPI {
  ui: ZephyrUiApi;
  ipc: ZephyrIpcApi;
  settings: ZephyrSettingsApi;
  hooks: ZephyrHooksApi;
  /** Read-only access to the user's game library. */
  library: ZephyrLibraryApi;
  /** Read-only access to the app's persisted settings (API keys, etc.). */
  app: ZephyrAppApi;
}

export interface ZephyrPlugin {
  /** Display name shown in the Zephyr plugins list. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Called once at startup. Register all UI contributions and IPC handlers here. */
  setup(zephyr: ZephyrAPI): void | Promise<void>;
}

// ────────────────────────────────────────────────────────────────────────────
// Layer 2 — Renderer plugin types (for renderer.jsx)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Props passed to plugin detail-section and plugin-button components.
 * `release` is the currently-viewed scene release on the DetailPage.
 */
export interface PluginReleaseComponentProps {
  release: Release;
}

/**
 * Props passed to a plugin full-page route component. `release` is
 * whichever release the user last viewed (or `undefined` if they have not
 * opened one this session).
 */
export interface PluginPageProps {
  release?: Release;
}

/**
 * A React component type. Typed structurally so renderer plugins do not need
 * to import React — any function returning JSX matches.
 */
export type PluginComponent<P> = (props: P) => unknown;

export interface PluginDetailSection {
  /** Globally unique across all installed plugins. Use `pluginId:name`. */
  id: string;
  /** Header text shown above the section. */
  title: string;
  component: PluginComponent<PluginReleaseComponentProps>;
}

export interface PluginDetailButton {
  /** Globally unique across all installed plugins. Use `pluginId:name`. */
  id: string;
  /** Rendered inline in the DetailPage top bar. Your component is responsible for its own click handling. */
  component: PluginComponent<PluginReleaseComponentProps>;
}

export interface PluginRoute {
  /** Globally unique across all installed plugins. Use `pluginId:name`. */
  id: string;
  /** Text shown in the header nav button that opens this route. */
  navLabel: string;
  /** Lazy import — called once when the route is opened. */
  component: () => Promise<{ default: PluginComponent<PluginPageProps> }>;
}

/** The full set of named exports Zephyr reads from a plugin's `renderer.js`. */
export interface RendererPluginExports {
  detailSections?: PluginDetailSection[];
  detailButtons?: PluginDetailButton[];
  routes?: PluginRoute[];
}

/**
 * Minimal typed view of `window.api` for renderer-plugin authors. Only the
 * methods useful from a plugin are listed here — consult PLUGINS.md for the
 * full bridge if you need more.
 */
export interface ZephyrWindowApi {
  /**
   * Invoke a plugin IPC handler registered via `zephyr.ipc.handle(...)`.
   * Pass the bare channel name (`pluginId:action`) — the `plugin:` prefix
   * is applied automatically.
   */
  invokePlugin(channel: string, payload?: unknown): Promise<unknown>;
  openExternal(url: string): Promise<void>;
  showItemInFolder(fullPath: string): void;
}
