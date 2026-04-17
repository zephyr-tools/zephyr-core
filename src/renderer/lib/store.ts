import type { Release } from '@shared/types';
import { create } from 'zustand';

interface UiState {
  search: string;
  category: string;
  page: number;
  /** Release currently open in the DetailPage. Cleared when the user hits Back. */
  selectedRelease: Release | null;
  /**
   * Most recent non-null release the user has opened this session. Persists
   * through DetailPage back navigation so plugin routes can read it as
   * "last viewed" context without losing it when the user returns to the grid.
   */
  lastViewedRelease: Release | null;
  pluginPage: string | null;
  setSearch: (s: string) => void;
  setCategory: (c: string) => void;
  setPage: (p: number) => void;
  setSelectedRelease: (r: Release | null) => void;
  setPluginPage: (id: string | null) => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  search: '',
  category: 'GAMES',
  page: 1,
  selectedRelease: null,
  lastViewedRelease: null,
  pluginPage: null,
  setSearch: (search) => set({ search, page: 1 }),
  setCategory: (category) => set({ category, page: 1 }),
  setPage: (page) => set({ page }),
  // Opening a release updates both; Back (setSelectedRelease(null)) only
  // clears the currently-open one so plugin routes retain the reference.
  setSelectedRelease: (selectedRelease) =>
    set(
      selectedRelease
        ? { selectedRelease, lastViewedRelease: selectedRelease }
        : { selectedRelease },
    ),
  setPluginPage: (pluginPage) => set({ pluginPage }),
  reset: () => set({ search: '', category: 'GAMES', page: 1 }),
}));
