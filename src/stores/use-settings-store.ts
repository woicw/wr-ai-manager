import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  locale: 'zh-CN' | 'en-US';
  defaultEditor: string;
  githubRepoUrl: string;
  githubUseRelativePath: boolean;
  githubRelativePath: string;
  setLocale: (value: 'zh-CN' | 'en-US') => void;
  setDefaultEditor: (value: string) => void;
  setGithubRepoUrl: (value: string) => void;
  setGithubUseRelativePath: (value: boolean) => void;
  setGithubRelativePath: (value: string) => void;
}

const defaultSettings: Omit<
  SettingsStore,
  | 'setLocale'
  | 'setDefaultEditor'
  | 'setGithubRepoUrl'
  | 'setGithubUseRelativePath'
  | 'setGithubRelativePath'
> = {
  locale: 'zh-CN',
  defaultEditor: '',
  githubRepoUrl: 'https://github.com/woicw/ai-config',
  githubUseRelativePath: true,
  githubRelativePath: 'awesome-claude',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      ...defaultSettings,
      setLocale: (value) => set({ locale: value }),
      setDefaultEditor: (value) => set({ defaultEditor: value }),
      setGithubRepoUrl: (value) => set({ githubRepoUrl: value }),
      setGithubUseRelativePath: (value) => set({ githubUseRelativePath: value }),
      setGithubRelativePath: (value) => set({ githubRelativePath: value }),
    }),
    {
      name: 'settings-storage',
      merge: (persistedState, currentState) => ({
        ...currentState,
        ...(persistedState as Partial<SettingsStore>),
      }),
    },
  ),
);
