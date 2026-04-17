/**
 * Type definitions for Zephyr plugin authors.
 *
 * Usage:
 * 1. Copy this file into your plugin directory.
 * 2. Add `// @ts-check` to the top of your index.js.
 * 3. Annotate your default export: `/** @type {import('./zephyr-plugin').ZephyrPlugin} *\/`
 *
 * You'll get full IntelliSense in VS Code without a build step.
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

export interface PluginSettingSpec {
  /** Unique key used to store/retrieve this value. */
  key: string;
  /** Human-readable label shown in the settings UI. */
  label: string;
  /** Input type rendered in the settings panel. */
  type: 'text' | 'password' | 'toggle';
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
  /** Persist a setting value to disk. */
  set(key: string, value: unknown): Promise<void>;
}

// <generated>
// Auto-generated from src/shared/types.ts — do not edit manually.
// Run `npm run generate:plugin-types` to update.
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
// </generated>

export interface ZephyrHooksApi {
  /** Called once after all plugins have finished loading. */
  onAppReady(handler: () => void): void;
  /** Called when any download transitions to the `seeding` (complete) state. */
  onDownloadComplete(handler: (job: DownloadJob) => void): void;
}

export interface ZephyrAPI {
  ui: ZephyrUiApi;
  ipc: ZephyrIpcApi;
  settings: ZephyrSettingsApi;
  hooks: ZephyrHooksApi;
}

export interface ZephyrPlugin {
  /** Display name shown in the Zephyr plugins list. */
  name: string;
  /** Semver version string. */
  version: string;
  /** Called once at startup. Register all UI contributions and IPC handlers here. */
  setup(zephyr: ZephyrAPI): void | Promise<void>;
}
