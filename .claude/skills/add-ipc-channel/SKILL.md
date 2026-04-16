---
name: add-ipc-channel
description: Scaffold a new IPC channel end-to-end (types, handler, bridge, typecheck). Use when adding communication between main and renderer processes.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Add IPC Channel: $ARGUMENTS

Create a new IPC channel following the `noun:action` convention. The channel name is `$ARGUMENTS`.

## Checklist — implement each step in order:

### 1. Declare types in `src/shared/types.ts`
- Add any new request/response interfaces
- Add the method signature to the `BridgeApi` interface
- For request/response: `methodName(args): Promise<ReturnType>`
- For fire-and-forget: `methodName(args): void`

### 2. Add IPC handler in `src/main/index.ts` inside `registerIpc()`
- `ipcMain.handle('$ARGUMENTS', async (_event, ...args) => ...)` for request/response
- `ipcMain.on('$ARGUMENTS', (_event, ...args) => ...)` for fire-and-forget
- Call `await ensureServices()` if the handler needs services that depend on settings
- Import any new service or function needed

### 3. Expose on bridge in `src/preload/index.ts`
- Add the method to the `api` object
- `ipcRenderer.invoke('$ARGUMENTS', ...args)` for request/response
- `ipcRenderer.send('$ARGUMENTS', ...args)` for fire-and-forget
- Types must match `BridgeApi` declaration exactly

### 4. For push events (main → renderer), also:
- Main: `mainWindow.webContents.send('$ARGUMENTS', data)` in a timer or callback
- Preload: `ipcRenderer.on(channel, handler)` with cleanup return
- Renderer: subscribe in `useEffect`, return the cleanup function
- Reference: see `torrent:progress` + `useDownloads.ts` for the pattern

### 5. Verify
Run `npm run typecheck` and confirm all three layers compile cleanly.

## Channel naming
`noun:action` — examples: `torrent:search`, `game:details`, `shell:open-external`
