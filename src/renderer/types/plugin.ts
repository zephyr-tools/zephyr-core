import type { ComponentType } from 'react';
import type { Release } from '@shared/types';

export interface PluginPageProps {
  release?: Release;
}

export interface PluginRoute {
  id: string;
  navLabel: string;
  component: () => Promise<{ default: ComponentType<PluginPageProps> }>;
}

export interface PluginDetailButton {
  id: string;
  component: ComponentType<{ release: Release }>;
}

export interface PluginDetailSection {
  id: string;
  title: string;
  component: ComponentType<{ release: Release }>;
}

/** Unified button entry — either a React component or a plain IPC action. */
export type DetailButton =
  | { kind: 'component'; id: string; component: ComponentType<{ release: Release }> }
  | { kind: 'action'; id: string; label: string; action: string; icon?: string };

export interface RendererPluginRegistry {
  routes: PluginRoute[];
  detailButtons: PluginDetailButton[];
  detailSections: PluginDetailSection[];
}

export const EMPTY_REGISTRY: RendererPluginRegistry = {
  routes: [],
  detailButtons: [],
  detailSections: [],
};
