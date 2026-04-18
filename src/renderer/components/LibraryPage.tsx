import type { LibraryEntry } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  FolderOpen,
  Loader2,
  Play,
  SearchX,
  Trash2,
} from 'lucide-react';
import { type JSX, useState } from 'react';
import { cn } from '@/lib/cn';
import { formatRelativeTime, formatSize } from '@/lib/format';
import { ArtworkImage } from './ArtworkImage';

const PER_PAGE = 20;

export function LibraryPage(): JSX.Element {
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['library', page],
    queryFn: () => window.api.listLibrary(page, PER_PAGE),
  });

  const launch = useMutation({
    mutationFn: (id: string) => window.api.launchGame(id),
  });

  const locate = useMutation({
    mutationFn: (id: string) => window.api.pickExecutable(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['library'] }),
  });

  const remove = useMutation({
    mutationFn: (id: string) => window.api.removeLibraryEntry(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['library'] }),
  });

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PER_PAGE)) : 1;

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-zinc-500">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Loading library…
          </div>
        ) : !data || data.entries.length === 0 ? (
          <EmptyLibrary />
        ) : (
          <div className="divide-y divide-zinc-900">
            {data.entries.map((entry) => (
              <LibraryRow
                key={entry.id}
                entry={entry}
                onLaunch={() => launch.mutate(entry.id)}
                onLocate={() => locate.mutate(entry.id)}
                onRemove={() => remove.mutate(entry.id)}
                onShowInFolder={() =>
                  window.api.showItemInFolder(entry.executablePath ?? entry.savePath)
                }
                locating={locate.isPending && locate.variables === entry.id}
              />
            ))}
          </div>
        )}
      </div>

      {data && data.total > PER_PAGE && (
        <div className="sticky bottom-0 z-10 flex items-center justify-between border-t border-zinc-900 bg-zinc-950 px-5 py-2.5 text-xs text-zinc-400">
          <span>{data.total} games</span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-900',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Prev
            </button>
            <span className="px-2 font-mono">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages}
              className={cn(
                'inline-flex items-center gap-1 rounded-md px-2 py-1 text-zinc-300 hover:bg-zinc-900',
                'disabled:cursor-not-allowed disabled:opacity-40',
              )}
            >
              Next <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

interface LibraryRowProps {
  entry: LibraryEntry;
  onLaunch: () => void;
  onLocate: () => void;
  onRemove: () => void;
  onShowInFolder: () => void;
  locating: boolean;
}

function LibraryRow({
  entry,
  onLaunch,
  onLocate,
  onRemove,
  onShowInFolder,
  locating,
}: LibraryRowProps): JSX.Element {
  return (
    <div className="flex items-center gap-4 px-5 py-3 hover:bg-zinc-900/40 transition-colors">
      {/* Artwork thumbnail */}
      <div className="h-14 w-10 flex-shrink-0 overflow-hidden rounded">
        <ArtworkImage title={entry.artworkTitle} className="h-full w-full object-cover" />
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-zinc-100">{entry.releaseTitle}</p>
        <p className="truncate text-xs text-zinc-500 font-mono">{entry.releaseName}</p>
        <div className="mt-0.5 flex items-center gap-2 text-xs text-zinc-600">
          {entry.team && <span>{entry.team}</span>}
          {entry.totalSize > 0 && <span>{formatSize(entry.totalSize)}</span>}
          <span>{formatRelativeTime(entry.addedAt)}</span>
        </div>
      </div>

      {/* Status pill */}
      <StatusPill status={entry.installStatus} />

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {entry.installStatus === 'verified' && (
          <ActionButton onClick={onLaunch} title="Launch game">
            <Play className="h-3.5 w-3.5" />
          </ActionButton>
        )}
        {(entry.installStatus === 'unlocated' || entry.installStatus === 'missing') && (
          <ActionButton onClick={onLocate} title="Locate executable" disabled={locating}>
            {locating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <FolderOpen className="h-3.5 w-3.5" />
            )}
          </ActionButton>
        )}
        {entry.installStatus === 'verified' && (
          <ActionButton onClick={onShowInFolder} title="Show in Explorer">
            <FolderOpen className="h-3.5 w-3.5" />
          </ActionButton>
        )}
        <ActionButton
          onClick={onRemove}
          title="Remove from library"
          className="text-zinc-600 hover:text-red-400"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </ActionButton>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: LibraryEntry['installStatus'] }): JSX.Element {
  const map: Record<LibraryEntry['installStatus'], { label: string; className: string }> = {
    verified: {
      label: 'Verified',
      className: 'bg-emerald-950 text-emerald-400 border-emerald-900',
    },
    missing: { label: 'Missing', className: 'bg-amber-950 text-amber-400 border-amber-900' },
    unlocated: { label: 'Unlocated', className: 'bg-zinc-900 text-zinc-400 border-zinc-800' },
    downloading: {
      label: 'Downloading',
      className: 'bg-brand-950 text-brand-400 border-brand-900',
    },
  };
  const { label, className } = map[status];
  return (
    <span
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10px] font-medium flex-shrink-0',
        className,
      )}
    >
      {label}
    </span>
  );
}

function ActionButton({
  onClick,
  title,
  disabled,
  children,
  className,
}: {
  onClick: () => void;
  title: string;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        'rounded-lg p-1.5 text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100',
        'disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
    >
      {children}
    </button>
  );
}

function EmptyLibrary(): JSX.Element {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 p-12 text-center">
      <SearchX className="h-8 w-8 text-zinc-700" />
      <p className="text-sm text-zinc-500">Your library is empty.</p>
      <p className="text-xs text-zinc-600">
        Downloads you start from a release page will appear here.
      </p>
    </div>
  );
}
