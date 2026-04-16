import type { Release } from '@shared/types';
import { AlertOctagon, Clock, HardDrive, Users } from 'lucide-react';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';
import { formatRelativeTime, formatSize } from '@/lib/format';
import { useUiStore } from '@/lib/store';
import { ArtworkImage } from './ArtworkImage';

interface ReleaseCardProps {
  release: Release;
}

export function ReleaseCard({ release }: ReleaseCardProps): JSX.Element {
  const setSelectedRelease = useUiStore((s) => s.setSelectedRelease);
  const onOpen = (): void => setSelectedRelease(release);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') onOpen();
      }}
      className={cn(
        'no-drag group relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/80 bg-zinc-900/40 text-left cursor-pointer',
        'shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset] transition-all',
        'hover:-translate-y-0.5 hover:border-zinc-700 hover:bg-zinc-900/70 hover:shadow-lg hover:shadow-black/40',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
      )}
    >
      <ArtworkImage title={release.title} className="aspect-[3/4] w-full" />

      <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1.5 bg-gradient-to-t from-zinc-950/95 via-zinc-950/70 to-transparent px-3 pb-3 pt-10 backdrop-blur-[2px] [mask-image:linear-gradient(to_top,black_60%,transparent)]">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight text-zinc-50">
          {release.title}
        </h3>
        <p className="truncate font-mono text-[10px] text-zinc-400">{release.name}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-zinc-300">
          {release.team ? (
            <span className="inline-flex items-center gap-1">
              <Users className="h-3 w-3 text-zinc-500" />
              {release.team}
            </span>
          ) : null}
          {release.size != null ? (
            <span className="inline-flex items-center gap-1">
              <HardDrive className="h-3 w-3 text-zinc-500" />
              {formatSize(release.size)}
            </span>
          ) : null}
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3 text-zinc-500" />
            {formatRelativeTime(release.pretime)}
          </span>
        </div>
      </div>

      {release.nuke ? (
        <div className="absolute left-2 top-2 z-10 inline-flex items-center gap-1 rounded-md bg-red-600/90 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur">
          <AlertOctagon className="h-3 w-3" />
          nuked
        </div>
      ) : null}
    </div>
  );
}
