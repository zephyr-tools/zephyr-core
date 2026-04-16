import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { type JSX, useState } from 'react';
import { DetailPage } from './components/DetailPage';
import { DownloadsDrawer } from './components/DownloadsDrawer';
import { Header } from './components/Header';
import { ReleaseGrid } from './components/ReleaseGrid';
import { SettingsDialog } from './components/SettingsDialog';
import { UpdateNotification } from './components/UpdateNotification';
import { useDebouncedValue } from './hooks/useDebouncedValue';
import { useDownloads } from './hooks/useDownloads';
import { cn } from './lib/cn';
import { useUiStore } from './lib/store';

export default function App(): JSX.Element {
  const search = useUiStore((s) => s.search);
  const category = useUiStore((s) => s.category);
  const page = useUiStore((s) => s.page);
  const setPage = useUiStore((s) => s.setPage);
  const selectedRelease = useUiStore((s) => s.selectedRelease);
  const setSelectedRelease = useUiStore((s) => s.setSelectedRelease);

  const debouncedSearch = useDebouncedValue(search, 350);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [downloadsOpen, setDownloadsOpen] = useState(false);
  const downloads = useDownloads();
  const activeDownloads = downloads.filter((j) => j.status === 'downloading').length;

  const releases = useQuery({
    queryKey: ['releases', { q: debouncedSearch, category, page }],
    queryFn: () => window.api.listReleases({ q: debouncedSearch, category, page, rows: 60 }),
    placeholderData: keepPreviousData,
  });

  if (selectedRelease) {
    return (
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        <DetailPage
          release={selectedRelease}
          onBack={() => setSelectedRelease(null)}
          onOpenDownloads={() => setDownloadsOpen(true)}
        />
        <DownloadsDrawer
          open={downloadsOpen}
          onClose={() => setDownloadsOpen(false)}
          jobs={downloads}
        />
        <UpdateNotification />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <Header
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenDownloads={() => setDownloadsOpen((o) => !o)}
        activeDownloads={activeDownloads}
      />

      <main className="flex-1 overflow-auto">
        {releases.isLoading && !releases.data ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading releases…
          </div>
        ) : releases.isError ? (
          <ErrorBlock
            message={(releases.error as Error).message}
            onRetry={() => releases.refetch()}
          />
        ) : releases.data && releases.data.rows.length > 0 ? (
          <>
            <ReleaseGrid releases={releases.data.rows} />
            <Pagination
              page={page}
              total={releases.data.total}
              perPage={releases.data.rows_per_page}
              onPage={setPage}
              source={releases.data.source}
              durationMs={releases.data.durationMs}
              isFetching={releases.isFetching}
            />
          </>
        ) : (
          <EmptyState query={debouncedSearch} />
        )}
      </main>

      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <DownloadsDrawer
        open={downloadsOpen}
        onClose={() => setDownloadsOpen(false)}
        jobs={downloads}
      />
      <UpdateNotification />
    </div>
  );
}

function ErrorBlock({ message, onRetry }: { message: string; onRetry: () => void }): JSX.Element {
  return (
    <div className="m-6 rounded-2xl border border-red-900/40 bg-red-950/30 p-6 text-sm text-red-200">
      <div className="mb-2 flex items-center gap-2 font-semibold">
        <AlertTriangle className="h-4 w-4" /> Couldn't load releases
      </div>
      <pre className="whitespace-pre-wrap break-words font-mono text-xs text-red-200/80">
        {message}
      </pre>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-600"
      >
        Retry
      </button>
    </div>
  );
}

function EmptyState({ query }: { query: string }): JSX.Element {
  return (
    <div className="flex h-full items-center justify-center p-12 text-center text-sm text-zinc-500">
      {query ? (
        <p>
          No releases matched <span className="font-mono text-zinc-300">"{query}"</span>.
        </p>
      ) : (
        <p>Nothing here yet — try searching for a release.</p>
      )}
    </div>
  );
}

interface PaginationProps {
  page: number;
  total: number;
  perPage: number;
  onPage: (p: number) => void;
  source: string;
  durationMs: number;
  isFetching: boolean;
}

function Pagination({
  page,
  total,
  perPage,
  onPage,
  source,
  durationMs,
  isFetching,
}: PaginationProps): JSX.Element {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-zinc-900 bg-zinc-950/85 px-5 py-2.5 text-xs text-zinc-400 backdrop-blur">
      <div className="flex items-center gap-2">
        <span className="rounded-md bg-zinc-900 px-2 py-0.5 font-mono">{source}</span>
        <span>
          {total.toLocaleString()} releases · {durationMs}ms
        </span>
        {isFetching ? <Loader2 className="ml-1 h-3 w-3 animate-spin text-zinc-500" /> : null}
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onPage(Math.max(1, page - 1))}
          disabled={page <= 1}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-900',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Prev
        </button>
        <span className="px-2 font-mono">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-900',
            'disabled:cursor-not-allowed disabled:opacity-40',
          )}
        >
          Next
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
