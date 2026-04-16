---
name: add-main-service
description: Scaffold a new Electron main process service with caching, API key pattern, and IPC wiring. Use when integrating a new external API or backend capability.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Add Main Process Service: $ARGUMENTS

Create a new service at `src/main/$ARGUMENTS.ts` following existing patterns.

## Steps — implement in order:

### 1. Create `src/main/$ARGUMENTS.ts`

Use this template as a starting point:

```ts
import { net } from 'electron';
import type { MyType } from '@shared/types';

export class MyService {
  private cache = new Map<string, MyType>();
  private inflight = new Map<string, Promise<MyType>>();

  constructor(private getApiKey: () => string | null) {}

  get(input: string): Promise<MyType> {
    const key = input.toLowerCase().trim();
    const cached = this.cache.get(key);
    if (cached) return Promise.resolve(cached);

    const existing = this.inflight.get(key);
    if (existing) return existing;

    const promise = this._fetch(input)
      .then((result) => { this.cache.set(key, result); return result; })
      .catch((err) => {
        console.error('[MyService]', (err as Error).message);
        const fallback = { /* ... origin: 'none' */ };
        this.cache.set(key, fallback);
        return fallback;
      })
      .finally(() => this.inflight.delete(key));

    this.inflight.set(key, promise);
    return promise;
  }

  private async _fetch(input: string): Promise<MyType> {
    // Use net.fetch for HTTP — NOT global.fetch
    const res = await net.fetch(url);
    // ...
  }

  destroy(): void {
    // Clean up timers, intervals, connections
  }
}
```

Key conventions:
- HTTP: always `electron.net.fetch`, never `global.fetch`
- API keys: getter callback `() => string | null`, never store directly
- Caching: in-memory `Map` for results + inflight dedup `Map` for concurrent requests
- Logging: `console.log('[ServiceName]', message)` or `console.error`
- Errors: catch and return fallback values, don't crash the main process

### 2. Add types in `src/shared/types.ts`
- Define response interfaces
- Add method(s) to `BridgeApi`

### 3. Wire into `src/main/index.ts`
- Import and instantiate: `const myService = new MyService(() => settings.snapshot().myApiKey);`
- Add IPC handlers in `registerIpc()`
- Add `myService.destroy()` in `window-all-closed` handler if applicable

### 4. Expose on bridge in `src/preload/index.ts`

### 5. Verify
Run `npm run typecheck` to confirm everything compiles.
