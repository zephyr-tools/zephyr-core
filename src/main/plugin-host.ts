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
import { unzipSync } from 'fflate';
import { readJson, writeJson } from './cache.js';

const MAX_ZIP_BYTES = 10 * 1024 * 1024;

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

const VALID_PLUGIN_ID = /^[a-z0-9][a-z0-9-]*$/;

export class PluginHost {
  private readonly pluginsDir: string;
  private ui: PluginUi = { detailButtons: [], settings: [] };
  private settingsCache = new Map<string, PluginSettingsStore>();
  private settingChangeHandlers = new Map<
    string /* pluginId */,
    Map<string /* key */, Array<(value: unknown) => void>>
  >();
  private unregisteredSetWarnings = new Set<string>(); // `${pluginId}:${key}`, warned-once
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

      let stat: Awaited<ReturnType<typeof fs.stat>>;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }
      if (!stat.isDirectory()) continue;

      const pluginId = entry;
      const entryFile = path.join(fullPath, 'index.js');

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

  /** Fetch an HTTPS URL pointing to a plugin ZIP, then delegate to `installFromZip`. */
  async installFromUrl(url: string): Promise<string> {
    if (!/^https:\/\//.test(url)) throw new Error('Plugin URL must use HTTPS');
    try {
      new URL(url);
    } catch {
      throw new Error('Plugin URL is not a valid URL');
    }

    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch plugin: ${res.status}`);

    const ab = await res.arrayBuffer();
    if (ab.byteLength > MAX_ZIP_BYTES) {
      throw new Error(
        `ZIP exceeds the ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)} MB plugin size limit`,
      );
    }

    const tmpPath = path.join(
      app.getPath('temp'),
      `zephyr-plugin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.zip`,
    );
    await fs.writeFile(tmpPath, Buffer.from(ab));
    try {
      return await this.installFromZip(tmpPath);
    } finally {
      await fs.rm(tmpPath, { force: true }).catch(() => undefined);
    }
  }

  getUi(): PluginUi {
    return {
      detailButtons: this.ui.detailButtons,
      settings: this.ui.settings.map((s) => ({
        ...s,
        value: this.settingsCache.get(s.pluginId)?.[s.key] ?? null,
      })),
    };
  }

  /**
   * Extract a plugin ZIP into `userData/plugins/<id>/` and load it. The ZIP
   * must contain one top-level directory (the plugin id) with an `index.js`
   * inside; path traversal and absolute paths are rejected. An existing
   * `settings.json` is preserved across reinstalls.
   */
  async installFromZip(zipPath: string): Promise<string> {
    let stat: Awaited<ReturnType<typeof fs.stat>>;
    try {
      stat = await fs.stat(zipPath);
    } catch {
      throw new Error(`ZIP file not found: ${zipPath}`);
    }
    if (!stat.isFile()) throw new Error('Path is not a file');
    if (stat.size > MAX_ZIP_BYTES) {
      throw new Error(
        `ZIP exceeds the ${Math.round(MAX_ZIP_BYTES / 1024 / 1024)} MB plugin size limit`,
      );
    }

    const bytes = await fs.readFile(zipPath);

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(new Uint8Array(bytes));
    } catch (err) {
      throw new Error(`Invalid ZIP: ${(err as Error).message}`);
    }

    const fileEntries = Object.entries(unzipped).filter(([name]) => !name.endsWith('/'));
    if (fileEntries.length === 0) throw new Error('ZIP is empty');

    for (const [name] of fileEntries) {
      if (name.startsWith('/') || name.includes('\\') || name.split('/').includes('..')) {
        throw new Error(`Unsafe entry path in ZIP: "${name}"`);
      }
    }

    const firstEntryName = fileEntries[0]?.[0];
    if (!firstEntryName) throw new Error('ZIP is empty');
    const firstSlash = firstEntryName.indexOf('/');
    if (firstSlash === -1) {
      throw new Error(
        'ZIP must contain exactly one top-level directory (e.g. `my-plugin/index.js`), not loose files',
      );
    }
    const rootDir = firstEntryName.slice(0, firstSlash);
    for (const [name] of fileEntries) {
      if (!name.startsWith(`${rootDir}/`)) {
        throw new Error(
          `ZIP must contain exactly one top-level directory; found both "${rootDir}/" and "${name.split('/')[0]}/"`,
        );
      }
    }

    if (!VALID_PLUGIN_ID.test(rootDir)) {
      throw new Error(
        `Plugin ID "${rootDir}" is invalid. Use lowercase letters, digits, and hyphens only.`,
      );
    }
    if (!(`${rootDir}/index.js` in unzipped)) {
      throw new Error(`ZIP is missing "${rootDir}/index.js"`);
    }

    const pluginId = rootDir;
    const pluginDir = path.join(this.pluginsDir, pluginId);

    // Snapshot the existing settings so a reinstall doesn't wipe user config.
    let preservedSettings: Buffer | null = null;
    try {
      preservedSettings = await fs.readFile(path.join(pluginDir, 'settings.json'));
    } catch {}

    await fs.mkdir(pluginDir, { recursive: true });

    const extractedPaths: string[] = [];
    try {
      for (const [entryName, content] of fileEntries) {
        const relative = entryName.slice(rootDir.length + 1);
        if (!relative) continue;
        const destPath = path.join(pluginDir, relative);
        // Defense in depth: refuse paths that escape the plugin dir.
        if (!destPath.startsWith(pluginDir + path.sep) && destPath !== pluginDir) {
          throw new Error(`Unsafe entry resolved outside plugin dir: "${entryName}"`);
        }
        await fs.mkdir(path.dirname(destPath), { recursive: true });
        await fs.writeFile(destPath, Buffer.from(content));
        extractedPaths.push(destPath);
      }

      if (preservedSettings) {
        await fs.writeFile(path.join(pluginDir, 'settings.json'), preservedSettings);
      }

      await this._loadPlugin(pluginId, path.join(pluginDir, 'index.js'), { throwOnError: true });
    } catch (err) {
      if (preservedSettings == null) {
        await fs.rm(pluginDir, { recursive: true, force: true }).catch(() => undefined);
      } else {
        for (const p of extractedPaths) {
          await fs.rm(p, { force: true }).catch(() => undefined);
        }
      }
      throw err;
    }

    return pluginId;
  }

  /** Delete a plugin's directory. Running IPC handlers stay live until restart. */
  async removePlugin(pluginId: string): Promise<void> {
    if (!VALID_PLUGIN_ID.test(pluginId)) throw new Error('Invalid plugin id');
    const pluginDir = path.join(this.pluginsDir, pluginId);
    // Defense in depth — VALID_PLUGIN_ID already blocks traversal.
    if (!pluginDir.startsWith(this.pluginsDir + path.sep)) {
      throw new Error('Plugin path is outside the plugins directory');
    }
    try {
      await fs.stat(pluginDir);
    } catch {
      throw new Error(`Plugin "${pluginId}" is not installed`);
    }
    await fs.rm(pluginDir, { recursive: true, force: true });
  }

  async setPluginSetting(pluginId: string, key: string, value: unknown): Promise<void> {
    if (!VALID_PLUGIN_ID.test(pluginId)) throw new Error('Invalid plugin id');
    if (!this.ui.settings.some((s) => s.pluginId === pluginId && s.key === key)) {
      throw new Error(`Setting "${key}" is not registered for plugin "${pluginId}"`);
    }
    await this._applySetting(pluginId, key, value);
  }

  /** Single write path shared by `zephyr.settings.set` and `plugins:set-setting`. */
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
        console.warn(`[PluginHost] ${msg} - skipping`);
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
          // `action` is the bare channel; preload prefixes `plugin:` on invoke.
          host.ui.detailButtons.push({ ...spec });
        },
      },
      ipc: {
        handle(channel, handler) {
          const full = `plugin:${channel}`;
          try {
            ipcMain.handle(full, async (_event, payload: unknown) => handler(payload));
          } catch {
            console.warn(`[PluginHost] Channel ${full} already registered - skipping duplicate`);
          }
        },
      },
      settings: {
        register(spec) {
          host.ui.settings.push({ ...spec, pluginId, value: null });
        },
        get(key) {
          return host.settingsCache.get(pluginId)?.[key] ?? null;
        },
        async set(key, value) {
          if (!host.ui.settings.some((s) => s.pluginId === pluginId && s.key === key)) {
            const warnKey = `${pluginId}:${key}`;
            if (!host.unregisteredSetWarnings.has(warnKey)) {
              host.unregisteredSetWarnings.add(warnKey);
              console.warn(
                `[Plugin:${pluginId}] settings.set("${key}") - key not registered via settings.register(); value will be persisted but won't appear in the settings UI. (This warning fires once per key.)`,
              );
            }
          }
          await host._applySetting(pluginId, key, value);
        },
        onChange(key, handler) {
          let byKey = host.settingChangeHandlers.get(pluginId);
          if (!byKey) {
            byKey = new Map();
            host.settingChangeHandlers.set(pluginId, byKey);
          }
          const handlers = byKey.get(key) ?? [];
          handlers.push(handler);
          byKey.set(key, handlers);
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
