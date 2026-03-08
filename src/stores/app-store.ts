import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";

export type AppStoreState = {
  libraryVersion: number;
  bumpLibraryVersion: () => void;
};

export const createAppStore = () =>
  createStore<AppStoreState>()((set) => ({
    libraryVersion: 0,
    bumpLibraryVersion: () => {
      set((state) => ({ libraryVersion: state.libraryVersion + 1 }));
    },
  }));

const appStore = createAppStore();

export const useAppStore = <T,>(selector: (state: AppStoreState) => T) =>
  useStore(appStore, selector);
