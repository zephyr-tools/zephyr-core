---
name: add-page
description: Scaffold a new renderer page or major UI section with layout, queries, and navigation wiring. Use when adding a new view to the app.
allowed-tools: Read, Write, Edit, Grep, Glob, Bash
---

# Add Page: $ARGUMENTS

Create a new page component at `src/renderer/components/$ARGUMENTS.tsx` and wire it into the app.

## Steps — implement in order:

### 1. Create `src/renderer/components/$ARGUMENTS.tsx`

Use this layout skeleton:

```tsx
import type { JSX } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  onBack: () => void;
  // ... data props
}

export function $ARGUMENTS({ onBack }: Props): JSX.Element {
  // Data queries
  const data = useQuery({
    queryKey: ['my-key', id],
    queryFn: () => window.api.myMethod(id),
    staleTime: 5 * 60_000,
  });

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Top bar */}
      <div className="no-drag flex flex-shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <span className="flex-1 truncate text-sm font-medium text-zinc-100">Title</span>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-8 px-6 py-6">
          {data.isLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
              Loading...
            </div>
          )}
          {/* Content sections here */}
        </div>
      </div>
    </div>
  );
}
```

### 2. Wire into `src/renderer/App.tsx`
- Import the component
- Add navigation state (local `useState` or add to Zustand `useUiStore` if persistent)
- Render conditionally, same pattern as `DetailPage`:
  ```tsx
  if (myPageOpen) {
    return (
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        <MyPage onBack={() => setMyPageOpen(false)} />
        <DownloadsDrawer ... />
      </div>
    );
  }
  ```

### 3. Add any required IPC channels
If the page needs new data, use the `/add-ipc-channel` skill.

### 4. Verify
Run `npm run typecheck && npm run lint`.

## Styling reference
- Backgrounds: `bg-zinc-950` (page), `bg-zinc-900/60` (cards), `bg-zinc-800` (inputs)
- Text: `text-zinc-100` (primary), `text-zinc-300` (secondary), `text-zinc-500` (muted)
- Borders: `border-zinc-800` or `border-zinc-900`
- Accents: `bg-brand-600`, `text-brand-500`
- Status colors: emerald (success), red (error), yellow (warning)
- Section headers: `text-xs font-semibold uppercase tracking-wider text-zinc-500`
- Cards: `rounded-xl border border-zinc-800 bg-zinc-900/30 p-4`
- Buttons: `rounded-lg px-3 py-1.5 text-xs font-medium`
- Icons: `lucide-react`, typically `h-4 w-4` or `h-3.5 w-3.5`
- Conditional classes: `cn()` from `@/lib/cn`
