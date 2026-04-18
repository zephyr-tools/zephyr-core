# Achievement Watcher — Architecture Spec

## Problem

Zephyr supports auto-start via `app.setLoginItemSettings()` (toggled in Settings → Application).
However, FSE defers all startup apps until the user manually switches to the desktop — so even
with auto-start enabled, Zephyr does not run while a game is active in FSE.

The achievement watcher must therefore operate independently of Zephyr being open, and
notifications must surface inside FSE via the Xbox Game Bar overlay.

---

## Components

```
┌─────────────────────────────────────────────────────────────────────┐
│  Windows Service  (zephyr-achievement-watcher)                      │
│  Node.js — runs at boot, SESSION 0, full filesystem access          │
│  • Watches emulator achievement files                               │
│  • Parses unlocks, maintains state                                  │
│  • Queues unlock events                                             │
│  • Exposes WebSocket server on 127.0.0.1:37265                      │
└────────────────────────────┬────────────────────────────────────────┘
                             │ WebSocket (push)
              ┌──────────────┴──────────────┐
              │                             │
┌─────────────▼──────────┐   ┌─────────────▼──────────────────────────┐
│  Game Bar Widget        │   │  Zephyr Plugin (achievement-watcher)   │
│  UWP XAML + WebView2    │   │  Connects as WS client when app open   │
│  • Must be PINNED to    │   │  • Sends game registrations to service │
│    stay active in FSE   │   │  • Receives unlocks for in-app UI      │
│  • Transparent when     │   │  • Fetches Steam schemas               │
│    idle (no toasts)     │   │  • Library integration                 │
│  • Renders toasts in    │   └────────────────────────────────────────┘
│    Game Bar overlay     │
└─────────────────────────┘
```

---

## Data Flow

1. Game runs → emulator writes achievement file to disk
2. Service (file watcher) detects change via `fs.watch`
3. Service parses file, diffs against known state → new unlock
4. Service appends to queue, broadcasts `achievement:unlock` to all WS clients
5. Widget (if pinned and active) receives event → renders toast over game
6. Zephyr plugin (if app is open) receives event → updates in-app achievement page

If the widget was not connected when the unlock fired, it receives the queued backlog
on next connect (e.g. when the user opens Game Bar mid-session).

---

## WebSocket Protocol

Port: `37265`. All messages are JSON with a `type` field.

### Service → Client

```json
// Broadcast on unlock
{ "type": "achievement:unlock",
  "id": "<uuid>",
  "gameId": "<infoHash>",
  "gameTitle": "Game Title",
  "achievementId": "ACH_WIN_100",
  "achievementName": "Centurion",
  "achievementDesc": "Win 100 games",
  "iconUrl": "https://cdn.steamstatic.com/...",
  "unlockedAt": 1713456789000 }

// Sent to new client on connect — delivers pending queue + current state
{ "type": "state:sync",
  "pending": [ /* unlock events not yet acked */ ],
  "games": [ /* currently watched game summaries */ ] }

// Broadcast when a game's schema is loaded/updated
{ "type": "schema:update", "gameId": "<infoHash>", "total": 42, "earned": 7 }
```

### Client → Service

```json
// Identify role on connect — must include auth token
{ "type": "client:identify", "role": "widget" | "zephyr", "token": "<install-token>" }

// Register/update a game to watch (sent by Zephyr plugin)
{ "type": "game:register",
  "infoHash": "<id>",
  "title": "Game Title",
  "savePath": "C:\\Games\\GameName",
  "executablePath": "C:\\Games\\GameName\\game.exe",
  "steamAppId": 12345,          // null if unknown
  "steamApiKey": "<key>" }      // forwarded from app settings; never logged to disk

// Acknowledge a notification (widget marks as shown)
{ "type": "notification:ack", "id": "<uuid>" }

// Request full state resync
{ "type": "state:request" }
```

---

## Component 1 — Windows Service

### Location
`examples/plugins/achievement-watcher/service/`

### File Structure
```
service/
  index.js        entry point — wires everything, starts WS server
  watcher.js      fs.watch logic, debounce, triggers parse
  parser.js       achievement file parsers (Goldberg/CODEX/TENOKE/etc.)
  state.js        persisted unlock history + game registry
  schema.js       Steam Web API schema fetching + caching
  ws-server.js    WebSocket server, client management, queue, token auth
  package.json    { "type": "module" }
```

### Persistence
The plugin (running in user space) resolves `app.getPath('userData')` at install time and
passes the absolute path to the service as an environment variable (`AW_DATA_DIR`).
**Never rely on `process.env.APPDATA` inside the service** — SESSION 0 / LocalSystem resolves
it to `C:\Windows\System32\config\systemprofile\AppData\Roaming`, not the user's profile.

```
$AW_DATA_DIR\                     e.g. C:\Users\Joey\AppData\Roaming\zephyr\achievement-watcher\
  games.json          watched game configs (written by plugin on game:register)
  state.json          per-game unlock history (keyed by infoHash + achievementId)
  queue.json          unacked notification queue (cleared on notification:ack)
  config.json         install-time config: auth token, port
  schema-cache/       Steam achievement schemas, one file per appId
```

### Auth Token
During install the plugin generates a random UUID, writes it to `config.json`, and passes
it to the service via `AW_AUTH_TOKEN` env var. The service rejects any `client:identify`
message whose token doesn't match. The same token is passed to the widget at runtime via
`CoreWebView2.PostWebMessageAsJson`. This prevents other local processes from connecting to
port 37265 and receiving achievement data.

### Service Registration
Installed by the plugin using `node-windows` (bundled in `service/node_modules`):

```js
const userDataPath = app.getPath('userData');
const dataDir = path.join(userDataPath, 'achievement-watcher');
const authToken = crypto.randomUUID();

// Persist token so plugin and widget can read it later
await fs.writeFile(path.join(dataDir, 'config.json'),
  JSON.stringify({ token: authToken, port: 37265 }));

const svc = new Service({
  name: 'zephyr-achievement-watcher',
  description: 'Achievement file watcher for Zephyr',
  script: path.join(serviceDir, 'index.js'),
  execPath: zephyrExePath,   // Zephyr.exe with ELECTRON_RUN_AS_NODE=1
  env: [
    { name: 'ELECTRON_RUN_AS_NODE', value: '1' },
    { name: 'AW_DATA_DIR',         value: dataDir },
    { name: 'AW_AUTH_TOKEN',       value: authToken },
  ],
});
```

### Node.js Runtime
**Do not attempt to locate a separate `node.exe`** — `process.execPath` inside Zephyr points
to `Zephyr.exe`, not Node. Instead set `ELECTRON_RUN_AS_NODE=1` in the service environment.
Electron will then boot headlessly as a pure Node.js process, running `service/index.js`
without opening any window or UI. This avoids bundling a second Node binary.

### File Watching (moved from current plugin)
- `detectAchievementFiles()` — unchanged from current plugin
- `findNamedRecursive()` — unchanged from current plugin
- On `fs.watch` event: 150ms debounce, re-parse, diff vs. `state.json`, emit unlocks

---

## Component 2 — Game Bar Widget

### Location
`examples/plugins/achievement-watcher/widget/`

### Structure
```
widget/
  AchievementWidget/
    AchievementWidget.csproj
    Package.appxmanifest      registers microsoft.gameBarUIExtension
    MainPage.xaml             <WebView2 DefaultBackgroundColor="Transparent"/> full-size
    MainPage.xaml.cs          ~40 lines — init WebView2, read config.json, postMessage token
    Assets/                   Square44x44Logo.png etc.
    web/
      index.html
      widget.js               WS client + toast queue + renderer
      widget.css              --zephyr-* CSS variables; body background: transparent
```

### XAML Shell
The XAML contains only a `WebView2` control with `DefaultBackgroundColor="Transparent"`.
On load, C# reads `config.json` from `AW_DATA_DIR` (passed via appxmanifest environment or
read from the known path), then calls `CoreWebView2.PostWebMessageAsJson(...)` to pass the
port and auth token. The widget JS then opens `ws://127.0.0.1:37265` and handles all rendering.

### Loopback Exemption
UWP apps run in an AppContainer that blocks `127.0.0.1` connections by default — the
WebSocket connect will silently fail without this step. The install script must run:

```powershell
CheckNetIsolation.exe LoopbackExempt -a -n="<PackageFamilyName>"
```

The Package Family Name is deterministic from the appxmanifest `Identity Name` +
publisher hash. It must be hardcoded in the install script and documented.

### Pinning Requirement
The widget only renders toasts during gameplay if it is **pinned** in the Game Bar.
When pinned, the widget process stays alive and the WebView2 instance remains connected
to the WebSocket even when the Game Bar UI is dismissed. When unpinned, the widget is
suspended and notifications queue until the user opens Game Bar.

**Onboarding UX (required):** After widget install, the plugin settings panel must show:
> "Press Win+G → find Achievement Watcher → click the Pin icon. The widget must be pinned
> to show notifications while you play."

### Transparent Idle State
When no toast is queued, the widget renders nothing — `body { background: transparent; }` —
so it is invisible over the game. The widget only becomes visible when a toast slides in.

### Widget UI (web/widget.js)
- On connect: sends `client:identify` (with token) + `state:request`
- On `state:sync`: drains pending queue — toasts shown 200ms apart
- On `achievement:unlock`: renders toast immediately, sends `notification:ack` after display
- Queue > 5: show first toast as "**[Name]** + **N** other achievements unlocked"
- Toast anatomy: achievement icon, name, description, game title, time — 5s display, slide out

### Widget CSS
Uses only `--zephyr-*` CSS variables. No Tailwind. Transparent background when idle.
Dark card surface (`--zephyr-bg-elevated`) for toast, matching Game Bar's dark theme.

### Packaging & Signing
The `.appx` must be signed with a trusted certificate, otherwise `Add-AppxPackage` fails
on machines without Developer Mode. Two options:

**Option A — Self-signed + bundled certificate (recommended for distribution outside Store)**
The build produces a `.appx` + `.cer`. The install script:
1. Imports the `.cer` into the user's Trusted Root store (elevated PowerShell prompt):
   ```powershell
   Import-Certificate -FilePath "AchievementWidget.cer" -CertStoreLocation Cert:\LocalMachine\Root
   ```
2. Then runs `Add-AppxPackage -Path "AchievementWidget.appx"`

**Option B — Microsoft Store (hidden/unlisted app)**
Publish widget as an unlisted Store app. Distribution via Store URL. Trusted signature from
Microsoft — no certificate install step. Harder to iterate.

Recommendation: Option A for initial release.

---

## Component 3 — Plugin Changes

The plugin (`index.js`) becomes a **thin orchestration layer**:

| Responsibility | Before | After |
|---|---|---|
| File watching | Plugin | Service |
| Unlock detection | Plugin | Service |
| Notification queue | Plugin | Service |
| Steam schema fetch | Plugin | Service (key forwarded via `game:register`) |
| Game registration | Plugin (local) | Plugin → sends `game:register` to service |
| In-app UI data | Plugin (local) | Plugin ← receives from service via WS |
| Library integration | Plugin | Plugin (unchanged) |
| Auth token management | — | Plugin (generates on service install, reads for widget) |

Plugin startup sequence:
1. Read `config.json` from `userData/achievement-watcher/` for token + port
2. Check if service is installed + running → if not, show install banner
3. Check if widget APPX is installed (`Get-AppxPackage`) → if not, show install banner
4. Connect to `ws://127.0.0.1:{port}`, send `client:identify` with token
5. On `hooks.onAppReady`: send `game:register` for all verified library entries
6. On `hooks.onLibraryEntryComplete`: send `game:register` for new entry
7. IPC handlers (`achievement-watcher:get-all` etc.) proxy from local cache populated by WS events

---

## Install Flow

### Step-by-step (plugin first run, nothing installed)

1. Plugin generates `crypto.randomUUID()` auth token
2. Plugin writes `userData/achievement-watcher/config.json` with token + port
3. Plugin installs Windows Service via `node-windows`, passing:
   - `execPath`: Zephyr.exe
   - `ELECTRON_RUN_AS_NODE=1`
   - `AW_DATA_DIR`: absolute userData path (resolved at install time, not `%APPDATA%`)
   - `AW_AUTH_TOKEN`: generated token
4. Plugin runs install script for widget:
   ```powershell
   # Elevated prompt — imports signing cert then installs APPX
   Import-Certificate -FilePath "$pluginDir\widget\AchievementWidget.cer" `
     -CertStoreLocation Cert:\LocalMachine\Root
   Add-AppxPackage -Path "$pluginDir\widget\AchievementWidget.appx"
   # Grant loopback exemption
   CheckNetIsolation.exe LoopbackExempt -a -n="ZephyrAchievementWidget_<publisherhash>"
   ```
5. Plugin settings panel shows pinning instructions

### Distribution Layout (inside achievement-watcher.zip)
```
achievement-watcher/
  index.js
  renderer.js              (built)
  service/
    index.js
    watcher.js
    parser.js
    state.js
    schema.js
    ws-server.js
    node_modules/           (node-windows + ws, pre-bundled)
    package.json
  widget/
    AchievementWidget.appx
    AchievementWidget.cer
```

---

## Resolved Design Decisions

| # | Decision |
|---|---|
| Session 0 APPDATA | Plugin resolves `app.getPath('userData')` at install time; passes absolute path as `AW_DATA_DIR` env var to service. Service never reads `process.env.APPDATA`. |
| Node.js runtime | Set `ELECTRON_RUN_AS_NODE=1` on the service process. Electron boots headlessly as Node. No separate node binary needed. |
| UWP loopback | `CheckNetIsolation.exe LoopbackExempt` run during widget install for the widget's Package Family Name. |
| Widget lifecycle | Widget must be pinned. Transparent when idle. Onboarding instructions shown post-install. |
| APPX signing | Self-signed cert bundled with distribution; install script imports to Trusted Root before `Add-AppxPackage`. |
| Auth | UUID token generated at service install, stored in `config.json`, passed to service via env, to widget via `PostWebMessageAsJson`. All WS clients must supply token in `client:identify`. |
| Steam API key | Forwarded in-memory via `game:register` WS message. Never written to `state.json` or `games.json`. |
| Toast queue >5 | Summarise as "[First achievement name] + N other achievements unlocked". |
| Widget window size | 320×480 min, 400×600 max. CSS handles responsive width within that range. |
