import type { PluginUi } from '@shared/types';
import { useQuery } from '@tanstack/react-query';
import { createContext, type JSX, type ReactNode, useContext, useEffect, useState } from 'react';
import {
  EMPTY_REGISTRY,
  type PluginDetailButton,
  type PluginDetailSection,
  type PluginRoute,
  type RendererPluginRegistry,
} from '@/types/plugin';

const EMPTY_SPECS: PluginUi = {
  detailButtons: [],
  detailSections: [],
  cardMenuItems: [],
  settings: [],
};

interface PluginContextValue {
  /** Serializable specs from the main process (index.js plugins). */
  specs: PluginUi;
  /** React components from renderer.js plugins. */
  components: RendererPluginRegistry;
  rendererLoading: boolean;
}

const PluginContext = createContext<PluginContextValue>({
  specs: EMPTY_SPECS,
  components: EMPTY_REGISTRY,
  rendererLoading: false,
});

type RendererModule = {
  routes?: PluginRoute[];
  detailButtons?: PluginDetailButton[];
  detailSections?: PluginDetailSection[];
};

const IMPORT_TIMEOUT_MS = 5_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label}: renderer import timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function dedup<T extends { id: string }>(items: T[], label: string): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) {
      console.warn(`[PluginContext] Duplicate ${label} id "${item.id}" — first registration kept`);
      return false;
    }
    seen.add(item.id);
    return true;
  });
}

export function PluginProvider({ children }: { children: ReactNode }): JSX.Element {
  const { data: specs } = useQuery({
    queryKey: ['plugin-ui'],
    queryFn: () => window.api.getPluginUi(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 0,
  });

  const { data: rendererPaths } = useQuery({
    queryKey: ['plugin-renderer-paths'],
    queryFn: () => window.api.getPluginRendererPaths(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 0,
  });

  const [components, setComponents] = useState<RendererPluginRegistry>(EMPTY_REGISTRY);
  const [rendererLoading, setRendererLoading] = useState(false);

  useEffect(() => {
    if (!rendererPaths || rendererPaths.length === 0) return;

    let cancelled = false;
    setRendererLoading(true);

    (async () => {
      const merged: RendererPluginRegistry = { routes: [], detailButtons: [], detailSections: [] };

      for (const { pluginId, url } of rendererPaths) {
        try {
          const mod = await withTimeout(
            import(/* @vite-ignore */ url) as Promise<RendererModule>,
            IMPORT_TIMEOUT_MS,
            pluginId,
          );
          if (mod.routes) merged.routes.push(...mod.routes);
          if (mod.detailButtons) merged.detailButtons.push(...mod.detailButtons);
          if (mod.detailSections) merged.detailSections.push(...mod.detailSections);
        } catch (err) {
          console.error(`[PluginContext] Failed to load renderer for ${pluginId}:`, err);
        }
      }

      merged.routes = dedup(merged.routes, 'route');
      merged.detailButtons = dedup(merged.detailButtons, 'detailButton');
      merged.detailSections = dedup(merged.detailSections, 'detailSection');

      if (!cancelled) {
        setComponents(merged);
        setRendererLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rendererPaths]);

  return (
    <PluginContext.Provider value={{ specs: specs ?? EMPTY_SPECS, components, rendererLoading }}>
      {children}
    </PluginContext.Provider>
  );
}

export function usePluginComponents(): RendererPluginRegistry {
  return useContext(PluginContext).components;
}

export function usePluginContext(): PluginContextValue {
  return useContext(PluginContext);
}
