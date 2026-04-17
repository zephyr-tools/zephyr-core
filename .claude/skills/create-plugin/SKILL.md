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
- Does it need to store settings (API keys, preferences)?
- Should it fire on download complete, or only when the user clicks?
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
    zephyr.ipc.handle('$ARGUMENTS:action-name', async (release) => {
      // release is a Release object — see DownloadJob in zephyr-plugin.d.ts for full type
      const { shell } = await import('electron');
      const r = /** @type {{ title: string }} */ (release);
      await shell.openExternal(`https://example.com/?q=${encodeURIComponent(r.title)}`);
    });
  },
};
```

### 4. Add TypeScript support

Copy `examples/plugins/zephyr-plugin.d.ts` reference into the plugin directory so the
`@type` import resolves. The file already exists at `examples/plugins/zephyr-plugin.d.ts` —
no need to recreate it. Just ensure the import path in the plugin is `'../zephyr-plugin'`.

The `DownloadJob` interface in that file is auto-generated from `src/shared/types.ts` via
`npm run generate:plugin-types` — it is always up to date and fully typed.

### 5. (If renderer UI needed) Scaffold renderer.jsx + build config

Only do this step if the user asked for renderer components: detail sections, full pages,
or custom React buttons that can't be expressed as a simple IPC action.

Reference the template at `examples/renderer-plugin-template/` — copy its structure:

**`examples/plugins/$ARGUMENTS/esbuild.config.js`**
```js
import esbuild from 'esbuild';
import { reactShimPlugin } from '../renderer-plugin-template/esbuild.config.js';
// Or inline the alias plugin — see renderer-plugin-template/esbuild.config.js for the full version
await esbuild.build({
  entryPoints: ['src/renderer.jsx'],
  bundle: true,
  format: 'esm',
  outfile: 'renderer.js',
  plugins: [reactShimPlugin],
});
```

**`examples/plugins/$ARGUMENTS/src/renderer.jsx`**
```jsx
// React is NOT imported directly — it comes from window.__zephyrReact via the shim
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
  return <div>{release.title}</div>;
}
```

**Key rules for renderer plugins:**
- Never `import React from 'react'` directly — the esbuild shim redirects it to `window.__zephyrReact`
- Every `detailSections` and `routes` entry needs a globally unique `id` (use `pluginId:name` pattern)
- `routes` entries must export a `navLabel` for the header nav button
- `component` in a route is a lazy-import function: `() => import('./MyPage.jsx')` (returns `{ default: Component }`)
- After editing renderer.jsx, run `npm run build` in the plugin directory before installing

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
zephyr.ui.addDetailButton({ label, action })      → simple IPC-triggered button in DetailPage top bar

zephyr.ipc.handle(channel, handler)               → register IPC handler (no 'plugin:' prefix)

zephyr.settings.register({ key, label, type })    → declare a setting field (must call before set())
zephyr.settings.get(key)                          → read value (sync, returns null if unset)
zephyr.settings.set(key, value)                   → persist to disk (async); warns if key not registered

zephyr.hooks.onDownloadComplete(handler)           → fires when any download completes (typed DownloadJob)
zephyr.hooks.onAppReady(handler)                  → fires after all plugins have loaded
```

**Renderer-only exports (in renderer.jsx, not index.js):**
```
export const detailSections = [{ id, title, component }]   → section below torrent results
export const detailButtons  = [{ id, component }]          → rich React button in DetailPage top bar
export const routes         = [{ id, navLabel, component }] → full-page route, nav button in header
```

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

### React to a completed download
```js
zephyr.hooks.onDownloadComplete((job) => {
  // job is a fully-typed DownloadJob — see zephyr-plugin.d.ts
  // Fields include: name, savePath, infoHash, status, progress, downloadSpeed, origin, scanStatus, rdPhase, ...
  console.log(`[my-plugin] Download finished: ${job.name} at ${job.savePath}`);
});
```

### Renderer detail section (requires renderer.jsx + build step)
```jsx
export const detailSections = [
  {
    id: '$ARGUMENTS:info',
    title: 'Extra Info',
    component: InfoSection,
  },
];

function InfoSection({ release }) {
  // release is the full Release object
  return <div className="text-zinc-300">{release.title}</div>;
}
```

## Security Note

Plugins run with full Node.js + Electron access. Only publish plugins that do what
they claim. Never call `zephyr.ipc.handle()` with channels that don't start with
your plugin's unique ID prefix.
