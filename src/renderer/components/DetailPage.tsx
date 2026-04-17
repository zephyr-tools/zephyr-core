import type {
  GameDetails,
  GameTrailer,
  GroupPrerequisites,
  Release,
  TorrentResult,
} from '@shared/types';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  AlertOctagon,
  ArrowDownToLine,
  ArrowLeft,
  Clock,
  ExternalLink,
  HardDrive,
  Info,
  Loader2,
  Play,
  Users,
} from 'lucide-react';
import { type JSX, useEffect, useRef, useState } from 'react';
import { invokePluginAction, usePluginUi } from '@/contexts/PluginContext';
import { cn } from '@/lib/cn';
import { formatRelativeTime, formatSize } from '@/lib/format';
import { ArtworkImage } from './ArtworkImage';

interface DetailPageProps {
  release: Release;
  onBack: () => void;
  onOpenDownloads?: () => void;
}

function YouTubeTrailer({ videoId }: { videoId: string }): JSX.Element {
  const {
    data: origin,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['trailer-origin'],
    queryFn: () => window.api.getTrailerOrigin(),
    staleTime: Number.POSITIVE_INFINITY,
  });

  if (isError || (!isLoading && !origin)) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-zinc-900 text-zinc-500">
        <div className="absolute inset-0 flex items-center justify-center text-xs">
          Trailer unavailable
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      {origin && (
        <iframe
          src={`${origin}/?v=${encodeURIComponent(videoId)}`}
          title="Game Trailer"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
          className="absolute inset-0 h-full w-full border-0"
        />
      )}
    </div>
  );
}

function TrailerPlayer({ trailer }: { trailer: GameTrailer }): JSX.Element {
  if (trailer.type === 'youtube') {
    return <YouTubeTrailer videoId={trailer.url} />;
  }

  return (
    <video
      src={trailer.url}
      poster={trailer.thumbnailUrl}
      controls
      className="w-full rounded-xl bg-black"
      style={{ aspectRatio: '16/9' }}
    />
  );
}

function TrailerSkeleton(): JSX.Element {
  return (
    <div
      className="flex w-full items-center justify-center rounded-xl bg-zinc-900"
      style={{ aspectRatio: '16/9' }}
    >
      <div className="flex flex-col items-center gap-2 text-zinc-600">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span className="text-xs">Finding trailer…</span>
      </div>
    </div>
  );
}

function ScreenshotsStrip({ urls }: { urls: string[] }): JSX.Element {
  const [selected, setSelected] = useState(0);

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Screenshots</h3>
      <img
        src={urls[selected]}
        alt="Screenshot"
        className="w-full rounded-xl object-cover"
        style={{ aspectRatio: '16/9' }}
      />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {urls.map((url, i) => (
          <button
            key={url}
            type="button"
            onClick={() => setSelected(i)}
            className={cn(
              'h-14 w-24 flex-shrink-0 overflow-hidden rounded-lg border-2 transition-colors',
              i === selected
                ? 'border-brand-500'
                : 'border-transparent opacity-60 hover:opacity-100',
            )}
          >
            <img src={url} alt="" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MetaPill({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-zinc-900/60 px-4 py-3">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <span className="text-sm font-medium text-zinc-200">{value}</span>
    </div>
  );
}

export function DetailPage({ release, onBack, onOpenDownloads }: DetailPageProps): JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onBack();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack]);

  // Artwork — already cached by the card grid
  const artworkQuery = useQuery({
    queryKey: ['artwork', release.title],
    queryFn: () => window.api.getArtwork(release.title),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
  });
  const artworkUrl = artworkQuery.data?.imageUrl;

  // Fast query — Steam metadata only, no Gemini, typically resolves in ~1-2s
  const detailsQuery = useQuery<GameDetails>({
    queryKey: ['game-details', release.title],
    queryFn: () => window.api.getGameDetails(release.title),
    staleTime: 24 * 60 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
    retry: 0,
  });
  const d = detailsQuery.data;

  // Slow query — Gemini YouTube search. Only fires after details load and
  // only when Steam didn't return a trailer. Runs independently so the rest
  // of the page is already visible while this resolves.
  const steamHasTrailer = detailsQuery.isSuccess && !!d?.trailer;
  const trailerQuery = useQuery<GameTrailer | null>({
    queryKey: ['game-trailer', release.title],
    queryFn: () => window.api.getGameTrailer(release.title),
    enabled: detailsQuery.isSuccess && !steamHasTrailer,
    staleTime: 24 * 60 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
    retry: 0,
  });

  // Resolved trailer: Steam mp4 takes priority, YouTube as fallback
  const activeTrailer: GameTrailer | null = d?.trailer ?? trailerQuery.data ?? null;
  const trailerLoading = !steamHasTrailer && detailsQuery.isSuccess && trailerQuery.isLoading;

  // Torrent search — fires automatically when the detail page mounts
  const torrentSearch = useQuery({
    queryKey: ['torrent-search', release.name],
    queryFn: () => window.api.searchTorrents(release.name, release.title),
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    retry: 1,
  });

  // Group prerequisites — fires when a group tag is present
  const prereqQuery = useQuery({
    queryKey: ['group-prereqs', release.team],
    queryFn: () => window.api.getGroupPrerequisites(release.team!, release.name),
    enabled: !!release.team,
    staleTime: 24 * 60 * 60_000,
    gcTime: 7 * 24 * 60 * 60_000,
    retry: 0,
  });
  const [addedHashes, setAddedHashes] = useState<Set<string>>(new Set());
  const addTorrent = useMutation({
    mutationFn: ({ magnetUri, size }: { magnetUri: string; size: number }) =>
      window.api.addTorrent(magnetUri, size),
    onSuccess: (_data, { magnetUri }) => {
      const match = /urn:btih:([a-fA-F0-9]{40})/i.exec(magnetUri);
      if (match?.[1]) setAddedHashes((s) => new Set(s).add(match[1]!.toLowerCase()));
      onOpenDownloads?.();
    },
  });
  const pluginUi = usePluginUi();

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Top bar ─────────────────────────────────────────────────────── */}
      <div className="no-drag flex flex-shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5 backdrop-blur">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>

        <span className="flex-1 truncate text-sm font-medium text-zinc-100">{release.title}</span>

        {release.url && (
          <button
            type="button"
            onClick={() => void window.api.openExternal(release.url!)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            View Release
          </button>
        )}
        {pluginUi.detailButtons.map((btn) => (
          <button
            key={btn.action}
            type="button"
            onClick={() => void invokePluginAction(btn.action, release)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-zinc-100"
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* ── Scrollable body ─────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="relative overflow-hidden">
          {artworkUrl && (
            <img
              src={artworkUrl}
              alt=""
              aria-hidden
              className="absolute inset-0 h-full w-full scale-110 object-cover opacity-30 blur-2xl"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/50 via-zinc-950/70 to-zinc-950" />

          <div className="relative flex items-end gap-5 px-6 pb-6 pt-8">
            <div className="h-48 w-32 flex-shrink-0 overflow-hidden rounded-2xl shadow-2xl ring-1 ring-white/10">
              <ArtworkImage title={release.title} className="h-full w-full" noOverlay />
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 pb-1">
              <h1 className="text-2xl font-bold leading-tight text-white">{release.title}</h1>

              {d?.genres && d.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {d.genres.map((g) => (
                    <span
                      key={g}
                      className="rounded-full bg-zinc-800/80 px-2.5 py-0.5 text-[11px] font-medium text-zinc-300"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-400">
                {release.team && (
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5 text-zinc-500" />
                    {release.team}
                  </span>
                )}
                {release.size != null && (
                  <span className="inline-flex items-center gap-1">
                    <HardDrive className="h-3.5 w-3.5 text-zinc-500" />
                    {formatSize(release.size)}
                  </span>
                )}
                <span className="inline-flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />
                  {formatRelativeTime(release.pretime)}
                </span>
              </div>

              {release.nuke && (
                <div className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-red-600/20 px-3 py-1 text-xs font-semibold text-red-300 ring-1 ring-red-600/40">
                  <AlertOctagon className="h-3.5 w-3.5" />
                  Nuked: {release.nuke}
                </div>
              )}

              {d?.metacriticScore != null && (
                <div className="inline-flex w-fit items-center gap-1.5 rounded-lg bg-green-600/15 px-3 py-1 text-xs font-semibold text-green-300 ring-1 ring-green-600/30">
                  Metacritic {d.metacriticScore}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── Main content ──────────────────────────────────────────────── */}
        <div className="space-y-8 px-6 py-6">
          {/* Trailer + description — shown as soon as either is available */}
          {(activeTrailer || trailerLoading || d?.shortDescription) && (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
              {/* Trailer column */}
              {(activeTrailer || trailerLoading) && (
                <div className="min-w-0 lg:flex-1">
                  <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    <Play className="h-3 w-3" />
                    Trailer
                  </h3>
                  {activeTrailer ? <TrailerPlayer trailer={activeTrailer} /> : <TrailerSkeleton />}
                </div>
              )}

              {/* Description */}
              {d?.shortDescription && (
                <div
                  className={cn(
                    'min-w-0',
                    activeTrailer || trailerLoading ? 'lg:w-72 lg:flex-shrink-0' : 'w-full',
                  )}
                >
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                    About
                  </h3>
                  <p className="text-sm leading-relaxed text-zinc-300">{d.shortDescription}</p>
                </div>
              )}
            </div>
          )}

          {/* Details loading state — only shown before Steam resolves */}
          {detailsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
              Loading game info…
            </div>
          )}

          {/* Metadata pills */}
          {d && (d.developer || d.publisher || d.releaseDate) && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {d.developer && <MetaPill label="Developer" value={d.developer} />}
              {d.publisher && d.publisher !== d.developer && (
                <MetaPill label="Publisher" value={d.publisher} />
              )}
              {d.releaseDate && <MetaPill label="Released" value={d.releaseDate} />}
              {d.origin !== 'none' && (
                <MetaPill label="Data source" value={d.origin === 'steam' ? 'Steam' : 'AI'} />
              )}
            </div>
          )}

          {/* Screenshots */}
          {d?.screenshots && d.screenshots.length > 0 && <ScreenshotsStrip urls={d.screenshots} />}

          {/* Group prerequisites */}
          {prereqQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
              Looking up install requirements for {release.team}…
            </div>
          )}

          {prereqQuery.data?.origin === 'gemini' && (
            <PrerequisitesSection prereqs={prereqQuery.data} />
          )}

          {/* Torrent search results */}
          {torrentSearch.isLoading && (
            <div className="flex items-center gap-2 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin text-zinc-600" />
              Searching torrents…
            </div>
          )}

          {torrentSearch.data && (
            <TorrentResults
              results={torrentSearch.data}
              onDownload={(magnetUri: string, size: number) =>
                addTorrent.mutate({ magnetUri, size })
              }
              pendingHash={addTorrent.isPending ? (addTorrent.variables?.magnetUri ?? null) : null}
              addedHashes={addedHashes}
            />
          )}

          {torrentSearch.isError && (
            <div className="rounded-xl border border-red-900/40 bg-red-950/30 p-4 text-sm text-red-200">
              Torrent search failed: {(torrentSearch.error as Error).message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PrerequisitesSection({ prereqs }: { prereqs: GroupPrerequisites }): JSX.Element {
  return (
    <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/30 p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Install Requirements — {prereqs.group}
      </h3>

      <div className="flex items-start gap-2 rounded-lg bg-zinc-900/60 px-3 py-2 text-[11px] leading-relaxed text-zinc-400">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <span>
          Shown for research and preservation context only. Only apply to software you lawfully own.
          AI-generated — verify before executing any step.
        </span>
      </div>

      {prereqs.summary && (
        <p className="text-sm leading-relaxed text-zinc-400">{prereqs.summary}</p>
      )}

      {prereqs.prerequisites.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Prerequisites
          </h4>
          <ul className="space-y-1">
            {prereqs.prerequisites.map((p) => (
              <li key={p} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-500" />
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {prereqs.installSteps.length > 0 && (
        <div>
          <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Installation Steps
          </h4>
          <ol className="space-y-1">
            {prereqs.installSteps.map((step, i) => (
              <li key={step} className="flex items-start gap-2 text-sm text-zinc-300">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-400">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function TorrentResults({
  results,
  onDownload,
  pendingHash,
  addedHashes,
}: {
  results: TorrentResult[];
  onDownload: (magnetUri: string, size: number) => void;
  pendingHash: string | null;
  addedHashes: Set<string>;
}): JSX.Element {
  if (results.length === 0) {
    return (
      <div className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-4 text-sm text-zinc-500">
        No torrents found for this release.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        Torrent Results ({results.length})
      </h3>
      <div className="overflow-hidden rounded-xl border border-zinc-800">
        {results.map((r, i) => {
          const isPending = pendingHash === r.magnetUri;
          const isAdded = addedHashes.has(r.infoHash);
          return (
            <div
              key={r.infoHash}
              className={cn(
                'flex items-center gap-3 px-4 py-2.5 text-sm',
                i > 0 && 'border-t border-zinc-800/60',
                'hover:bg-zinc-900/60',
              )}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-zinc-200" title={r.name}>
                  {r.name}
                </p>
                <div className="flex items-center gap-3 text-xs text-zinc-500">
                  <span>{formatSize(r.size)}</span>
                  <span className="text-emerald-500">S:{r.seeders}</span>
                  <span className="text-red-400">L:{r.leechers}</span>
                </div>
              </div>
              {isAdded ? (
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-600/20 px-3 py-1.5 text-xs font-medium text-emerald-400">
                  Added
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onDownload(r.magnetUri, r.size)}
                  disabled={isPending}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white shadow shadow-brand-700/40 transition hover:bg-brand-500 disabled:opacity-50"
                >
                  {isPending ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <ArrowDownToLine className="h-3.5 w-3.5" />
                  )}
                  Download
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
