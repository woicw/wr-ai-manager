import { useEffect, useMemo, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { ArrowPathIcon, PlusIcon } from "@heroicons/react/24/outline";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type { GlobalConfig } from "@/types";
import { toast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import {
  createCustomToolDefinition,
  getAiToolDefinition,
  getAiToolDefinitions,
  getDetectedToolMap,
  getToolPaths,
  normalizeGlobalConfig,
  normalizeToolDetection,
  serializeGlobalConfig,
  type ToolDetection,
} from "@/lib/ai-tools";
import { getNameBadgeClassName, getNameBadgeLabel } from "@/lib/name-badge";

interface ToolCardState {
  name: string;
  enabled: boolean;
  custom: boolean;
  configPath: string;
  skillsPath: string;
  mcpPath: string;
  commandPath: string;
}

interface CustomToolDraft {
  id: string;
  name: string;
  configPath: string;
  skillsPath: string;
  mcpPath: string;
  commandPath: string;
}

type EditableField = Exclude<
  keyof ToolCardState,
  "enabled" | "name" | "custom"
>;

const pathFields: Array<{ key: EditableField; label: string }> = [
  { key: "configPath", label: "common.labels.configPath" },
  { key: "skillsPath", label: "common.labels.skillsPath" },
  { key: "mcpPath", label: "common.labels.mcpPath" },
  { key: "commandPath", label: "common.labels.commandPath" },
];

function ToolStatusBadge({
  detected,
  custom,
}: {
  detected: boolean;
  custom: boolean;
}) {
  const { t } = useTranslation();
  if (custom) {
    return (
      <span className="inline-flex rounded-xl border border-sky-200 bg-sky-50 px-3 py-1 text-[13px] font-medium text-sky-600">
        {t("tools.custom")}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-xl border px-3 py-1 text-[13px] font-medium ${
        detected
          ? "border-emerald-200 bg-emerald-50 text-emerald-600"
          : "border-zinc-300 bg-zinc-100 text-zinc-500 dark:border-white/10 dark:bg-white/6 dark:text-foreground/72"
      }`}
    >
      {detected ? t("tools.detected") : t("tools.notDetected")}
    </span>
  );
}

function createEmptyCustomToolDraft(): CustomToolDraft {
  return {
    id: "",
    name: "",
    configPath: "",
    skillsPath: "",
    mcpPath: "",
    commandPath: "",
  };
}

function mergeDetectedTools(
  config: GlobalConfig,
  detectedTools: ToolDetection[],
  options: { overwriteDetected: boolean },
): GlobalConfig {
  const nextTools = { ...config.aiTools };
  const { overwriteDetected } = options;

  for (const detectedTool of detectedTools) {
    const existing = nextTools[detectedTool.id];
    const definition = getAiToolDefinition(detectedTool.id);
    const paths = getToolPaths(detectedTool.id, existing, detectedTool);

    if (existing && !overwriteDetected) {
      nextTools[detectedTool.id] = {
        ...existing,
        name:
          existing.name ??
          detectedTool.name ??
          definition?.name ??
          detectedTool.id,
        pathMappings: {
          config: existing.pathMappings.config ?? detectedTool.path,
          ...detectedTool.pathMappings,
          ...existing.pathMappings,
        },
      };
      continue;
    }

    nextTools[detectedTool.id] = {
      name:
        existing?.name ??
        detectedTool.name ??
        definition?.name ??
        detectedTool.id,
      enabled: overwriteDetected ? true : (existing?.enabled ?? true),
      pathMappings: {
        ...(existing?.pathMappings ?? {}),
        config: detectedTool.path,
        skills: paths.skillsPath,
        mcp: paths.mcpPath,
        commands: paths.commandPath,
      },
    };
  }

  return {
    ...config,
    aiTools: nextTools,
  };
}

function buildToolDrafts(config: GlobalConfig, detectedTools: ToolDetection[]) {
  const detectionMap = getDetectedToolMap(detectedTools);
  const definitionMap = new Map(
    getAiToolDefinitions().map((tool) => [tool.id, tool]),
  );

  return Object.fromEntries(
    Object.entries(config.aiTools).map(([toolId, tool]) => {
      const detectedTool = detectionMap.get(toolId) ?? null;
      const paths = getToolPaths(toolId, tool, detectedTool);

      return [
        toolId,
        {
          name: tool.name,
          enabled: tool.enabled,
          custom: !definitionMap.has(toolId),
          configPath: paths.configPath,
          skillsPath: paths.skillsPath,
          mcpPath: paths.mcpPath,
          commandPath: paths.commandPath,
        },
      ];
    }),
  ) as Record<string, ToolCardState>;
}

function areConfigsEqual(left: GlobalConfig, right: GlobalConfig) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function syncPathsFromConfigRoot(
  current: ToolCardState,
  nextConfigPath: string,
): ToolCardState {
  const normalizeRoot = (value: string) => value.replace(/\/$/, "");
  const currentRoot = normalizeRoot(current.configPath);
  const nextRoot = normalizeRoot(nextConfigPath);

  if (!currentRoot || !nextRoot) {
    return {
      ...current,
      configPath: nextConfigPath,
    };
  }

  const replaceRoot = (path: string, fallback: string) => {
    if (!path) return fallback;
    return path.startsWith(`${currentRoot}/`) || path === currentRoot
      ? path.replace(currentRoot, nextRoot)
      : path;
  };

  return {
    ...current,
    configPath: nextConfigPath,
    skillsPath: replaceRoot(current.skillsPath, `${nextRoot}/skills`),
    mcpPath: replaceRoot(
      current.mcpPath,
      current.mcpPath.endsWith(".mcp.json")
        ? `${nextRoot}/.mcp.json`
        : `${nextRoot}/mcp`,
    ),
    commandPath: replaceRoot(current.commandPath, `${nextRoot}/commands`),
  };
}

export function HomePage() {
  const { t } = useTranslation();
  const isDarkTheme = useIsDarkTheme();
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [detectedTools, setDetectedTools] = useState<ToolDetection[]>([]);
  const [toolDrafts, setToolDrafts] = useState<Record<string, ToolCardState>>(
    {},
  );
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [savingToolId, setSavingToolId] = useState<string | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [customToolDraft, setCustomToolDraft] = useState<CustomToolDraft>(
    createEmptyCustomToolDraft(),
  );
  const configRef = useRef<GlobalConfig | null>(null);
  const saveTimeoutsRef = useRef<Record<string, ReturnType<typeof setTimeout>>>(
    {},
  );

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    return () => {
      Object.entries(saveTimeoutsRef.current).forEach(([, timeout]) =>
        clearTimeout(timeout),
      );
    };
  }, []);

  const loadData = async (silent = false) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      const [rawGlobalConfig, rawDetected] = await Promise.all([
        invoke<unknown>("load_global_config"),
        invoke<unknown[]>("detect_ai_tools"),
      ]);

      const globalConfig = normalizeGlobalConfig(
        rawGlobalConfig as Record<string, unknown>,
      );
      const detected = rawDetected.map((tool) =>
        normalizeToolDetection(tool as Record<string, unknown>),
      );
      const mergedConfig = mergeDetectedTools(globalConfig, detected, {
        overwriteDetected: silent,
      });

      setConfig(mergedConfig);
      setDetectedTools(detected);
      setToolDrafts(buildToolDrafts(mergedConfig, detected));

      if (!areConfigsEqual(globalConfig, mergedConfig)) {
        await invoke("save_global_config", {
          config: serializeGlobalConfig(mergedConfig),
        });
      }

      if (silent) {
        toast({
          title: t("tools.toast.refreshSuccessTitle"),
          description: t("tools.toast.refreshSuccessDescription"),
          variant: "success",
        });
      }
    } catch (error) {
      console.error("Failed to load tools page:", error);
      toast({
        title: t("tools.toast.loadFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const tools = useMemo(() => {
    const detectionMap = getDetectedToolMap(detectedTools);
    const builtInDefinitions = getAiToolDefinitions();
    const customDefinitions = Object.entries(toolDrafts)
      .filter(([, draft]) => draft.custom)
      .map(([toolId, draft]) =>
        createCustomToolDefinition(toolId, {
          name: draft.name,
          enabled: draft.enabled,
          pathMappings: {
            skills: draft.skillsPath,
            mcp: draft.mcpPath,
            commands: draft.commandPath,
          },
        }),
      );

    return [...builtInDefinitions, ...customDefinitions]
      .filter(
        (definition, index, all) =>
          all.findIndex((item) => item.id === definition.id) === index,
      )
      .map((definition) => ({
        ...definition,
        detected: detectionMap.get(definition.id)?.detected ?? false,
        draft: toolDrafts[definition.id],
      }))
      .filter((tool) => tool.draft);
  }, [detectedTools, toolDrafts]);

  const updateToolDraft = (
    toolId: string,
    updater: (current: ToolCardState) => ToolCardState,
    debounceMs = 0,
  ) => {
    let nextDraft: ToolCardState | null = null;

    setToolDrafts((current) => {
      const existing = current[toolId];
      if (!existing) return current;

      nextDraft = updater(existing);

      return {
        ...current,
        [toolId]: nextDraft,
      };
    });

    if (!nextDraft) return;

    const persist = () => {
      delete saveTimeoutsRef.current[toolId];
      void persistToolDraft(toolId, nextDraft as ToolCardState);
    };

    const existingTimeout = saveTimeoutsRef.current[toolId];
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    if (debounceMs > 0) {
      saveTimeoutsRef.current[toolId] = setTimeout(persist, debounceMs);
    } else {
      persist();
    }
  };

  const flushToolSave = async (toolId: string) => {
    const pendingTimeout = saveTimeoutsRef.current[toolId];
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
      delete saveTimeoutsRef.current[toolId];
    }

    const draft = toolDrafts[toolId];
    if (!draft) return;
    await persistToolDraft(toolId, draft);
  };

  const persistToolDraft = async (toolId: string, draft: ToolCardState) => {
    const currentConfig = configRef.current;
    if (!currentConfig) return;

    const currentTool = currentConfig.aiTools[toolId];
    if (!draft || !currentTool) return;

    setSavingToolId(toolId);
    try {
      const nextConfig: GlobalConfig = {
        ...currentConfig,
        aiTools: {
          ...currentConfig.aiTools,
          [toolId]: {
            ...currentTool,
            name: draft.name,
            enabled: draft.enabled,
            pathMappings: {
              ...currentTool.pathMappings,
              config: draft.configPath,
              skills: draft.skillsPath,
              mcp: draft.mcpPath,
              commands: draft.commandPath,
            },
          },
        },
      };

      await invoke("save_global_config", {
        config: serializeGlobalConfig(nextConfig),
      });
      setConfig(nextConfig);
    } catch (error) {
      console.error("Failed to save tool:", error);
      toast({
        title: t("tools.toast.saveFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setSavingToolId((current) => (current === toolId ? null : current));
    }
  };

  const handleAddCustomTool = async () => {
    if (!config) return;

    const toolId = customToolDraft.id.trim();
    const toolName = customToolDraft.name.trim();
    const configPath = customToolDraft.configPath.trim();

    if (!toolId || !toolName || !configPath) {
      toast({
        title: t("tools.toast.missingFieldsTitle"),
        description: t("tools.toast.missingFieldsDescription"),
        variant: "destructive",
      });
      return;
    }

    if (config.aiTools[toolId]) {
      toast({
        title: t("tools.toast.addFailedTitle"),
        description: t("tools.toast.addFailedExistsDescription"),
        variant: "destructive",
      });
      return;
    }

    const skillsPath =
      customToolDraft.skillsPath.trim() || `${configPath}/skills`;
    const mcpPath = customToolDraft.mcpPath.trim() || `${configPath}/.mcp.json`;
    const commandPath =
      customToolDraft.commandPath.trim() || `${configPath}/commands`;

    const nextConfig: GlobalConfig = {
      ...config,
      aiTools: {
        ...config.aiTools,
        [toolId]: {
          name: toolName,
          enabled: true,
          pathMappings: {
            config: configPath,
            skills: skillsPath,
            mcp: mcpPath,
            commands: commandPath,
          },
        },
      },
    };

    try {
      await invoke("save_global_config", {
        config: serializeGlobalConfig(nextConfig),
      });
      setConfig(nextConfig);
      setToolDrafts((current) => ({
        ...current,
        [toolId]: {
          name: toolName,
          enabled: true,
          custom: true,
          configPath,
          skillsPath,
          mcpPath,
          commandPath,
        },
      }));
      setCustomToolDraft(createEmptyCustomToolDraft());
      setAddDialogOpen(false);
      toast({
        title: t("tools.toast.addSuccessTitle"),
        description: t("tools.toast.addSuccessDescription", { toolName }),
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to add custom tool:", error);
      toast({
        title: t("tools.toast.addFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("tools.loading")}</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-transparent">
      <header
        className={`mx-6 mt-6 flex flex-col gap-3 rounded-[32px] px-6 py-5 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between ${
          isDarkTheme
            ? "border border-white/10 bg-[linear-gradient(135deg,rgba(34,48,74,0.98),rgba(28,58,92,0.94)_48%,rgba(21,67,72,0.9))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
            : "border border-sky-200/70 bg-[linear-gradient(135deg,rgba(242,248,255,0.98),rgba(230,242,255,0.88)_44%,rgba(232,250,248,0.82))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        }`}
      >
        <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground">
          {t("tools.title")}
        </h1>

        <div className="flex items-center gap-3 self-start lg:self-auto">
          <Button
            type="button"
            variant="outline"
            onClick={() => loadData(true)}
            className="rounded-2xl px-4 text-[15px]"
          >
            <ArrowPathIcon
              className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
            />
            {t("common.actions.refresh")}
          </Button>
          <Button
            type="button"
            variant="success"
            className="rounded-2xl border border-black/10 px-5 text-[15px] shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_18px_rgba(5,150,105,0.14)] hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_12px_22px_rgba(5,150,105,0.18)]"
            onClick={() => setAddDialogOpen(true)}
          >
            <PlusIcon className="h-4 w-4" />
            {t("tools.addCustomTool")}
          </Button>
        </div>
      </header>

      <section className="px-6 py-6">
        <div className="mb-5 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("tools.detected")}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {tools.map((tool) => {
            const draft = tool.draft;
            if (!draft) return null;

            return (
              <div
                key={tool.id}
                className="rounded-[28px] border border-white/50 bg-card/86 p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-[0_24px_54px_rgba(15,23,42,0.12)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex min-w-0 items-start gap-4">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-[18px] text-2xl font-semibold ${getNameBadgeClassName(draft.name)}`}
                    >
                      {getNameBadgeLabel(draft.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">
                          {draft.name}
                        </h2>
                        <ToolStatusBadge
                          detected={tool.detected}
                          custom={draft.custom}
                        />
                      </div>
                      <p className="mt-1 text-[14px] text-muted-foreground">
                        ID: {tool.id}
                      </p>
                    </div>
                  </div>

                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(checked) =>
                      updateToolDraft(tool.id, (current) => ({
                        ...current,
                        enabled: checked,
                      }))
                    }
                  />
                </div>

                <div className="mt-4 h-px bg-border" />

                <div className="mt-4 space-y-3">
                  {pathFields.map((item) => (
                    <div
                      key={item.key}
                      className="grid grid-cols-[96px_minmax(0,1fr)_20px] items-center gap-3"
                    >
                      <span className="text-[13px] font-medium text-muted-foreground">
                        {t(item.label)}
                      </span>
                      <Input
                        value={draft[item.key]}
                        onChange={(event) =>
                          updateToolDraft(
                            tool.id,
                            (current) =>
                              item.key === "configPath"
                                ? syncPathsFromConfigRoot(
                                    current,
                                    event.target.value,
                                  )
                                : {
                                    ...current,
                                    [item.key]: event.target.value,
                                  },
                            350,
                          )
                        }
                        onBlur={() => {
                          void flushToolSave(tool.id);
                        }}
                        className="h-10 rounded-xl border-0 bg-background font-mono text-[13px] text-foreground shadow-none focus-visible:ring-ring"
                      />
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex justify-end text-[12px] font-medium text-muted-foreground">
                  {savingToolId === tool.id
                    ? t("common.status.saving")
                    : saveTimeoutsRef.current[tool.id]
                      ? t("common.status.pendingChanges")
                      : t("common.status.autoSaved")}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("tools.addDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("tools.addDialog.description")}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <Input
              value={customToolDraft.id}
              onChange={(event) =>
                setCustomToolDraft((current) => ({
                  ...current,
                  id: event.target.value,
                }))
              }
              placeholder={t("tools.addDialog.toolIdPlaceholder")}
            />
            <Input
              value={customToolDraft.name}
              onChange={(event) =>
                setCustomToolDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              placeholder={t("tools.addDialog.toolNamePlaceholder")}
            />
            <Input
              value={customToolDraft.configPath}
              onChange={(event) =>
                setCustomToolDraft((current) => ({
                  ...current,
                  configPath: event.target.value,
                }))
              }
              placeholder={t("tools.addDialog.configPathPlaceholder")}
            />
            <Input
              value={customToolDraft.skillsPath}
              onChange={(event) =>
                setCustomToolDraft((current) => ({
                  ...current,
                  skillsPath: event.target.value,
                }))
              }
              placeholder={t("tools.addDialog.skillsPathPlaceholder")}
            />
            <Input
              value={customToolDraft.mcpPath}
              onChange={(event) =>
                setCustomToolDraft((current) => ({
                  ...current,
                  mcpPath: event.target.value,
                }))
              }
              placeholder={t("tools.addDialog.mcpPathPlaceholder")}
            />
            <Input
              value={customToolDraft.commandPath}
              onChange={(event) =>
                setCustomToolDraft((current) => ({
                  ...current,
                  commandPath: event.target.value,
                }))
              }
              placeholder={t("tools.addDialog.commandPathPlaceholder")}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAddDialogOpen(false)}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleAddCustomTool}
              variant="success"
            >
              {t("common.actions.add")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
