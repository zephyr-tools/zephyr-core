import type { Release } from '@shared/types';
import { create } from 'zustand';

interface UiState {
  search: string;
  category: string;
  page: number;
  selectedRelease: Release | null;
  setSearch: (s: string) => void;
  setCategory: (c: string) => void;
  setPage: (p: number) => void;
  setSelectedRelease: (r: Release | null) => void;
  reset: () => void;
}

export const useUiStore = create<UiState>((set) => ({
  search: '',
  category: 'GAMES',
  page: 1,
  selectedRelease: null,
  setSearch: (search) => set({ search, page: 1 }),
  setCategory: (category) => set({ category, page: 1 }),
  setPage: (page) => set({ page }),
  setSelectedRelease: (selectedRelease) => set({ selectedRelease }),
  reset: () => set({ search: '', category: 'GAMES', page: 1 }),
}));
