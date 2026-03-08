export interface GlobalConfig {
  version: string;
  activeGroup: string;
  activations: Record<string, Activation | null>;
  groups: string[];
  aiTools: Record<string, AITool>;
}

export interface Activation {
  groupId: string;
  timestamp: string;
  configTypes: string[];
}

export interface AITool {
  name: string;
  enabled: boolean;
  pathMappings: Record<string, string>;
}

export interface ConfigGroup {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  selection: Record<string, ToolSelection>;
}

export interface ToolSelection {
  enabled: boolean;
  skills: string[];
  mcp: string[];
  plugins: string[];
  commands: string[];
}

export interface ConfigItem {
  name: string;
  path: string;
  existsInLibrary: boolean;
  size: number;
}

export interface LibraryItem {
  name: string;
  path: string;
  size: number;
  isDir: boolean;
  description: string;
}

export interface ApplyResult {
  success: boolean;
  message: string;
  conflicts: ConflictDetail[];
  usedFallbackCopy?: boolean;
  used_fallback_copy?: boolean;
}

export interface ConflictDetail {
  path: string;
  configType: string;
  itemName: string;
  isSymlink: boolean;
  target?: string;
}

export type ConfigType = 'skills' | 'mcp' | 'plugins' | 'commands';
