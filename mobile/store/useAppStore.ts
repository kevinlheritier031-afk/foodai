import { create } from 'zustand';

interface AppState {
  activeProfileId: string | null;
  setActiveProfileId: (id: string | null) => void;
  selectedDate: string;
  setSelectedDate: (date: string) => void;
}

const todayISO = () => new Date().toISOString().split('T')[0];

export const useAppStore = create<AppState>((set) => ({
  activeProfileId: null,
  setActiveProfileId: (id) => set({ activeProfileId: id }),
  selectedDate: todayISO(),
  setSelectedDate: (date) => set({ selectedDate: date }),
}));
