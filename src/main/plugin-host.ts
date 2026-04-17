import { promises as fs } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { DownloadJob, LoadedPlugin, PluginUi } from '@shared/types';
import { app, ipcMain, net } from 'electron';
import { readJson, writeJson } from './cache.js';

interface ZephyrAPI {
  ui: {
    addDetailButton(spec: { label: string; action: string; icon?: string }): void;
  };
  ipc: {
    handle(channel: string, handler: (payload: unknown) => unknown | Promise<unknown>): void;
  };
  settings: {
    register(spec: { key: string; label: string; type: 'text' | 'password' | 'toggle' }): void;
    get(key: string): unknown;
    set(key: string, value: unknown): Promise<void>;
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

export class PluginHost {
  private readonly pluginsDir: string;
  private ui: PluginUi = { detailButtons: [], detailSections: [], cardMenuItems: [], settings: [] };
  private settingsCache = new Map<string, PluginSettingsStore>();
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

    const res = await net.fetch(url);
    if (!res.ok) throw new Error(`Failed to fetch plugin: ${res.status}`);
    const js = await res.text();

    const filename = url.split('/').at(-1) ?? 'plugin.js';
    const pluginId = filename.replace(/\.js$/, '');

    const pluginDir = path.join(this.pluginsDir, pluginId);
    await fs.mkdir(pluginDir, { recursive: true });
    const entryFile = path.join(pluginDir, 'index.js');
    await fs.writeFile(entryFile, js, 'utf8');

    await this._loadPlugin(pluginId, entryFile);
    return pluginId;
  }

  getUi(): PluginUi {
    return this.ui;
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

  private async _loadPlugin(pluginId: string, entryFile: string): Promise<void> {
    try {
      await this._loadSettings(pluginId);
      const fileUrl = pathToFileURL(entryFile).href;
      const mod = (await import(fileUrl)) as PluginModule;
      const plugin = mod.default;

      if (!plugin || typeof plugin.setup !== 'function') {
        console.warn(`[PluginHost] Plugin ${pluginId}: no default export with setup() — skipping`);
        return;
      }

      plugin.setup(this._buildApi(pluginId));

      this.loadedPlugins.push({
        id: pluginId,
        name: plugin.name ?? pluginId,
        version: plugin.version ?? '0.0.0',
      });

      const rendererJs = path.join(path.dirname(entryFile), 'renderer.js');
      try {
        await fs.access(rendererJs);
        this.rendererUrls.set(pluginId, pathToFileURL(rendererJs).href);
      } catch {
        // no renderer.js — main-process-only plugin
      }

      console.log(
        `[PluginHost] Loaded plugin "${plugin.name ?? pluginId}" v${plugin.version ?? '?'}`,
      );
    } catch (err) {
      console.error(`[PluginHost] Failed to load plugin ${pluginId}:`, (err as Error).message);
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
          host.ui.detailButtons.push({
            label: spec.label,
            action: `plugin:${spec.action}`,
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
          host.ui.settings.push({ ...spec, pluginId });
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
          const store = host.settingsCache.get(pluginId) ?? {};
          store[key] = value;
          host.settingsCache.set(pluginId, store);
          await writeJson(path.join(host.pluginsDir, pluginId, 'settings.json'), store);
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
