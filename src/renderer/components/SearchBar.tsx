import { Search, X } from 'lucide-react';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import { useUiStore } from '@/lib/store';

export function SearchBar(): JSX.Element {
  const search = useUiStore((s) => s.search);
  const setSearch = useUiStore((s) => s.setSearch);

  return (
    <div className={cn('no-drag relative flex-1 max-w-xl')}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search releases on predb…"
        className={cn(
          'w-full rounded-xl border border-zinc-800 bg-zinc-900/70 py-2 pl-9 pr-9 text-sm text-zinc-100',
          'placeholder:text-zinc-500 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/40',
        )}
      />
      {search ? (
        <button
          type="button"
          onClick={() => setSearch('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : null}
    </div>
  );
}
