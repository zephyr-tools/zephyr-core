import type { PluginUi, Release } from '@shared/types';
import { useQuery } from '@tanstack/react-query';
import { createContext, type JSX, type ReactNode, useContext } from 'react';

const EMPTY_UI: PluginUi = {
  detailButtons: [],
  detailSections: [],
  cardMenuItems: [],
  settings: [],
};

const PluginContext = createContext<PluginUi>(EMPTY_UI);

export function PluginProvider({ children }: { children: ReactNode }): JSX.Element {
  const { data } = useQuery({
    queryKey: ['plugin-ui'],
    queryFn: () => window.api.getPluginUi(),
    staleTime: Number.POSITIVE_INFINITY,
    gcTime: Number.POSITIVE_INFINITY,
    retry: 0,
  });
  return <PluginContext.Provider value={data ?? EMPTY_UI}>{children}</PluginContext.Provider>;
}

export function usePluginUi(): PluginUi {
  return useContext(PluginContext);
}

export async function invokePluginAction(channel: string, release: Release): Promise<void> {
  try {
    await window.api.invokePlugin(channel, release);
  } catch (err) {
    console.error(`[PluginContext] invokePlugin(${channel}) failed:`, (err as Error).message);
  }
}
