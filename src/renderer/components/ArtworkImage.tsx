import { useQuery } from '@tanstack/react-query';
import { ImageOff, RefreshCw, Sparkles } from 'lucide-react';
import type { JSX } from 'react';
import { cn } from '@/lib/cn';

interface ArtworkImageProps {
  title: string;
  className?: string;
  /** Remove the gradient overlay — use in detail page cover art */
  noOverlay?: boolean;
}

export function ArtworkImage({ title, className, noOverlay }: ArtworkImageProps): JSX.Element {
  const query = useQuery({
    queryKey: ['artwork', title],
    queryFn: () => window.api.getArtwork(title),
    staleTime: 60 * 60_000,
    gcTime: 24 * 60 * 60_000,
    retry: 0,
  });

  return (
    <div
      className={cn(
        'group relative overflow-hidden bg-zinc-900',
        !noOverlay &&
          'before:absolute before:inset-0 before:bg-gradient-to-t before:from-zinc-950/95 before:via-zinc-950/0 before:to-zinc-950/30 before:opacity-90 before:transition-opacity',
        className,
      )}
    >
      {query.isLoading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-full w-full animate-pulse bg-gradient-to-br from-zinc-800 via-zinc-900 to-zinc-800" />
          <Sparkles className="absolute h-7 w-7 text-zinc-600" />
        </div>
      )}

      {query.isSuccess && query.data?.imageUrl ? (
        <>
          <img
            src={query.data.imageUrl}
            alt={title}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
          />
          {query.data.isDlc && (
            <span className="absolute left-2 top-2 z-10 rounded bg-zinc-950/80 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-300 backdrop-blur">
              DLC
            </span>
          )}
        </>
      ) : null}

      {/* No-art tile: shown when lookup returned nothing or errored */}
      {(query.isError || (query.isSuccess && !query.data?.imageUrl)) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-zinc-900">
          <ImageOff className="h-8 w-8 text-zinc-700" />
          <span className="text-[11px] text-zinc-600">no artwork</span>
        </div>
      )}

      {/* Refresh button — visible when art is missing */}
      {(query.isError || (query.isSuccess && !query.data?.imageUrl)) && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            void window.api.refreshArtwork(title).then(() => query.refetch());
          }}
          className="absolute right-2 top-2 z-10 rounded-full bg-zinc-950/70 p-1.5 text-zinc-300 opacity-0 backdrop-blur transition-opacity hover:bg-zinc-800 group-hover:opacity-100"
          title="Re-fetch artwork"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
