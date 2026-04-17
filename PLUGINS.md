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
3. Copy your plugin folder (or `.js` file) into it.
4. Restart Zephyr.

Zephyr also supports installing plugins directly from a URL — see [Remote Installation](#remote-installation) below.

---

## Plugin File Conventions

Two layouts are supported:

```
userData/plugins/
  my-plugin/          ← directory plugin (recommended)
    index.js          ← required entry point
  another-plugin.js   ← single-file plugin (simpler, no settings persistence)
```

Both are plain ES module files — no bundler, no `node_modules`, no build step.

---

## Writing a Plugin

A plugin is a JavaScript ES module with a default export object:

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

## API Reference

### `zephyr.ui`

| Method | Description |
|---|---|
| `addDetailButton(spec)` | Add a button to the DetailPage top bar (next to "View Release") |
| `addDetailSection(spec)` | Add a section below torrent results in DetailPage *(rendered in a future release)* |
| `addCardMenuItem(spec)` | Add an item to the ReleaseCard context menu *(rendered in a future release)* |

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

The full registered channel becomes `plugin:<channel>`. Use your plugin ID as a namespace prefix to avoid conflicts with other plugins:

```js
// Good — namespaced
zephyr.ipc.handle('steamdb:open', handler)     // → 'plugin:steamdb:open'

// Risky — too generic, may conflict
zephyr.ipc.handle('open', handler)             // → 'plugin:open'
```

### `zephyr.settings`

| Method | Description |
|---|---|
| `register(spec)` | Declare a settings field (appears in a future settings UI) |
| `get(key)` | Read a persisted value synchronously (returns `null` if not set) |
| `set(key, value)` | Persist a value to `userData/plugins/<pluginId>/settings.json` |

```js
zephyr.settings.register({ key: 'apiKey', label: 'My Service API Key', type: 'password' });

// Reading:
const key = zephyr.settings.get('apiKey');  // null until set

// Writing:
await zephyr.settings.set('apiKey', 'abc123');
```

### `zephyr.hooks`

| Method | Description |
|---|---|
| `onAppReady(handler)` | Called once after all plugins have loaded |
| `onDownloadComplete(handler)` | Called when a download transitions to `seeding` (complete) state |

```js
zephyr.hooks.onDownloadComplete((job) => {
  console.log(`Download complete: ${job.name} at ${job.savePath}`);
});
```

---

## TypeScript / JSDoc Support

For IntelliSense in VS Code without a build step:

1. Copy `examples/plugins/zephyr-plugin.d.ts` into your plugin directory.
2. Add `// @ts-check` to the top of `index.js`.
3. Annotate your export:

```js
// @ts-check
/** @type {import('./zephyr-plugin').ZephyrPlugin} */
export default { ... }
```

You will get autocomplete on all `zephyr.ui`, `zephyr.ipc`, `zephyr.settings`, and `zephyr.hooks` methods, plus type-checked `release` payloads via JSDoc casts.

---

## Remote Installation

Zephyr can install a plugin directly from a `.js` URL:

```js
// From another plugin or future Settings UI:
await window.api.installPlugin('https://example.com/my-plugin.js');
```

The file is downloaded to `userData/plugins/my-plugin/index.js` and loaded immediately — no restart needed.

**Only install from HTTPS URLs. Only install from sources you trust.** A plugin installed this way runs with full system access.

---

## Example Plugins

Ready-to-use examples are in `examples/plugins/`. Copy any folder into your `userData/plugins/` directory and restart Zephyr.

| Plugin | What it does |
|---|---|
| `open-steamdb` | Adds "SteamDB" button → opens steamdb.info search for the game title |
| `open-pcgamingwiki` | Adds "PCGamingWiki" button → opens the PCGamingWiki search |
| `copy-release-name` | Adds "Copy Name" button → copies the scene release name to clipboard |

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
- A GitHub repo with an `index.js` at the root (users can install via raw URL)
- A ZIP archive users extract into `userData/plugins/`
- Direct file download

Add `zephyr-plugin` as a topic/tag so others can find it on GitHub.
