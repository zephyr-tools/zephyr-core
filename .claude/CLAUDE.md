# Zephyr — CLAUDE.md

## Legal Disclaimer
Zephyr is a game discovery and information tool. It does **not** host, distribute, or promote pirated content. BitTorrent is a legitimate peer-to-peer protocol used for distributing open-source software, game patches, public domain media, and other lawful content. Users are solely responsible for ensuring their use of this software complies with all applicable laws and the terms of service of any third-party APIs or services. The developers do not condone or encourage copyright infringement or any other illegal activity.

When working on this project, all documentation, UI copy, commit messages, code comments, and Co-Authored-By contributions must reflect this stance. Never describe features in a way that implies or encourages illegal use. Commit messages should use neutral language (e.g. "add BitTorrent download support" not "add pirate bay torrent search").

## What This Is
Electron desktop app (Windows primary) for discovering and exploring game releases. Aggregates public release metadata from predb.net, enriches it with cover artwork and details via Steam and Google Gemini, and provides integrated BitTorrent functionality (WebTorrent + Real-Debrid) with built-in safety scanning (Windows Defender + VirusTotal).

## Process Architecture
Three isolated processes — never cross-import between them:

```
main/          Node.js — IPC handlers, services, net.fetch, disk I/O
preload/       Context bridge — exposes window.api to renderer
renderer/      React 19 + TanStack Query — all UI
shared/        Zero-dep types only — imported by all three
```

## Key Files

### Main Process
| File | Role |
|---|---|
| `src/main/index.ts` | App lifecycle, IPC registration, protocol handler, service wiring |
| `src/main/predb.ts` | `PredbClient` — predb.net scene release API |
| `src/main/gemini.ts` | `ArtworkService` — Steam appdetails + Gemini fallback for cover art |
| `src/main/details.ts` | `GameDetailsService` — Steam metadata, YouTube trailers, Gemini group prerequisites |
| `src/main/torrent-search.ts` | `searchTorrents()` — multi-query BitTorrent index search with dedup + group tag filter |
| `src/main/torrent-client.ts` | `TorrentClient` — WebTorrent v2 wrapper, job persistence, progress broadcast |
| `src/main/real-debrid.ts` | `RealDebridService` — Real-Debrid API: magnet→poll→unrestrict→HTTP download |
| `src/main/virus-scan.ts` | `scanDownload()` — Windows Defender scan + VirusTotal hash lookup |
| `src/main/tracker-list.ts` | `getTrackers()` — fetches stable tracker list from newtrackon.com (24h cache) |
| `src/main/settings.ts` | `SettingsStore` — persists API keys, env fallback for nulls |
| `src/main/cache.ts` | Artwork blob cache, JSON read/write helpers, `cachePaths` |
| `src/main/webtorrent.d.ts` | Ambient types for WebTorrent v2 (ships no bundled types) |
| `src/main/plugin-host.ts` | `PluginHost` — loads plugins from userData/plugins/, builds ZephyrAPI, fires hooks |

### Preload + Shared
| File | Role |
|---|---|
| `src/preload/index.ts` | Bridge — maps all IPC channels to `window.api` |
| `src/shared/types.ts` | All shared interfaces: `Release`, `Artwork`, `AppSettings`, `BridgeApi`, `DownloadJob`, `TorrentResult`, `GroupPrerequisites`, etc. |

### Renderer
| File | Role |
|---|---|
| `src/renderer/App.tsx` | Root — release grid, header, settings dialog, downloads drawer |
| `src/renderer/components/Header.tsx` | Top bar with search, downloads badge, settings button |
| `src/renderer/components/DetailPage.tsx` | Release detail: artwork hero, metadata, trailer, auto torrent search, prerequisites, torrent results |
| `src/renderer/components/DownloadsDrawer.tsx` | Bottom drawer: download jobs with progress, speed, scan status, RD badge, actions |
| `src/renderer/components/SettingsDialog.tsx` | Modal: API keys (Gemini, YouTube, Real-Debrid, VirusTotal), cache controls |
| `src/renderer/components/ReleaseGrid.tsx` | Card grid of releases |
| `src/renderer/components/ReleaseCard.tsx` | Single release card with artwork |
| `src/renderer/components/ArtworkImage.tsx` | Artwork tile with loading/error/DLC states |
| `src/renderer/components/SearchBar.tsx` | Search input |
| `src/renderer/hooks/useDownloads.ts` | Subscribes to `torrent:progress` push events from main |
| `src/renderer/hooks/useDebouncedValue.ts` | Generic debounce hook |
| `src/renderer/lib/store.ts` | Zustand — `useUiStore` (search, category, page, selectedRelease, pluginPage) |
| `src/renderer/lib/format.ts` | `formatSize()`, `formatRelativeTime()` |
| `src/renderer/lib/cn.ts` | `cn()` — clsx + tailwind-merge |
| `src/renderer/contexts/PluginContext.tsx` | `PluginProvider` — loads specs (main) + renderer.js components; exposes `usePluginContext()`, `usePluginComponents()` |
| `src/renderer/components/PluginErrorBoundary.tsx` | React class error boundary wrapping each plugin render point; shows inline error card |
| `src/renderer/components/PluginPageView.tsx` | Full-page view for plugin routes; lazy-loads route component with Suspense + PluginErrorBoundary |
| `src/renderer/types/plugin.ts` | Renderer-only plugin types: `PluginRoute`, `PluginDetailButton`, `PluginDetailSection`, `DetailButton` discriminated union, `RendererPluginRegistry` |

## IPC Convention
Channel naming: `noun:action`. Add handler in `main/index.ts`, expose in `preload/index.ts`, declare in `BridgeApi` in `shared/types.ts`.

```
predb:list              artwork:get             artwork:refresh
artwork:clear-cache     settings:get            settings:set
game:details            game:trailer            game:group-prereqs
shell:open-external     shell:show-item-in-folder
torrent:search          torrent:add             torrent:list
torrent:pause           torrent:resume          torrent:remove
plugins:get-ui          plugins:get-renderer-paths
plugins:list            plugins:install         plugins:install-zip
plugins:remove          plugins:set-setting
shell:pick-zip          app:restart
plugin:<channel>        (dynamic — registered by each plugin via zephyr.ipc.handle())
```

`window.api.invokePlugin(channel, payload)` in preload always prefixes `plugin:` onto the supplied channel — callers pass the bare `pluginId:action` name. This guarantees renderer code (including Layer-2 plugin bundles) cannot reach any non-plugin IPC channel through that bridge method.

Push event (main → renderer): `torrent:progress` — broadcast every 1s with all `DownloadJob[]`.

## BitTorrent Pipeline
1. **Search** — `DetailPage` auto-fires `torrent:search` on mount with `release.name` + `release.title`
2. **Query derivation** — `deriveQueries()` generates up to 3 queries: parsed title (broad), cleaned scene name (medium), full name with dots→spaces (narrow)
3. **Index lookup** — parallel searches via public BitTorrent index, deduplicated by `infoHash`, filtered to require a group tag (`-GROUP` suffix)
4. **Trackers** — magnet URIs augmented with 12 trackers from newtrackon.com (24h cache)
5. **Download** — routes through Real-Debrid when API key is set, otherwise WebTorrent
6. **Scan** — auto-triggers on completion: Windows Defender (always) + VirusTotal hash check (optional)

## Download Management
- **WebTorrent v2** — `wt.torrents.find()` for sync lookup (v2.8.5's `wt.get()` is async/returns Promise)
- **Real-Debrid** — addMagnet → selectFiles → poll info → unrestrict links → HTTP stream to disk
- **Persistence** — `userData/downloads.json` stores job state across restarts
- **Progress** — `TorrentClient._broadcast()` pushes `DownloadJob[]` to renderer every 1s
- **onComplete callback** — triggers virus scan when any job transitions to `seeding`, then fires `PluginHost.notifyDownloadComplete(job)` with the resolved `scanStatus`/`scanInfo` so plugin hooks see the final scan result

## Virus Scanning
1. **Windows Defender** — `MpCmdRun.exe -Scan -ScanType 3 -File <path> -DisableRemediation` (always runs, no config)
2. **VirusTotal** — SHA256 hash lookup of executable files (.exe, .msi, .dll, etc.), up to 5 files per download (optional, needs API key)
3. Results: `scanStatus` (`scanning` | `clean` | `threat` | `error`) + `scanInfo` (threat names, engine details)

## Group Prerequisites
`GameDetailsService.getGroupPrerequisites()` uses Gemini with grounded web search to look up scene group install requirements. Returns `summary`, `prerequisites[]`, `installSteps[]`. Cached per group name for 24h.

## Settings
`AppSettings` in `shared/types.ts`, persisted to `userData/settings.json`:

| Key | Purpose | Env fallback |
|---|---|---|
| `geminiApiKey` | Artwork, game details, trailers, prerequisites | `GEMINI_API_KEY` |
| `youtubeApiKey` | YouTube Data API v3 trailer search | `YOUTUBE_API_KEY` |
| `realDebridApiKey` | Real-Debrid seedbox downloads | — |
| `virusTotalApiKey` | VirusTotal hash lookup post-download | — |

Stored nulls do NOT override env defaults (settings merge skips null values).

## Critical: Windows File URLs
Always use Node's `url` module — never string-concat `file://` + path:
```ts
import { pathToFileURL, fileURLToPath } from 'node:url';
pathToFileURL(fsPath).href   // writing  → "file:///C:/..."
fileURLToPath(fileUrl)       // reading  → "C:\\..."
```

## Network Requests (Main Process)
Use `electron.net.fetch` — **not** `global.fetch`. Works behind Electron's session proxy and avoids CSP issues.

## WebTorrent v2 Gotchas
- `wt.get(hash)` returns a **Promise** in v2.8.5, not a Torrent — use `wt.torrents.find(t => t.infoHash === hash)` for sync access
- `torrent.length` is `undefined` before metadata resolves — always guard with `num()` helper
- `wt.remove(infoHash, opts, cb)` — pass the hash string, not the Torrent object
- Ambient types in `src/main/webtorrent.d.ts` — update when adding new API surface

## Path Aliases
```
@/*        → src/renderer/*
@shared/*  → src/shared/*
```

## TypeScript
Strict mode + `noUncheckedIndexedAccess` + `verbatimModuleSyntax`. Array/object index access returns `T | undefined` — always guard.

## Styling
Tailwind v4 (CSS-first, no `tailwind.config.js`). Dark zinc palette (`zinc-950/900/800`), `brand-*` for accents (violet). Use `cn()` from `@/lib/cn` for conditional classes.

**Plugin UI Kit** — `src/renderer/styles.css` exposes a stable `--zephyr-*` CSS-variable palette and a `.zephyr-*` utility-class set (card/button/input/label/pill/text/stack). These are the PUBLIC CONTRACT for third-party plugin code — plugin bundles can't use Tailwind because classes are scanned at Zephyr's build time. Core code should NOT use `.zephyr-*` classes; it uses Tailwind directly. The `--zephyr-*` variables reference Tailwind theme tokens (`--color-zinc-*`, `--color-brand-*`), so rebranding core flows through to plugins automatically. Renaming or removing an existing `--zephyr-*` token or `.zephyr-*` class is a breaking change.

## Linting & Formatting
BiomeJS v2 (replaced ESLint + Prettier). Config in `biome.json`.
- 2-space indent, 100-char lines, single quotes, trailing commas, always-semicolons
- Import organization via `assist`
- Tailwind CSS directive support enabled

## Git Workflow
Never commit directly to `main`. For every set of changes:
1. Create a descriptive feature branch from `main` (e.g. `feat/trailer-autoplay`, `fix/scan-timeout`, `chore/bump-deps`)
2. Commit work to that branch with clear, conventional commit messages
3. Push the branch and open a PR to `main` using `gh pr create`

If already on a feature branch, continue working there — do not create a new one.

## Dev Commands
```bash
npm run dev        # Electron + Vite HMR
npm run typecheck  # tsc --noEmit (both Node + Web configs)
npm run build      # Full bundle to out/
npm run start      # Run built app
npm run lint       # biome check
npm run format     # biome check --write
```

## Plugin System

Two-layer architecture — plugins can be main-process-only or include a renderer layer:

**Layer 1 — `index.js` (main process, no build step)**
- Loaded by `PluginHost` from `userData/plugins/<pluginId>/index.js`
- Plugin IDs must match `^[a-z0-9][a-z0-9-]*$` (enforced for `installFromUrl`)
- Calls `setup(zephyr)` with `ZephyrAPI` — registers buttons, IPC handlers, settings, hooks
- `zephyr.ui.addDetailButton({ label, action })` — adds a simple IPC-triggered button to DetailPage. `action` is the bare channel name — the `plugin:` prefix is applied by preload on invocation.
- `zephyr.ipc.handle(channel, handler)` — `plugin:` prefix added automatically on registration; channel must be namespaced `pluginId:action`
- `zephyr.settings.register/get/set/onChange` — settings appear in the Settings dialog's "Plugins" tab. Supported types: `text | password | toggle | number | select` (with `options`, `min`, `max`, `step`, `hint`). `set()` warns if the key is unregistered but still persists; the UI write path (`plugins:set-setting`) rejects unregistered keys. `onChange(key, handler)` fires after either write path persists, letting plugins react to user edits from the UI.
- All setting writes flow through a single `PluginHost._applySetting` so cache + disk + listeners stay in sync.
- `zephyr.hooks.onDownloadComplete(job: DownloadJob)` fires **after** the post-download virus scan resolves, so `job.scanStatus`/`scanInfo` are final. `onAppReady()` fires once after all plugins load.

**Layer 2 — `renderer.js` (renderer process, requires esbuild build)**
- Sits alongside `index.js` in the plugin directory
- Exports `detailSections`, `detailButtons`, `routes` as named exports
- React is shared via `window.__zephyrReact` / `window.__zephyrJsxRuntime` globals (set in `src/renderer/main.tsx` before first render)
- esbuild aliases redirect `import 'react'` to shims that read these globals — prevents duplicate React instance errors
- Loaded dynamically in `PluginContext` via `import(file:// url)` with 5s per-plugin timeout
- Duplicate ids across plugins: first registration wins, console warning emitted
- Each render point wrapped in `PluginErrorBoundary` — plugin crash is isolated, rest of app unaffected
- Styling: plugins cannot use Tailwind classes — use the `.zephyr-*` utility classes and `--zephyr-*` CSS variables defined in `src/renderer/styles.css` (see "Styling" section above).

**Plugin type definitions** — `examples/plugins/zephyr-plugin.d.ts`
- Layer-1 types hand-authored: `ZephyrPlugin`, `ZephyrAPI`, `PluginButtonSpec`, `PluginSettingSpec`
- Layer-2 types hand-authored: `PluginDetailSection`, `PluginDetailButton`, `PluginRoute`, `PluginPageProps`, `RendererPluginExports`, `ZephyrWindowApi`
- `Release` + `DownloadJob` (and dependent types) are auto-generated from `src/shared/types.ts` via `npm run generate:plugin-types`. The generator runs as a CI step in the release pipeline before typecheck.

**Plugin template** — `examples/renderer-plugin-template/` contains esbuild config + shims + example `renderer.jsx` using the Plugin UI Kit.

**Plugin management UI** — `SettingsDialog` → Plugins tab (always visible):
- Restart-required banner with "Restart now" button (calls `app:restart` → `app.relaunch()` + `app.exit(0)`)
- Installed list with per-plugin "Remove" buttons (`plugins:remove`)
- Install from URL input (`plugins:install`, HTTPS ZIP URL) and "From local file" button (`shell:pick-zip` → `plugins:install-zip`)
- Per-plugin settings fields rendered below, still live (no restart needed for setting writes)

**Packaging examples for distribution** — `scripts/package-plugin.mjs`, invoked as `npm run package:plugin -- <plugin-dir>`. Builds if the dir has a `build` script, then zips into `examples/dist/<pluginId>.zip`. Plugin ID resolution: `--id` flag → `package.json`'s `zephyr.pluginId` → dir basename. Denylist excludes `node_modules`, `src`, `package.json`, `esbuild.config.js`, `tsconfig*.json`, etc.

**Plugins are distributed as ZIPs only.** Both `installFromUrl` and `installFromZip` expect the same layout. `installFromUrl` fetches the HTTPS URL, writes to a temp file in `app.getPath('temp')`, and delegates to `installFromZip` so validation/extraction/rollback stay unified.

**ZIP install rules** (`PluginHost.installFromZip`, uses `fflate`):
- ≤ 10 MB uncompressed total (also checked on URL fetch before disk write)
- Exactly one top-level directory matching `^[a-z0-9][a-z0-9-]*$` containing `index.js`
- The plugin ID comes from the ZIP's top-level directory, NOT from the URL basename
- Reject entries with `..`, absolute paths, or backslashes (zip-slip defense)
- Existing `settings.json` is preserved across reinstalls; other files overwritten
- On setup() failure: rolled-back extraction (full dir removed if fresh install, extracted files removed if reinstall)

## State
- **Zustand** (`useUiStore`) — transient UI: search query, category, page, selectedRelease, `pluginPage` (active plugin route id or null)
- **TanStack Query** — artwork, releases, settings, game details, trailers, torrent search, group prerequisites, plugin UI specs (`plugin-ui`), plugin renderer paths (`plugin-renderer-paths`)
- **Push subscription** — `useDownloads()` hook subscribes to `torrent:progress` IPC events
- **Plugin components** — `PluginContext` holds `specs` (serializable, from main) and `components` (React, from renderer.js imports)
- **Disk** — `userData/settings.json`, `userData/downloads.json`, `userData/cache/artwork/`, `userData/plugins/<id>/settings.json`
