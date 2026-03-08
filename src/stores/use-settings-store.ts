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

function resolvePersistedString(
  persistedValue: unknown,
  fallbackValue: string,
) {
  return typeof persistedValue === 'string' && persistedValue.trim().length > 0
    ? persistedValue
    : fallbackValue;
}

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
      merge: (persistedState, currentState) => {
        const persisted = (persistedState as Partial<SettingsStore>) ?? {};

        return {
          ...currentState,
          ...persisted,
          locale:
            persisted.locale === 'zh-CN' || persisted.locale === 'en-US'
              ? persisted.locale
              : currentState.locale,
          defaultEditor:
            typeof persisted.defaultEditor === 'string'
              ? persisted.defaultEditor
              : currentState.defaultEditor,
          githubRepoUrl: resolvePersistedString(
            persisted.githubRepoUrl,
            currentState.githubRepoUrl,
          ),
          githubUseRelativePath:
            typeof persisted.githubUseRelativePath === 'boolean'
              ? persisted.githubUseRelativePath
              : currentState.githubUseRelativePath,
          githubRelativePath: resolvePersistedString(
            persisted.githubRelativePath,
            currentState.githubRelativePath,
          ),
        };
      },
    },
  ),
);
