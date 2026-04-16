<p align="center">
  <img src="docs/zephyr-logo.png" alt="Zephyr" width="400">
</p>

<p align="center">
  A desktop game discovery and exploration client built with Electron.<br>
  Browse public game release databases, view cover artwork and metadata powered by Steam and Google Gemini,<br>
  watch trailers, and manage downloads with built-in safety scanning.
</p>

## Disclaimer

Zephyr is a game discovery and information tool. It does **not** host, store, or distribute copyrighted content. BitTorrent is a legitimate peer-to-peer protocol widely used for distributing open-source software, game patches, public domain media, and other lawful content.

Users are solely responsible for ensuring that their use of this software complies with all applicable laws in their jurisdiction and the terms of service of any third-party APIs or services integrated with Zephyr. The developers of Zephyr do not condone, encourage, or facilitate copyright infringement or any other illegal activity.

By using this software, you agree that you will only use it for lawful purposes.

## Features

- **Release browser** — Paginated, searchable grid of game releases sourced from public release databases
- **Artwork lookup** — Automatic cover art via Steam CDN, with Gemini AI fallback for broader coverage
- **Game detail pages** — Descriptions, genres, screenshots, and trailers sourced from Steam
- **BitTorrent client** — Built-in download support via WebTorrent, with optional Real-Debrid integration
- **Safety scanning** — Automatic Windows Defender scans on completed downloads, plus optional VirusTotal hash verification
- **Download manager** — Pause, resume, and remove downloads with a slide-out drawer showing live progress

## Prerequisites

- [Node.js](https://nodejs.org/) v18 or later
- npm (included with Node.js)
- Windows 10/11 (primary platform — Windows Defender integration is Windows-only)

## Getting Started

```bash
# Clone and install
git clone https://github.com/zephyr-tools/zephyr-core.git
cd zephyr
npm install

# Start in development mode (HMR for renderer, live restart for main)
npm run dev

# Type-check the entire project
npm run typecheck
```

On first launch, open **Settings** (gear icon) to optionally configure API keys for enhanced features.

## Configuration

Zephyr uses optional API keys to unlock additional capabilities. Configure them in the in-app Settings dialog, or set environment variables:

| Setting | Purpose | Env Variable |
|---|---|---|
| Gemini API Key | Cover artwork, game details, trailers, group prerequisites | `GEMINI_API_KEY` |
| YouTube API Key | YouTube Data API v3 for trailer search | `YOUTUBE_API_KEY` |
| Real-Debrid API Key | Premium download acceleration | — |
| VirusTotal API Key | Post-download hash verification | — |

The app is fully functional without any API keys — they unlock additional features. All keys are persisted locally to `userData/settings.json` and are only sent to their respective APIs.

## Architecture

```
┌────────────┐   IPC    ┌───────────────┐    HTTPS    ┌──────────────┐
│  Renderer  │◄────────►│  Main process │────────────►│  predb.net   │
│  (React)   │          │               │             │  Steam       │
└────────────┘          │ PredbClient   │             │  Gemini      │
       ▲                │ ArtworkSvc    │             │  Real-Debrid │
       │                │ TorrentClient │             │  VirusTotal  │
       │                │ VirusScan     │             └──────────────┘
       │                └───────┬───────┘
       │                        │
       │                        ▼
       │                ┌──────────────────┐
       │                │ on-disk storage  │
       │                │ userData/cache/* │
       │                │ downloads.json  │
       │                │ settings.json   │
       │                └──────────────────┘
```

Strict context isolation (`contextBridge`, no `nodeIntegration`) ensures the renderer process has no direct access to Node.js APIs.

## Project Structure

```
src/
├── shared/              # Zero-dep types shared across all processes
├── main/                # Electron main process (Node.js)
│   ├── index.ts         # App lifecycle, IPC registration
│   ├── predb.ts         # Release database API adapters
│   ├── gemini.ts        # Artwork lookup + on-disk cache
│   ├── details.ts       # Game details + trailer lookup (Steam / Gemini)
│   ├── torrent-search.ts  # BitTorrent index search
│   ├── torrent-client.ts  # WebTorrent download manager
│   ├── real-debrid.ts   # Real-Debrid download integration
│   ├── virus-scan.ts    # Windows Defender + VirusTotal scanning
│   ├── tracker-list.ts  # Dynamic BitTorrent tracker list
│   ├── cache.ts         # Artwork blob cache utilities
│   └── settings.ts      # Persisted settings store
├── preload/             # contextBridge → window.api
│   └── index.ts
└── renderer/            # React 19 + Tailwind v4
    ├── App.tsx
    ├── components/      # ReleaseGrid, DetailPage, DownloadsDrawer, etc.
    ├── hooks/           # useDownloads, useDebouncedValue
    └── lib/             # cn, format, Zustand store
```

## Tech Stack

- **Electron 41** + **electron-vite 6** — Desktop shell with HMR
- **React 19** + **TypeScript 5.6** — Strict mode with `noUncheckedIndexedAccess`
- **Tailwind CSS v4** — CSS-first config, dark theme
- **TanStack Query 5** — Data fetching, caching, and request deduplication
- **Zustand 5** — Lightweight state management
- **WebTorrent v2** — BitTorrent client
- **Google Gemini** (`@google/genai`) — AI-powered metadata enrichment
- **BiomeJS** — Linting and formatting
- **lucide-react** — Icons

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Vite dev server + Electron with HMR |
| `npm run build` | Bundle main / preload / renderer to `out/` |
| `npm run start` | Run the built app from `out/` |
| `npm run typecheck` | Strict `tsc --noEmit` on both Node and Web configs |
| `npm run lint` | BiomeJS linting |
| `npm run format` | BiomeJS auto-format |
| `npm run package` | Build + package (directory output) |
| `npm run make` | Build + create distributable installer |

## Releasing

Zephyr uses GitHub Actions to build and publish releases. To cut a new release:

```bash
# Bump version (choose patch / minor / major)
npm version patch

# Push the commit and tag — CI takes it from here
git push origin main --follow-tags
```

This triggers the release workflow which:

1. Runs typecheck and lint
2. Builds the app and packages a Windows installer (NSIS)
3. Creates a GitHub Release with auto-generated notes from merged PRs
4. Attaches installer artifacts (`.exe`, `.blockmap`, `latest.yml`)

Users running Zephyr will be notified of the new version automatically and can update from **Settings > Application > Check for updates**.

## License

MIT
