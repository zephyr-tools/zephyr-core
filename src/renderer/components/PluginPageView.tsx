import { ArrowLeft, Loader2 } from 'lucide-react';
import { type JSX, Suspense, lazy, useMemo } from 'react';
import { PluginErrorBoundary } from './PluginErrorBoundary';
import { usePluginComponents } from '@/contexts/PluginContext';
import { useUiStore } from '@/lib/store';

function PluginPageView(): JSX.Element {
  const pluginPage = useUiStore((s) => s.pluginPage);
  const setPluginPage = useUiStore((s) => s.setPluginPage);
  const selectedRelease = useUiStore((s) => s.selectedRelease);
  const { routes } = usePluginComponents();

  const route = routes.find((r) => r.id === pluginPage);

  const LazyComponent = useMemo(() => {
    if (!route) return null;
    return lazy(route.component);
  }, [route]);

  if (!route || !LazyComponent) {
    return (
      <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
        <TopBar label="Plugin" onBack={() => setPluginPage(null)} />
        <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
          Plugin not found.
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-zinc-100">
      <TopBar label={route.navLabel} onBack={() => setPluginPage(null)} />
      <div className="flex-1 overflow-y-auto">
        <PluginErrorBoundary pluginId={route.id}>
          <Suspense
            fallback={
              <div className="flex h-full items-center justify-center text-zinc-500">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading…
              </div>
            }
          >
            <LazyComponent release={selectedRelease ?? undefined} />
          </Suspense>
        </PluginErrorBoundary>
      </div>
    </div>
  );
}

function TopBar({ label, onBack }: { label: string; onBack: () => void }): JSX.Element {
  return (
    <div className="no-drag flex flex-shrink-0 items-center gap-3 border-b border-zinc-800/80 bg-zinc-950/90 px-4 py-2.5 backdrop-blur">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
      >
        <ArrowLeft className="h-4 w-4" />
        Back
      </button>
      <span className="flex-1 truncate text-sm font-medium text-zinc-100">{label}</span>
    </div>
  );
}

export { PluginPageView };
