---
name: create-plugin
description: Scaffold a new Zephyr plugin in examples/plugins/. Use when creating a plugin that adds buttons, sections, or behaviors to Zephyr without modifying core code.
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

### 3. Create the plugin file

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
      // release is a Release object: { title, name, team, size, ... }
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

### 5. Install instructions

Tell the user:
> Copy `examples/plugins/$ARGUMENTS/` into `%APPDATA%\zephyr\plugins\` (Windows)
> or `~/Library/Application Support/zephyr/plugins/` (macOS), then restart Zephyr.
> The button will appear in the DetailPage top bar.

---

## ZephyrAPI Quick Reference

```
zephyr.ui.addDetailButton({ label, action })      → button in DetailPage top bar
zephyr.ui.addDetailSection({ title, action })     → section below torrent results (future)
zephyr.ui.addCardMenuItem({ label, action })      → release card context menu (future)

zephyr.ipc.handle(channel, handler)               → register IPC handler (no 'plugin:' prefix)

zephyr.settings.register({ key, label, type })    → declare a setting field
zephyr.settings.get(key)                          → read value (sync, returns null if unset)
zephyr.settings.set(key, value)                   → persist to disk (async)

zephyr.hooks.onDownloadComplete(handler)           → fires when any download completes
zephyr.hooks.onAppReady(handler)                  → fires after all plugins have loaded
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
  // job: { name, savePath, infoHash, status, ... }
  console.log(`[my-plugin] Download finished: ${job.name}`);
});
```

## Security Note

Plugins run with full Node.js + Electron access. Only publish plugins that do what
they claim. Never call `zephyr.ipc.handle()` with channels that don't start with
your plugin's unique ID prefix.
