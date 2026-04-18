import type { Release } from '@shared/types';
import { create } from 'zustand';

interface UiState {
  search: string;
  category: string;
  page: number;
  /** Release currently open in the DetailPage; cleared on Back. */
  selectedRelease: Release | null;
  /** Most recent release opened this session; sticky so plugin routes keep context. */
  lastViewedRelease: Release | null;
  pluginPage: string | null;
  /** Top-level page: releases grid or the library. */
  activePage: 'releases' | 'library';
  setSearch: (s: string) => void;
  setCategory: (c: string) => void;
  setPage: (p: number) => void;
  setSelectedRelease: (r: Release | null) => void;
  setPluginPage: (id: string | null) => void;
  setActivePage: (p: 'releases' | 'library') => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  search: '',
  category: 'GAMES',
  page: 1,
  selectedRelease: null,
  lastViewedRelease: null,
  pluginPage: null,
  activePage: 'releases',
  setSearch: (search) => set({ search, page: 1 }),
  setCategory: (category) => set({ category, page: 1 }),
  setPage: (page) => set({ page }),
  setSelectedRelease: (selectedRelease) =>
    set(
      selectedRelease
        ? { selectedRelease, lastViewedRelease: selectedRelease }
        : { selectedRelease },
    ),
  setPluginPage: (pluginPage) => set({ pluginPage }),
  setActivePage: (activePage) => set({ activePage, selectedRelease: null, pluginPage: null }),
  reset: () => set({ search: '', category: 'GAMES', page: 1 }),
}));
