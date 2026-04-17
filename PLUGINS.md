# Zephyr Plugin System

Plugins extend Zephyr without modifying its source code. They live in your local `userData` directory and are loaded automatically at startup.

## Security Notice

Plugins run with **full Node.js access** inside Zephyr's main process — the same trust level as Zephyr itself. Only install plugins from sources you trust. The Zephyr authors are not responsible for the behavior of third-party plugins.

---

## Installation

**Plugins are distributed as `.zip` archives.** A plugin ZIP contains exactly one top-level directory whose name is the plugin ID (lowercase letters, digits, hyphens), and that directory contains the plugin's `index.js` (and optionally `renderer.js`, assets, etc.). There is no other supported package format.

Three install routes, all taking the same ZIP:

**1. From the Settings dialog (recommended).** Open **Settings → Plugins**:
- **Install → From URL**: paste an HTTPS URL that serves a plugin ZIP
- **Install → From local file**: pick a `.zip` file on disk via the native file picker
- **Installed**: a list of every plugin on disk, with **Remove** buttons

Any install or remove shows a "Restart required" banner with a **Restart now** button. Restart is required for UI contributions (buttons, pages, setting fields) and for Layer-2 renderer bundles to load.

**2. Manual file drop.** Extract your plugin ZIP into the `userData/plugins/` directory:
- **Windows:** `%APPDATA%\zephyr\plugins\`
- **macOS:** `~/Library/Application Support/zephyr/plugins/`

Then restart Zephyr.

**3. Programmatic.** From another plugin or the renderer:
```js
await window.api.installPlugin('https://example.com/my-plugin.zip');     // fetch + install
await window.api.installPluginFromZip('/absolute/path/to/my-plugin.zip'); // local file
```

### ZIP layout

```
my-plugin.zip
└── my-plugin/              ← top-level directory; name becomes the plugin ID
    ├── index.js            ← required
    ├── renderer.js         ← optional (Layer 2, built from renderer.jsx)
    ├── settings.json       ← optional; preserved across reinstalls if already installed
    └── …any other assets
```

Requirements enforced on install:
- Exactly one top-level directory inside the ZIP
- Directory name matches `^[a-z0-9][a-z0-9-]*$`
- That directory contains `index.js`
- No entries with `..` or absolute paths (zip-slip defense)
- Total uncompressed size ≤ 10 MB

### Packaging a plugin

For the in-repo examples, use the `package:plugin` script. It runs `npm install && npm run build` when the plugin has a build step, strips dev-only files (`node_modules`, `src/`, `package.json`, esbuild/tsconfig), and writes `examples/dist/<pluginId>.zip`:

```bash
# Layer 1, no build:
npm run package:plugin -- examples/plugins/open-pcgamingwiki
# → examples/dist/open-pcgamingwiki.zip

# Layer 2, builds renderer.js first:
npm run package:plugin -- examples/renderer-plugin-template
# → examples/dist/my-plugin.zip     (id from package.json zephyr.pluginId)
```

The plugin ID is resolved in this order: `--id` flag → `package.json`'s `zephyr.pluginId` → the directory basename. The renderer template ships with `"zephyr": { "pluginId": "my-plugin" }` in its `package.json` so its zip comes out correctly named without extra flags.

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
| `register(spec)` | Declare a settings field (appears in the Settings → Plugins tab) |
| `get(key)` | Read a persisted value synchronously (returns `null` if not set) |
| `set(key, value)` | Persist a value to `userData/plugins/<pluginId>/settings.json` |
| `onChange(key, handler)` | Subscribe to changes, including edits made from the Settings UI |

**Supported `type` values:** `'text'`, `'password'`, `'toggle'`, `'number'`, `'select'`.

| Type | Extra fields | Notes |
|---|---|---|
| `text` / `password` | `hint?` | Committed on blur |
| `toggle` | `hint?` | Committed immediately |
| `number` | `min?`, `max?`, `step?`, `hint?` | Empty input persists `null`; committed on blur |
| `select` | `options: [{ label, value }]`, `hint?` | Committed immediately |

> **Note:** Call `register()` before `set()`. Zephyr will persist the value either way, but unregistered keys won't appear in the Settings UI and a console warning is emitted. The UI-driven write path (`plugins:set-setting`) rejects unregistered keys outright.

```js
zephyr.settings.register({ key: 'apiKey', label: 'Service API Key', type: 'password' });
zephyr.settings.register({
  key: 'quality',
  label: 'Preferred quality',
  type: 'select',
  options: [
    { label: 'Low',    value: 'low' },
    { label: 'Medium', value: 'med' },
    { label: 'High',   value: 'high' },
  ],
});
zephyr.settings.register({ key: 'maxResults', label: 'Max results', type: 'number', min: 1, max: 100, step: 1 });

const key = zephyr.settings.get('apiKey');   // null until set
await zephyr.settings.set('apiKey', 'abc123');

// React to user edits from the Settings dialog:
zephyr.settings.onChange('apiKey', (newValue) => {
  console.log('apiKey updated:', newValue);
  // refresh in-memory clients, re-authenticate, etc.
});
```

### `zephyr.hooks`

| Method | Description |
|---|---|
| `onAppReady(handler)` | Called once after all plugins have loaded |
| `onDownloadComplete(handler)` | Called when a download transitions to `seeding` (complete) state |

`onDownloadComplete` fires **after** the post-download virus scan has resolved,
so `job.scanStatus` is the final result (`clean` | `threat` | `error`) and
`job.scanInfo` carries any details. See `zephyr-plugin.d.ts` for all fields:

```js
zephyr.hooks.onDownloadComplete((job) => {
  // job.name, job.savePath, job.infoHash, job.status, job.origin, job.scanStatus, ...
  if (job.scanStatus === 'threat') return;
  console.log(`Download complete: ${job.name} at ${job.savePath}`);
});
```

---

## Layer 2 — Renderer Plugin (`renderer.js`)

For rich UI — React components embedded in the detail page or full standalone pages — add a `renderer.js` alongside `index.js`. This file is built from JSX source using esbuild.

### What renderer plugins can contribute

| Export | Renders where | Props |
|---|---|---|
| `detailSections` | Below torrent results on the DetailPage | `{ release: Release }` — always present |
| `detailButtons` | In the DetailPage top bar (rich React components instead of plain IPC buttons) | `{ release: Release }` — always present |
| `routes` | Full-page views with a nav button in the app header | `{ release?: Release }` — the most recently-viewed release this session, or `undefined` if the user hasn't opened one yet |

The `release` prop on route components is sticky: opening a release and then navigating back to the grid and up to a plugin route still surfaces that release. It's a convenience for plugins that want to link "related" content to whatever the user was last looking at — route components that don't need a release context can simply ignore the prop.

### React sharing

Renderer plugins do **not** bundle their own React. Instead, Zephyr exposes React on `window.__zephyrReact` and `window.__zephyrJsxRuntime` before the app renders. Your esbuild config must alias `react` and `react/jsx-runtime` to shims that read these globals — otherwise hooks will fail with "Invalid hook call".

The `examples/renderer-plugin-template/` directory contains ready-to-use shims and an esbuild config. Copy it as your starting point.

### Styling — the Plugin UI Kit

**Tailwind classes from the host app do NOT work in plugin bundles.** Tailwind v4 scans source files at Zephyr's build time, so any class a plugin uses that isn't already used by core is absent from the shipped CSS.

Zephyr ships a stable public CSS contract instead — two parts:

**1. CSS variables.** Use these in inline styles to stay on theme:

```
--zephyr-bg-app           --zephyr-text-primary      --zephyr-accent
--zephyr-bg-surface       --zephyr-text-secondary    --zephyr-accent-strong
--zephyr-bg-elevated      --zephyr-text-muted        --zephyr-accent-hover
--zephyr-bg-hover         --zephyr-text-subtle       --zephyr-on-accent
--zephyr-border           --zephyr-danger            --zephyr-radius
--zephyr-border-strong    --zephyr-success           --zephyr-radius-sm
                          --zephyr-warning           --zephyr-radius-lg
```

**2. Utility classes.** Drop these into `className` — they are guaranteed to stay available across Zephyr versions:

| Class | Purpose |
|---|---|
| `zephyr-card`, `zephyr-card--muted` | Panel containers |
| `zephyr-button`, `zephyr-button--primary`, `zephyr-button--ghost`, `zephyr-button--danger` | Buttons |
| `zephyr-input`, `zephyr-select`, `zephyr-textarea` | Form fields |
| `zephyr-label` | Uppercase small-caps label above a field |
| `zephyr-pill` | Inline chip/badge |
| `zephyr-text-{primary,secondary,muted,subtle,accent,danger,success}` | Text color |
| `zephyr-stack`, `zephyr-stack--md` | Vertical flex with gap (8px / 16px) |
| `zephyr-row` | Horizontal flex with 8px gap |

Anything outside this list is not part of the plugin contract and may change without notice.

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
  return (
    <div className="zephyr-card zephyr-stack">
      <span className="zephyr-label">Notes</span>
      <p className="zephyr-text-muted">{release.title}</p>
      <button type="button" className="zephyr-button zephyr-button--primary">
        Save
      </button>
    </div>
  );
}
```

### Calling plugin IPC handlers from renderer code

```jsx
// Pass the bare channel name — the `plugin:` prefix is applied automatically.
await window.api.invokePlugin('my-plugin:save-note', { id: release.id, note });
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

The same `zephyr-plugin.d.ts` covers both layers:

- **Layer 1** — `ZephyrPlugin`, `ZephyrAPI`, `PluginButtonSpec`, `PluginSettingSpec`, `DownloadJob`, `Release`
- **Layer 2** — `PluginDetailSection`, `PluginDetailButton`, `PluginRoute`, `PluginPageProps`, `RendererPluginExports`, `ZephyrWindowApi`

For IntelliSense in VS Code without a build step (Layer 1 only):

1. Copy `examples/plugins/zephyr-plugin.d.ts` into your plugin directory.
2. Add `// @ts-check` to the top of `index.js`.
3. Annotate your export:

```js
// @ts-check
/** @type {import('./zephyr-plugin').ZephyrPlugin} */
export default { ... }
```

You get autocomplete on all `zephyr.*` methods, a fully-typed `Release` for button actions, and a fully-typed `DownloadJob` in `onDownloadComplete`.

> The `Release`, `DownloadJob`, and related types in `zephyr-plugin.d.ts` are auto-generated from Zephyr's source — run `npm run generate:plugin-types` to refresh them after a Zephyr update (CI runs this automatically before typecheck).

---

## Install, Remove, and Restart

Both install methods take the same ZIP format (see "ZIP layout" above) and share the same validation, rollback, and settings-preservation logic. The only difference is where the ZIP comes from.

### URL install (`installPlugin`)
```js
await window.api.installPlugin('https://example.com/my-plugin.zip');
```
- Requires `https://` scheme and a valid URL
- Fetched bytes are size-checked against the 10 MB cap before any disk write
- The bytes are buffered to a temp file and then handed off to the same extraction pipeline as a local install; the temp file is removed after
- The plugin ID is the ZIP's top-level directory name — **not** the URL basename — so `https://example.com/download` can serve a ZIP that extracts as `my-plugin`

### Local ZIP install (`installPluginFromZip`)
```js
// From the Plugins tab, this happens after the native file picker.
// Programmatic callers pass an absolute path:
await window.api.installPluginFromZip('/absolute/path/to/my-plugin.zip');
```

### Reinstall behavior (both methods)
If a plugin with the same ID already exists, its `settings.json` is preserved across the reinstall. All other files in the target directory are overwritten. If `setup()` throws during the reinstall, only the freshly-extracted files are rolled back — the prior install stays functional.

### Remove (`removePlugin`)
```js
await window.api.removePlugin('my-plugin');
```
Deletes the plugin directory (including `settings.json`). The plugin remains loaded in the running main process until restart — IPC handlers continue to respond, setting-change listeners still fire — but a restart removes it entirely.

### Restart (`restartApp`)
```js
await window.api.restartApp();   // app.relaunch() + app.exit(0)
```
Relaunches the app with the same arguments, so install/remove effects flow through to both main and renderer.

**Only install from HTTPS URLs or trusted ZIPs. Plugins run with full system access.**

---

## Example Plugins

Ready-to-use examples are in `examples/plugins/` (Layer 1) and `examples/renderer-plugin-template/` (Layer 1+2). Package any of them with `npm run package:plugin -- <dir>` and install the resulting ZIP via Settings → Plugins.

| Plugin | Layer | What it does |
|---|---|---|
| `open-steamdb` | 1 | Adds "SteamDB" button → opens steamdb.info search for the game title |
| `open-pcgamingwiki` | 1 | Adds "PCGamingWiki" button → opens the PCGamingWiki search |
| `copy-release-name` | 1 | Adds "Copy Name" button → copies the scene release name to clipboard |
| `renderer-plugin-template` | 1+2 | **Notes reference implementation.** Exercises the full renderer API surface: a per-release notes section below torrent results (detail section) and a "My Notes" page listing every saved note (route). Data round-trips through IPC to main-process storage via `zephyr.settings.set/get`. The Layer-1 side also demonstrates `onDownloadComplete` with the resolved scan status. Good starting point for a non-trivial plugin — clone the folder and strip what you don't need. |

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
