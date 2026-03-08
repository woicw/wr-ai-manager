import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';
import type { GlobalConfig, ConfigGroup, ConfigItem, ConfigType } from '../types';
import { normalizeGlobalConfig, serializeGlobalConfig } from '@/lib/ai-tools';

interface ConfigStore {
  // State
  config: GlobalConfig | null;
  currentGroup: string;
  groups: ConfigGroup[];
  library: Record<ConfigType, ConfigItem[]>;
  loading: boolean;
  error: string | null;

  // Actions
  loadConfig: () => Promise<void>;
  saveConfig: (config: GlobalConfig) => Promise<void>;
  loadGroup: (groupId: string) => Promise<ConfigGroup>;
  saveGroup: (group: ConfigGroup) => Promise<void>;
  setCurrentGroup: (groupId: string) => void;
  setError: (error: string | null) => void;
}

export const useConfigStore = create<ConfigStore>((set) => ({
  // Initial state
  config: null,
  currentGroup: 'default',
  groups: [],
  library: {
    skills: [],
    mcp: [],
    plugins: [],
    commands: [],
  },
  loading: false,
  error: null,

  // Actions
  loadConfig: async () => {
    set({ loading: true, error: null });
    try {
      const rawConfig = await invoke<unknown>('load_global_config');
      const config = normalizeGlobalConfig(rawConfig as Record<string, unknown>);
      set({ config, currentGroup: config.activeGroup, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  saveConfig: async (config: GlobalConfig) => {
    set({ loading: true, error: null });
    try {
      await invoke('save_global_config', { config: serializeGlobalConfig(config) });
      set({ config, loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  loadGroup: async (groupId: string) => {
    set({ loading: true, error: null });
    try {
      const group = await invoke<ConfigGroup>('load_config_group', { groupId });
      set({ loading: false });
      return group;
    } catch (error) {
      set({ error: String(error), loading: false });
      throw error;
    }
  },

  saveGroup: async (group: ConfigGroup) => {
    set({ loading: true, error: null });
    try {
      await invoke('save_config_group', { group });
      set({ loading: false });
    } catch (error) {
      set({ error: String(error), loading: false });
    }
  },

  setCurrentGroup: (groupId: string) => {
    set({ currentGroup: groupId });
  },

  setError: (error: string | null) => {
    set({ error });
  },
}));
