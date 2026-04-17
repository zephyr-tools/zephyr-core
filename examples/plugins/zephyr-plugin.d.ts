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

export interface PluginSectionSpec {
  /** Heading shown above the section in DetailPage. */
  title: string;
  /** IPC channel (without `plugin:` prefix) that provides the section content. */
  action: string;
}

export interface PluginCardMenuItemSpec {
  /** Label shown in the context menu. */
  label: string;
  /** IPC channel (without `plugin:` prefix) triggered on click. */
  action: string;
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
  /** Add a section below the torrent results in DetailPage. */
  addDetailSection(spec: PluginSectionSpec): void;
  /** Add an item to the ReleaseCard context menu (rendered in a future release). */
  addCardMenuItem(spec: PluginCardMenuItemSpec): void;
}

export interface ZephyrIpcApi {
  /**
   * Register a handler for the given channel.
   * The channel must NOT include the `plugin:` prefix — it is added automatically.
   * The full registered channel becomes `plugin:<channel>`.
   *
   * The `payload` argument is whatever the button/section action passes —
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

export interface DownloadJob {
  infoHash: string;
  name: string;
  magnetUri: string;
  savePath: string;
  progress: number;
  status: 'queued' | 'downloading' | 'seeding' | 'paused' | 'error';
  totalSize: number;
  scanStatus?: 'scanning' | 'clean' | 'threat' | 'error';
}

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
