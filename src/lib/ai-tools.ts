import type { AITool, GlobalConfig } from '@/types';

export interface AIToolDefinition {
  id: string;
  name: string;
  iconText: string;
  iconClassName: string;
  configDir: string;
  skillsDir: string;
}

export interface ToolDetection {
  id: string;
  name: string;
  path: string;
  detected: boolean;
  configTypes: string[];
  pathMappings: Record<string, string>;
}

interface RawToolDetection {
  id?: string;
  name?: string;
  path?: string;
  detected?: boolean;
  configTypes?: string[];
  config_types?: string[];
  pathMappings?: Record<string, string>;
  path_mappings?: Record<string, string>;
}

interface RawGlobalConfig {
  version?: string;
  activeGroup?: string;
  active_group?: string;
  activations?: Record<string, unknown>;
  groups?: string[];
  aiTools?: Record<string, RawAITool>;
  ai_tools?: Record<string, RawAITool>;
}

interface RawAITool {
  name?: string;
  enabled?: boolean;
  pathMappings?: Record<string, string>;
  path_mappings?: Record<string, string>;
}

interface SerializedAITool {
  name: string;
  enabled: boolean;
  path_mappings: Record<string, string>;
}

interface SerializedGlobalConfig {
  version: string;
  active_group: string;
  activations: Record<string, unknown>;
  groups: string[];
  ai_tools: Record<string, SerializedAITool>;
}

interface SerializedToolSelection {
  enabled: boolean;
  skills: string[];
  mcp: string[];
  plugins: string[];
  commands: string[];
}

interface SerializedConfigGroup {
  id: string;
  name: string;
  description: string;
  created_at: string;
  updated_at: string;
  selection: Record<string, SerializedToolSelection>;
}

const toolDefinitions: AIToolDefinition[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    iconText: '✳',
    iconClassName: 'bg-orange-50 text-orange-500',
    configDir: '~/.claude',
    skillsDir: '~/.claude/skills',
  },
  {
    id: 'codex',
    name: 'Codex',
    iconText: '◎',
    iconClassName: 'bg-zinc-100 text-zinc-900',
    configDir: '~/.codex',
    skillsDir: '~/.codex/skills',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    iconText: '▣',
    iconClassName: 'bg-zinc-100 text-zinc-950',
    configDir: '~/.cursor',
    skillsDir: '~/.cursor/skills',
  },
  {
    id: 'gemini',
    name: 'Gemini CLI',
    iconText: '✦',
    iconClassName: 'bg-sky-50 text-sky-500',
    configDir: '~/.gemini',
    skillsDir: '~/.gemini/skills',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    iconText: 'A',
    iconClassName: 'bg-zinc-100 text-zinc-950',
    configDir: '~/.antigravity',
    skillsDir: '~/.antigravity/skills',
  },
  {
    id: 'trae',
    name: 'Trae',
    iconText: 'T',
    iconClassName: 'bg-emerald-50 text-emerald-500',
    configDir: '~/.trae',
    skillsDir: '~/.trae/skills',
  },
  {
    id: 'kiro',
    name: 'Kiro',
    iconText: 'K',
    iconClassName: 'bg-violet-50 text-violet-600',
    configDir: '~/.kiro',
    skillsDir: '~/.kiro/skills',
  },
  {
    id: 'codebuddy',
    name: 'CodeBuddy',
    iconText: '>',
    iconClassName: 'bg-slate-200 text-slate-700',
    configDir: '~/.codebuddy',
    skillsDir: '~/.codebuddy/skills',
  },
];

export function getAiToolDefinitions() {
  return toolDefinitions;
}

export function getAiToolDefinition(toolId: string) {
  return toolDefinitions.find((tool) => tool.id === toolId);
}

export function normalizeToolDetection(raw: RawToolDetection): ToolDetection {
  return {
    id: raw.id ?? '',
    name: raw.name ?? '',
    path: raw.path ?? '',
    detected: Boolean(raw.detected),
    configTypes: raw.configTypes ?? raw.config_types ?? [],
    pathMappings: raw.pathMappings ?? raw.path_mappings ?? {},
  };
}

export function normalizeGlobalConfig(raw: RawGlobalConfig): GlobalConfig {
  const rawTools = raw.aiTools ?? raw.ai_tools ?? {};

  return {
    version: raw.version ?? '1.0.0',
    activeGroup: raw.activeGroup ?? raw.active_group ?? '',
    activations: (raw.activations ?? {}) as GlobalConfig['activations'],
    groups: raw.groups ?? [],
    aiTools: Object.fromEntries(
      Object.entries(rawTools).map(([toolId, tool]) => [
        toolId,
        {
          name: tool.name ?? toolId,
          enabled: Boolean(tool.enabled),
          pathMappings: tool.pathMappings ?? tool.path_mappings ?? {},
        },
      ]),
    ),
  };
}

export function serializeGlobalConfig(config: GlobalConfig): SerializedGlobalConfig {
  return {
    version: config.version,
    active_group: config.activeGroup,
    activations: config.activations,
    groups: config.groups,
    ai_tools: Object.fromEntries(
      Object.entries(config.aiTools).map(([toolId, tool]) => [
        toolId,
        {
          name: tool.name,
          enabled: tool.enabled,
          path_mappings: tool.pathMappings,
        },
      ]),
    ),
  };
}

export function serializeConfigGroup(group: {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  selection: Record<string, SerializedToolSelection>;
}): SerializedConfigGroup {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    created_at: group.createdAt,
    updated_at: group.updatedAt,
    selection: group.selection,
  };
}

export function getDetectedToolMap(detectedTools: ToolDetection[]) {
  return new Map(detectedTools.map((tool) => [tool.id, tool]));
}

export function createCustomToolDefinition(toolId: string, tool: AITool): AIToolDefinition {
  return {
    id: toolId,
    name: tool.name || toolId,
    iconText: (tool.name || toolId).trim().charAt(0).toUpperCase() || '?',
    iconClassName: 'bg-slate-100 text-slate-700',
    configDir: '',
    skillsDir: '',
  };
}

export function getToolPaths(
  toolId: string,
  tool: AITool | null | undefined,
  detectedTool?: ToolDetection | null,
): {
  configPath: string;
  skillsPath: string;
  mcpPath: string;
  commandPath: string;
} {
  const definition = getAiToolDefinition(toolId);
  const detectedMappings = detectedTool?.pathMappings ?? {};
  const mappings = {
    ...tool?.pathMappings,
    ...detectedMappings,
  };
  const configPath =
    tool?.pathMappings?.config ||
    detectedTool?.path ||
    mappings.skills?.replace(/\/skills$/, '') ||
    definition?.configDir ||
    '';
  const skillsPath = mappings.skills ?? definition?.skillsDir ?? '';
  const mcpPath =
    toolId === 'claude-code'
      ? !mappings.mcp || mappings.mcp.endsWith('/mcp')
        ? `${configPath}/.mcp.json`
        : mappings.mcp
      : mappings.mcp ?? `${configPath}/mcp`;
  const commandPath = mappings.commands ?? `${configPath}/commands`;

  return { configPath, skillsPath, mcpPath, commandPath };
}
