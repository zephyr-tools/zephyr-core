---
name: create-plugin
description: Scaffold a new Zephyr plugin in examples/plugins/. Use when creating a plugin that adds buttons, sections, pages, or behaviors to Zephyr without modifying core code.
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Create Zephyr Plugin: $ARGUMENTS

Scaffold a new Zephyr plugin named `$ARGUMENTS`.

## Checklist — implement each step in order:

### 1. Determine the plugin ID

The plugin ID must be lowercase, hyphen-separated, no spaces or special characters.
Examples: `open-steamdb`, `copy-release-name`, `hltb-lookup`, `steam-library`

Use `$ARGUMENTS` as the plugin ID (convert spaces to hyphens if needed).

### 2. Ask the user what the plugin should do

Before writing any code, ask:
- What should the button/action do? (open a URL, copy text, call an API, etc.)
- Does it need to store settings (API keys, preferences, dropdowns, numeric limits)?
- Should it react to setting changes made from the Settings UI (via `zephyr.settings.onChange`)?
- Should it fire on download complete (runs **after** the post-download virus scan, with the final `scanStatus`)?
- Does it need **renderer UI**? (rich React components in the detail page, full plugin pages, or detail sections with custom layouts — as opposed to simple IPC-triggered buttons)

If renderer UI is needed, the plugin requires a two-file structure (`index.js` + `renderer.jsx`) and a build step. See Step 5.

### 3. Create the main-process plugin file

Create `examples/plugins/$ARGUMENTS/index.js` using the template below.
Adapt the template to what the user described — don't leave placeholder comments.

```js
// @ts-check
/** @type {import('../zephyr-plugin').ZephyrPlugin} */
export default {
  name: 'Human Readable Name',
  version: '1.0.0',
  setup(zephyr) {
    // --- Register a button in the DetailPage top bar ---
    zephyr.ui.addDetailButton({
      label: 'Button Label',
      action: '$ARGUMENTS:action-name',   // must be unique; 'plugin:' prefix added automatically
    });

    // --- Handle the button click ---
    zephyr.ipc.handle('$ARGUMENTS:action-name', async (payload) => {
      // Button actions deliver the full Release object. Cast to the generated type.
      const release = /** @type {import('../zephyr-plugin').Release} */ (payload);
      const { shell } = await import('electron');
      await shell.openExternal(`https://example.com/?q=${encodeURIComponent(release.title)}`);
    });
  },
};
```

### 4. Add TypeScript support

The shared plugin types live at `examples/plugins/zephyr-plugin.d.ts` — do NOT recreate
it. In-repo plugin examples import via `'../zephyr-plugin'` because the `.d.ts` sits
one level up in `examples/plugins/`. Keep that path.

What the file exports:
- **Layer 1:** `ZephyrPlugin`, `ZephyrAPI` (+ sub-interfaces), `PluginButtonSpec`,
  `PluginSettingSpec`, `PluginSettingType`, `PluginSettingOption`
- **Layer 2 (if applicable):** `PluginDetailSection`, `PluginDetailButton`, `PluginRoute`,
  `PluginPageProps`, `RendererPluginExports`, `ZephyrWindowApi`
- **Auto-generated from `src/shared/types.ts`:** `Release`, `DownloadJob`, `DownloadStatus`,
  `ScanStatus`, `RdPhase` — refresh via `npm run generate:plugin-types` (also runs in CI).

For a strongly-typed release payload instead of the generic `unknown`, cast via
`/** @type {import('../zephyr-plugin').Release} */` inside your handler.

### 5. (If renderer UI needed) Scaffold renderer.jsx + build config

Only do this step if the user asked for renderer components: detail sections, full pages,
or custom React buttons that can't be expressed as a simple IPC action.

Reference the template at `examples/renderer-plugin-template/` — copy its structure:

**`examples/plugins/$ARGUMENTS/esbuild.config.js`** — copy the template verbatim;
it wires the React shim via esbuild's `alias` option. Key parts:
```js
import esbuild from 'esbuild';
import { resolve } from 'node:path';
import { cwd } from 'node:process';

await esbuild.build({
  entryPoints: ['src/renderer.jsx'],
  bundle: true,
  format: 'esm',
  outfile: 'renderer.js',
  alias: {
    // Redirect React imports to shims that read the host app's window globals.
    react: resolve(cwd(), 'src/react-shim.js'),
    'react/jsx-runtime': resolve(cwd(), 'src/react-jsx-runtime-shim.js'),
  },
  platform: 'browser',
  target: 'chrome120',
});
```
Copy `src/react-shim.js` and `src/react-jsx-runtime-shim.js` from
`examples/renderer-plugin-template/src/` into your plugin so the aliases resolve.

**`examples/plugins/$ARGUMENTS/src/renderer.jsx`**
```jsx
// React is NOT imported directly — it comes from window.__zephyrReact via the shim.
// Styling uses the Plugin UI Kit (.zephyr-* classes). Tailwind classes do NOT work.

export const detailSections = [
  {
    id: '$ARGUMENTS:my-section',
    title: 'Section Title',
    component: MySection,
  },
];

export const routes = [
  {
    id: '$ARGUMENTS:my-page',
    navLabel: 'My Page',
    component: () => import('./MyPage.jsx'),
  },
];

function MySection({ release }) {
  return (
    <div className="zephyr-card zephyr-stack">
      <span className="zephyr-label">{release.team}</span>
      <p className="zephyr-text-muted">{release.title}</p>
    </div>
  );
}
```

**Key rules for renderer plugins:**
- Never `import React from 'react'` directly — the esbuild shim redirects it to `window.__zephyrReact`
- Every `detailSections`, `detailButtons`, and `routes` entry needs a globally unique `id` (use `pluginId:name` pattern)
- `routes` entries must export a `navLabel` for the header nav button
- `component` in a route is a lazy-import function: `() => import('./MyPage.jsx')` (returns `{ default: Component }`)
- After editing renderer.jsx, run `npm run build` in the plugin directory before installing
- **Styling — use the Zephyr Plugin UI Kit, NOT Tailwind.** Tailwind classes from core are scanned at Zephyr's build time and unavailable in plugin bundles. Instead use:
  - **Utility classes**: `.zephyr-card`, `.zephyr-button[--primary|--ghost|--danger]`, `.zephyr-input`, `.zephyr-select`, `.zephyr-textarea`, `.zephyr-label`, `.zephyr-pill`, `.zephyr-text-{primary|secondary|muted|subtle|accent|danger|success}`, `.zephyr-stack[--md]`, `.zephyr-row`.
  - **CSS variables** (inline styles): `--zephyr-bg-{app|surface|elevated|hover}`, `--zephyr-border[-strong]`, `--zephyr-text-{primary|secondary|muted|subtle}`, `--zephyr-accent[-strong|-hover]`, `--zephyr-on-accent`, `--zephyr-danger|success|warning`, `--zephyr-radius[-sm|-lg]`, `--zephyr-font-{sans|mono}`.
  - Anything outside the `.zephyr-*` / `--zephyr-*` names is not part of the plugin contract.
- To invoke a plugin IPC handler from renderer JSX, call `window.api.invokePlugin('pluginId:action', payload)` — pass the bare channel name; the `plugin:` prefix is applied automatically.

**Install instructions for renderer plugins:**
> 1. Run `npm install && npm run build` in `examples/plugins/$ARGUMENTS/`
> 2. Copy the whole directory (including the built `renderer.js`) into `%APPDATA%\zephyr\plugins\`
> 3. Restart Zephyr

### 6. Install instructions (main-process-only plugins)

Tell the user:
> Copy `examples/plugins/$ARGUMENTS/` into `%APPDATA%\zephyr\plugins\` (Windows)
> or `~/Library/Application Support/zephyr/plugins/` (macOS), then restart Zephyr.
> The button will appear in the DetailPage top bar.

---

## ZephyrAPI Quick Reference

```
zephyr.ui.addDetailButton({ label, action, icon? })   → simple IPC-triggered button in DetailPage top bar

zephyr.ipc.handle(channel, handler)                    → register IPC handler (no 'plugin:' prefix)

zephyr.settings.register({ key, label, type, ...opts }) → declare a setting field
    type: 'text' | 'password' | 'toggle' | 'number' | 'select'
    extras: options?, min?, max?, step?, hint?
zephyr.settings.get(key)                               → read value (sync, returns null if unset)
zephyr.settings.set(key, value)                        → persist to disk (async); warns if unregistered
zephyr.settings.onChange(key, handler)                  → fires when value changes (from code or Settings UI)

zephyr.hooks.onDownloadComplete(handler)               → fires AFTER post-download virus scan; job.scanStatus is final
zephyr.hooks.onAppReady(handler)                       → fires after all plugins have loaded
```

**Renderer-only exports (in renderer.jsx, not index.js):**
```
export const detailSections = [{ id, title, component }]   → section below torrent results
export const detailButtons  = [{ id, component }]          → rich React button in DetailPage top bar
export const routes         = [{ id, navLabel, component }] → full-page route, nav button in header
```

Renderer components receive `{ release: Release }` (sections & buttons) or `{ release?: Release }` (routes).

## IPC Channel Naming

Use `pluginId:action` to namespace channels and avoid conflicts:
- `$ARGUMENTS:open` → registered as `plugin:$ARGUMENTS:open`
- `$ARGUMENTS:fetch-data` → registered as `plugin:$ARGUMENTS:fetch-data`

Never start the channel with `plugin:` yourself — Zephyr adds it automatically.

## Common Patterns

### Open an external URL based on release title
```js
zephyr.ipc.handle('$ARGUMENTS:open', async (release) => {
  const { shell } = await import('electron');
  const r = /** @type {{ title: string }} */ (release);
  await shell.openExternal(`https://your-site.com/search?q=${encodeURIComponent(r.title)}`);
});
```

### Copy text to clipboard
```js
zephyr.ipc.handle('$ARGUMENTS:copy', async (release) => {
  const { clipboard } = await import('electron');
  const r = /** @type {{ name: string }} */ (release);
  clipboard.writeText(r.name);
});
```

### Read/write a plugin setting (e.g. an API key)
```js
setup(zephyr) {
  // Must call register() before set() — otherwise set() still works but won't show in Settings UI
  zephyr.settings.register({ key: 'apiKey', label: 'API Key', type: 'password' });

  zephyr.ipc.handle('$ARGUMENTS:fetch', async (release) => {
    const apiKey = zephyr.settings.get('apiKey');
    if (!apiKey) return;
    // use apiKey ...
  });
}
```

### Dropdown, number, and toggle settings
```js
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
zephyr.settings.register({
  key: 'maxResults',
  label: 'Max results',
  type: 'number',
  min: 1,
  max: 100,
  step: 1,
  hint: 'Cap the number of results fetched per request',
});
zephyr.settings.register({ key: 'verbose', label: 'Verbose logging', type: 'toggle' });
```

### React to a setting change from the Settings UI
```js
setup(zephyr) {
  zephyr.settings.register({ key: 'apiKey', label: 'API Key', type: 'password' });

  // Re-initialise any in-memory state when the user edits this field.
  zephyr.settings.onChange('apiKey', (next) => {
    console.log('[$ARGUMENTS] apiKey updated — reconnecting');
    // e.g. rebuild your HTTP client, clear caches, etc.
  });
}
```

### React to a completed download (fires post-scan)
```js
zephyr.hooks.onDownloadComplete((job) => {
  // job is a fully-typed DownloadJob — see zephyr-plugin.d.ts
  // scanStatus is already resolved: 'clean' | 'threat' | 'error'
  if (job.scanStatus === 'threat') return;   // skip flagged files
  console.log(`[$ARGUMENTS] Download finished: ${job.name} at ${job.savePath}`);
});
```

### Renderer detail section (requires renderer.jsx + build step)
```jsx
// Use the Plugin UI Kit — `.zephyr-*` classes and `--zephyr-*` CSS variables.
// Tailwind classes (e.g. `text-zinc-300`) do NOT work in plugin bundles.

export const detailSections = [
  {
    id: '$ARGUMENTS:info',
    title: 'Extra Info',
    component: InfoSection,
  },
];

function InfoSection({ release }) {
  return (
    <div className="zephyr-card zephyr-stack">
      <span className="zephyr-label">Info</span>
      <p className="zephyr-text-muted">{release.title}</p>
    </div>
  );
}
```

## Security Note

Plugins run with full Node.js + Electron access. Only publish plugins that do what
they claim. Never call `zephyr.ipc.handle()` with channels that don't start with
your plugin's unique ID prefix.
