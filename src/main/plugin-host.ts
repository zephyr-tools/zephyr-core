import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type {
  DownloadJob,
  LoadedPlugin,
  PluginSettingOption,
  PluginSettingType,
  PluginUi,
} from '@shared/types';
import { app, ipcMain, net } from 'electron';
import { readJson, writeJson } from './cache.js';

interface PluginSettingRegisterSpec {
  key: string;
  label: string;
  type: PluginSettingType;
  options?: PluginSettingOption[];
  min?: number;
  max?: number;
  step?: number;
  hint?: string;
}

interface ZephyrAPI {
  ui: {
    addDetailButton(spec: { label: string; action: string; icon?: string }): void;
  };
  ipc: {
    handle(channel: string, handler: (payload: unknown) => unknown | Promise<unknown>): void;
  };
  settings: {
    register(spec: PluginSettingRegisterSpec): void;
    get(key: string): unknown;
    set(key: string, value: unknown): Promise<void>;
    /** Subscribe to changes to a setting key (including changes made by the user via the Settings UI). */
    onChange(key: string, handler: (value: unknown) => void): void;
  };
  hooks: {
    onDownloadComplete(handler: (job: DownloadJob) => void): void;
    onAppReady(handler: () => void): void;
  };
}

type PluginModule = {
  default?: {
    name?: string;
    version?: string;
    setup?(api: ZephyrAPI): void;
  };
};

type PluginSettingsStore = Record<string, unknown>;

const VALID_PLUGIN_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class PluginHost {
  private readonly pluginsDir: string;
  private ui: PluginUi = { detailButtons: [], settings: [] };
  private settingsCache = new Map<string, PluginSettingsStore>();
  private settingChangeHandlers = new Map<
    string /* pluginId */,
    Map<string /* key */, Array<(value: unknown) => void>>
  >();
  private downloadCompleteHandlers: Array<(job: DownloadJob) => void> = [];
  private appReadyHandlers: Array<() => void> = [];
  private loadedPlugins: LoadedPlugin[] = [];
  private rendererUrls = new Map<string, string>(); // pluginId -> file:// URL

  constructor() {
    this.pluginsDir = path.join(app.getPath('userData'), 'plugins');
  }

  async load(): Promise<void> {
    await fs.mkdir(this.pluginsDir, { recursive: true });

    let entries: string[];
    try {
      entries = await fs.readdir(this.pluginsDir);
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(this.pluginsDir, entry);
      let pluginId: string;
      let entryFile: string;

      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        pluginId = entry;
        entryFile = path.join(fullPath, 'index.js');
      } else if (entry.endsWith('.js')) {
        pluginId = entry.slice(0, -3);
        entryFile = fullPath;
      } else {
        continue;
      }

      try {
        await fs.access(entryFile);
      } catch {
        console.warn(`[PluginHost] Skipping ${pluginId}: no index.js found`);
        continue;
      }

      await this._loadPlugin(pluginId, entryFile);
    }

    console.log(
      `[PluginHost] ${this.loadedPlugins.length} plugin(s) loaded from ${this.pluginsDir}`,
    );

    for (const handler of this.appReadyHandlers) {
      try {
        handler();
      } catch (err) {
        console.error('[PluginHost] onAppReady handler threw:', (err as Error).message);
      }
    }
  }

  async installFromUrl(url: string): Promise<string> {
    if (!/^https:\/\//.test(url)) throw new Error('Plugin URL must use HTTPS');

    // Derive a safe pluginId from the URL path's basename (strip query/hash
    // via URL.pathname, then drop any trailing .js). We require the standard
    // `^[a-z0-9][a-z0-9-]*$` convention to prevent path-traversal style names
    // and reserved filenames landing on disk.
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      throw new Error('Plugin URL is not a valid URL');
    }
    const basename = path.posix.basename(pathname).replace(/\.js$/i, '');
    if (!VALID_PLUGIN_ID.test(basename)) {
      throw new Error(
        `Plugin ID "${basename}" is invalid. Use lowercase letters, digits, and hyphens only.`,
      );
    }
    const pluginId = basename;

    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch plugin: ${res.status}`);
    const js = await res.text();

    const pluginDir = path.join(this.pluginsDir, pluginId);
    await fs.mkdir(pluginDir, { recursive: true });
    const entryFile = path.join(pluginDir, 'index.js');
    await fs.writeFile(entryFile, js, 'utf8');

    try {
      await this._loadPlugin(pluginId, entryFile, { throwOnError: true });
    } catch (err) {
      // Roll back the written file so a broken plugin does not persist.
      await fs.rm(pluginDir, { recursive: true, force: true }).catch(() => undefined);
      throw err;
    }
    return pluginId;
  }

  getUi(): PluginUi {
    // Hydrate settings with current values so the renderer can render inputs
    // bound to persisted state without another round-trip per field.
    return {
      detailButtons: this.ui.detailButtons,
      settings: this.ui.settings.map((s) => ({
        ...s,
        value: this.settingsCache.get(s.pluginId)?.[s.key] ?? null,
      })),
    };
  }

  async setPluginSetting(pluginId: string, key: string, value: unknown): Promise<void> {
    if (!VALID_PLUGIN_ID.test(pluginId)) throw new Error('Invalid plugin id');
    if (!this.ui.settings.some((s) => s.pluginId === pluginId && s.key === key)) {
      throw new Error(`Setting "${key}" is not registered for plugin "${pluginId}"`);
    }
    await this._applySetting(pluginId, key, value);
  }

  /**
   * Single write path for plugin settings. Called both by the plugin-facing
   * `zephyr.settings.set(...)` and by the user-facing `plugins:set-setting`
   * IPC handler. Updates the cache, persists to disk, then fires any
   * `onChange` listeners registered for (pluginId, key).
   */
  private async _applySetting(pluginId: string, key: string, value: unknown): Promise<void> {
    const store = this.settingsCache.get(pluginId) ?? {};
    store[key] = value;
    this.settingsCache.set(pluginId, store);
    await writeJson(path.join(this.pluginsDir, pluginId, 'settings.json'), store);
    const handlers = this.settingChangeHandlers.get(pluginId)?.get(key);
    if (handlers) {
      for (const h of handlers) {
        try {
          h(value);
        } catch (err) {
          console.error(
            `[Plugin:${pluginId}] settings.onChange("${key}") handler threw:`,
            (err as Error).message,
          );
        }
      }
    }
  }

  getLoadedPlugins(): LoadedPlugin[] {
    return this.loadedPlugins;
  }

  getRendererPaths(): Array<{ pluginId: string; url: string }> {
    return Array.from(this.rendererUrls.entries()).map(([pluginId, url]) => ({ pluginId, url }));
  }

  notifyDownloadComplete(job: DownloadJob): void {
    for (const handler of this.downloadCompleteHandlers) {
      try {
        handler(job);
      } catch (err) {
        console.error('[PluginHost] onDownloadComplete handler threw:', (err as Error).message);
      }
    }
  }

  private async _loadPlugin(
    pluginId: string,
    entryFile: string,
    opts: { throwOnError?: boolean } = {},
  ): Promise<void> {
    try {
      await this._loadSettings(pluginId);
      const fileUrl = pathToFileURL(entryFile).href;
      const mod = (await import(fileUrl)) as PluginModule;
      const plugin = mod.default;

      if (!plugin || typeof plugin.setup !== 'function') {
        const msg = `Plugin ${pluginId}: no default export with setup()`;
        if (opts.throwOnError) throw new Error(msg);
        console.warn(`[PluginHost] ${msg} — skipping`);
        return;
      }

      plugin.setup(this._buildApi(pluginId));

      const version = plugin.version ?? '0.0.0';
      this.loadedPlugins.push({
        id: pluginId,
        name: plugin.name ?? pluginId,
        version,
      });

      const rendererJs = path.join(path.dirname(entryFile), 'renderer.js');
      try {
        await fs.access(rendererJs);
        this.rendererUrls.set(pluginId, pathToFileURL(rendererJs).href);
      } catch {
        // no renderer.js — main-process-only plugin
      }

      console.log(`[PluginHost] Loaded plugin "${plugin.name ?? pluginId}" v${version}`);
    } catch (err) {
      console.error(`[PluginHost] Failed to load plugin ${pluginId}:`, (err as Error).message);
      if (opts.throwOnError) throw err;
    }
  }

  private async _loadSettings(pluginId: string): Promise<void> {
    const file = path.join(this.pluginsDir, pluginId, 'settings.json');
    const stored = await readJson<PluginSettingsStore>(file, {});
    this.settingsCache.set(pluginId, stored);
  }

  private _buildApi(pluginId: string): ZephyrAPI {
    const host = this;
    return {
      ui: {
        addDetailButton(spec) {
          // Store the bare channel name. The `plugin:` prefix is applied in
          // the preload bridge when the renderer invokes.
          host.ui.detailButtons.push({
            label: spec.label,
            action: spec.action,
            icon: spec.icon,
          });
        },
      },
      ipc: {
        handle(channel, handler) {
          const full = `plugin:${channel}`;
          try {
            ipcMain.handle(full, async (_event, payload: unknown) => handler(payload));
          } catch {
            console.warn(`[PluginHost] Channel ${full} already registered — skipping duplicate`);
          }
        },
      },
      settings: {
        register(spec) {
          host.ui.settings.push({
            key: spec.key,
            label: spec.label,
            type: spec.type,
            options: spec.options,
            min: spec.min,
            max: spec.max,
            step: spec.step,
            hint: spec.hint,
            pluginId,
            value: null,
          });
        },
        get(key) {
          return host.settingsCache.get(pluginId)?.[key] ?? null;
        },
        async set(key, value) {
          if (!host.ui.settings.some((s) => s.pluginId === pluginId && s.key === key)) {
            console.warn(
              `[Plugin:${pluginId}] settings.set("${key}") — key not registered via settings.register(); value will be persisted but won't appear in the settings UI`,
            );
          }
          await host._applySetting(pluginId, key, value);
        },
        onChange(key, handler) {
          let byKey = host.settingChangeHandlers.get(pluginId);
          if (!byKey) {
            byKey = new Map();
            host.settingChangeHandlers.set(pluginId, byKey);
          }
          const existing = byKey.get(key) ?? [];
          existing.push(handler);
          byKey.set(key, existing);
        },
      },
      hooks: {
        onDownloadComplete(handler) {
          host.downloadCompleteHandlers.push(handler);
        },
        onAppReady(handler) {
          host.appReadyHandlers.push(handler);
        },
      },
    };
  }
}
