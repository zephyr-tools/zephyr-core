# Zephyr Plugin System

Plugins extend Zephyr without modifying its source code. They live in your local `userData` directory and are loaded automatically at startup.

## Security Notice

Plugins run with **full Node.js access** inside Zephyr's main process — the same trust level as Zephyr itself. Only install plugins from sources you trust. The Zephyr authors are not responsible for the behavior of third-party plugins.

---

## Installation

1. Locate your Zephyr `userData` directory:
   - **Windows:** `%APPDATA%\zephyr\`
   - **macOS:** `~/Library/Application Support/zephyr/`
2. Create a `plugins/` subdirectory if it does not exist.
3. Copy your plugin folder into it.
4. Restart Zephyr.

Zephyr also supports installing plugins directly from a URL — see [Remote Installation](#remote-installation) below.

---

## Plugin Architecture

Zephyr plugins have two layers. You can use either or both:

| Layer | File | What it can do |
|---|---|---|
| **Layer 1** — Main process | `index.js` | Add IPC-triggered buttons, handle clicks, read settings, react to downloads |
| **Layer 2** — Renderer | `renderer.js` | Inject React components: detail sections, full pages, rich buttons |

Layer 1 is zero-config — plain ES modules, no build step. Layer 2 requires an esbuild build to bundle your JSX.

### Plugin directory layout

```
userData/plugins/
  my-plugin/
    index.js          ← Layer 1 (required)
    renderer.js       ← Layer 2 (optional, built from renderer.jsx)
    settings.json     ← auto-created by Zephyr when settings are saved
```

---

## Layer 1 — Main Process Plugin (`index.js`)

A plugin is a JavaScript ES module with a default export:

```js
// @ts-check
/** @type {import('./zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'My Plugin',
  version: '1.0.0',
  setup(zephyr) {
    // Register UI and IPC handlers here
  },
};
```

### Minimal example — add a button that opens a URL

```js
// @ts-check
/** @type {import('./zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Open SteamDB',
  version: '1.0.0',
  setup(zephyr) {
    zephyr.ui.addDetailButton({
      label: 'SteamDB',
      action: 'steamdb:open',     // channel name WITHOUT 'plugin:' prefix
    });

    zephyr.ipc.handle('steamdb:open', async (release) => {
      const { shell } = await import('electron');
      const r = /** @type {{ title: string }} */ (release);
      await shell.openExternal(
        `https://www.steamdb.info/search/?q=${encodeURIComponent(r.title)}`,
      );
    });
  },
};
```

The `release` payload passed to your handler is the full `Release` object. The most useful fields:

| Field | Type | Description |
|---|---|---|
| `title` | `string` | Game title (e.g. `"Elden Ring"`) |
| `name` | `string` | Full scene release name (e.g. `"Elden.Ring-CODEX"`) |
| `team` | `string` | Scene group name (e.g. `"CODEX"`) |
| `size` | `number` | Release size in bytes |

---

## Layer 1 API Reference

### `zephyr.ui`

| Method | Description |
|---|---|
| `addDetailButton(spec)` | Add an IPC-triggered button to the DetailPage top bar |

**`addDetailButton` spec:**

```ts
{
  label: string   // Button text
  action: string  // IPC channel (without 'plugin:' prefix)
  icon?: string   // Reserved for future use
}
```

### `zephyr.ipc`

| Method | Description |
|---|---|
| `handle(channel, handler)` | Register an IPC handler. Channel must NOT include `plugin:` prefix — it is added automatically. |

The full registered channel becomes `plugin:<channel>`. Use your plugin ID as a namespace prefix to avoid conflicts:

```js
// Good — namespaced
zephyr.ipc.handle('steamdb:open', handler)     // → 'plugin:steamdb:open'

// Risky — too generic, may conflict
zephyr.ipc.handle('open', handler)             // → 'plugin:open'
```

### `zephyr.settings`

| Method | Description |
|---|---|
| `register(spec)` | Declare a settings field (appears in Zephyr's Settings panel) |
| `get(key)` | Read a persisted value synchronously (returns `null` if not set) |
| `set(key, value)` | Persist a value to `userData/plugins/<pluginId>/settings.json` |

> **Note:** Call `register()` before `set()`. Zephyr will persist the value either way, but unregistered keys won't appear in the Settings UI and a console warning is emitted.

```js
zephyr.settings.register({ key: 'apiKey', label: 'My Service API Key', type: 'password' });

const key = zephyr.settings.get('apiKey');   // null until set
await zephyr.settings.set('apiKey', 'abc123');
```

### `zephyr.hooks`

| Method | Description |
|---|---|
| `onAppReady(handler)` | Called once after all plugins have loaded |
| `onDownloadComplete(handler)` | Called when a download transitions to `seeding` (complete) state |

`onDownloadComplete` receives a fully-typed `DownloadJob` — see `zephyr-plugin.d.ts` for all fields:

```js
zephyr.hooks.onDownloadComplete((job) => {
  // job.name, job.savePath, job.infoHash, job.status, job.origin, job.scanStatus, ...
  console.log(`Download complete: ${job.name} at ${job.savePath}`);
});
```

---

## Layer 2 — Renderer Plugin (`renderer.js`)

For rich UI — React components embedded in the detail page or full standalone pages — add a `renderer.js` alongside `index.js`. This file is built from JSX source using esbuild.

### What renderer plugins can contribute

| Export | Renders where |
|---|---|
| `detailSections` | Below torrent results on the DetailPage |
| `detailButtons` | In the DetailPage top bar (rich React components instead of plain IPC buttons) |
| `routes` | Full-page views with a nav button in the app header |

### React sharing

Renderer plugins do **not** bundle their own React. Instead, Zephyr exposes React on `window.__zephyrReact` and `window.__zephyrJsxRuntime` before the app renders. Your esbuild config must alias `react` and `react/jsx-runtime` to shims that read these globals — otherwise hooks will fail with "Invalid hook call".

The `examples/renderer-plugin-template/` directory contains ready-to-use shims and an esbuild config. Copy it as your starting point.

### Example `renderer.jsx`

```jsx
// Do NOT import React directly — it comes via the window global shim

export const detailSections = [
  {
    id: 'my-plugin:notes',          // must be globally unique across all plugins
    title: 'My Notes',
    component: NotesSection,
  },
];

export const routes = [
  {
    id: 'my-plugin:dashboard',      // must be globally unique
    navLabel: 'Dashboard',          // text shown in the header nav button
    component: () => import('./Dashboard.jsx'),  // lazy — returns { default: Component }
  },
];

function NotesSection({ release }) {
  return <div className="text-zinc-300 p-4">{release.title}</div>;
}
```

### Building

```bash
# In your plugin directory:
npm install
npm run build      # produces renderer.js from renderer.jsx
```

### Install instructions for renderer plugins

1. Run `npm install && npm run build` in your plugin directory.
2. Copy the entire directory — including the built `renderer.js` — into `userData/plugins/`.
3. Restart Zephyr.

> If you update renderer.jsx, re-run `npm run build` and copy the new `renderer.js` before restarting.

### Error isolation

Each plugin render point is wrapped in an error boundary. A crashing renderer plugin shows an inline error card — it does not affect the rest of the app or other plugins.

---

## TypeScript / JSDoc Support

For IntelliSense in VS Code without a build step (Layer 1 only):

1. Copy `examples/plugins/zephyr-plugin.d.ts` into your plugin directory.
2. Add `// @ts-check` to the top of `index.js`.
3. Annotate your export:

```js
// @ts-check
/** @type {import('./zephyr-plugin').ZephyrPlugin} */
export default { ... }
```

You get autocomplete on all `zephyr.*` methods and a fully-typed `DownloadJob` in `onDownloadComplete`.

> The `DownloadJob` type in `zephyr-plugin.d.ts` is auto-generated from Zephyr's source — run `npm run generate:plugin-types` to refresh it after a Zephyr update.

---

## Remote Installation

Zephyr can install a plugin directly from a `.js` URL:

```js
// From another plugin or future Settings UI:
await window.api.installPlugin('https://example.com/my-plugin.js');
```

The file is downloaded to `userData/plugins/my-plugin/index.js` and loaded immediately — no restart needed.

> Remote installation only supports single-file Layer 1 plugins. Renderer plugins (Layer 2) must be installed manually.

**Only install from HTTPS URLs. Only install from sources you trust.** A plugin installed this way runs with full system access.

---

## Example Plugins

Ready-to-use examples are in `examples/plugins/`. Copy any folder into your `userData/plugins/` directory.

| Plugin | Layer | What it does |
|---|---|---|
| `open-steamdb` | 1 | Adds "SteamDB" button → opens steamdb.info search for the game title |
| `open-pcgamingwiki` | 1 | Adds "PCGamingWiki" button → opens the PCGamingWiki search |
| `copy-release-name` | 1 | Adds "Copy Name" button → copies the scene release name to clipboard |
| `renderer-plugin-template` | 1+2 | Starter template with esbuild config, React shims, example section and page |

---

## Channel Naming Guide

To avoid conflicts between plugins, follow the `pluginId:action` convention:

```
open-steamdb:open      ✓  namespaced, clear
copy-name:run          ✓  namespaced, clear
open                   ✗  too generic
search                 ✗  may conflict with core or other plugins
```

The `plugin:` prefix is always added by Zephyr — never include it yourself.

---

## Publishing a Plugin

There is no central registry. Distribute your plugin however you like:
- A GitHub repo (users can install Layer 1 plugins via raw URL; Layer 2 via ZIP)
- A ZIP archive users extract into `userData/plugins/`
- Direct file download

Add `zephyr-plugin` as a topic/tag so others can find it on GitHub.
