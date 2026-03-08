import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type {
  ApplyResult,
  ConfigGroup,
  LibraryItem,
  ConfigType,
  GlobalConfig,
  ToolSelection,
} from "../../types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { ArrowPathIcon } from "@heroicons/react/24/outline";
import { normalizeGlobalConfig, serializeConfigGroup } from "@/lib/ai-tools";
import { toast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import { getNameBadgeClassName, getNameBadgeLabel } from "@/lib/name-badge";
import { useConfigStore } from "@/stores";

const CONFIG_TYPES = [
  "skills",
  "mcp",
  "commands",
] as const satisfies ConfigType[];
type SupportedConfigType = (typeof CONFIG_TYPES)[number];

const CONFIG_TYPE_LABELS: Record<ConfigType, string> = {
  skills: "Skills",
  mcp: "MCP",
  commands: "Commands",
  plugins: "Plugins",
};

function createDefaultSelection(
  library: Record<ConfigType, LibraryItem[]>,
): ToolSelection {
  return {
    enabled: true,
    skills: library.skills.map((item) => item.name),
    mcp: library.mcp.map((item) => item.name),
    plugins: [],
    commands: library.commands.map((item) => item.name),
  };
}

function normalizeGroup(raw: unknown): ConfigGroup {
  const value = (raw ?? {}) as Record<string, unknown>;
  return {
    id: String(value.id ?? ""),
    name: String(value.name ?? ""),
    description: String(value.description ?? ""),
    createdAt: String(value.createdAt ?? value.created_at ?? ""),
    updatedAt: String(value.updatedAt ?? value.updated_at ?? ""),
    selection: (value.selection ?? {}) as ConfigGroup["selection"],
  };
}

function getSelectionForTool(
  group: ConfigGroup,
  toolId: string,
  library: Record<ConfigType, LibraryItem[]>,
) {
  return group.selection[toolId] || createDefaultSelection(library);
}

function filterSelectionForTool(
  selection: ReturnType<typeof createDefaultSelection>,
  pathMappings: Record<string, string> | undefined,
) {
  const mappings = pathMappings ?? {};
  return {
    enabled: true,
    skills: mappings.skills ? selection.skills : [],
    mcp: mappings.mcp ? selection.mcp : [],
    plugins: [],
    commands: mappings.commands ? selection.commands : [],
  };
}

export function ConfigGroupPage() {
  const { t } = useTranslation();
  const isDarkTheme = useIsDarkTheme();
  const { groupId } = useParams<{ groupId: string }>();
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const [activeType, setActiveType] = useState<SupportedConfigType>("skills");
  const [globalConfig, setGlobalConfig] = useState<GlobalConfig | null>(null);
  const [group, setGroup] = useState<ConfigGroup | null>(null);
  const [library, setLibrary] = useState<Record<ConfigType, LibraryItem[]>>({
    skills: [],
    mcp: [],
    plugins: [],
    commands: [],
  });
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [searchValues, setSearchValues] = useState<
    Record<SupportedConfigType, string>
  >({
    skills: "",
    mcp: "",
    commands: "",
  });
  const [selection, setSelection] = useState<ToolSelection>(
    createDefaultSelection({
      skills: [],
      mcp: [],
      plugins: [],
      commands: [],
    }),
  );

  const persistSelectionDraft = async (nextSelectionState: ToolSelection) => {
    if (!group || !globalConfig) return;

    const existingTools = Object.entries(globalConfig.aiTools).filter(
      ([, tool]) => tool.enabled,
    );

    const nextSelection = Object.fromEntries(
      existingTools.map(([toolId, tool]) => [
        toolId,
        filterSelectionForTool(nextSelectionState, tool.pathMappings),
      ]),
    );

    const nextGroup = {
      ...group,
      selection: nextSelection,
      updatedAt: new Date().toISOString(),
    };

    setGroup(nextGroup);

    try {
      await invoke("save_config_group", {
        group: serializeConfigGroup(nextGroup),
      });
    } catch (error) {
      console.error("Failed to save group draft:", error);
      toast({
        title: t("groups.toast.saveFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const availableTools = useMemo(() => {
    if (!globalConfig) return [];

    return Object.entries(globalConfig.aiTools)
      .filter(([, tool]) => tool.enabled)
      .map(([id, tool]) => ({
        id,
        name: tool.name || id,
      }));
  }, [globalConfig]);

  const totalItems = useMemo(
    () => CONFIG_TYPES.reduce((sum, type) => sum + library[type].length, 0),
    [library],
  );
  const filteredItems = useMemo(() => {
    const keyword = searchValues[activeType].trim().toLowerCase();
    if (!keyword) {
      return library[activeType];
    }

    return library[activeType].filter((item) =>
      [item.name, item.description]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(keyword)),
    );
  }, [activeType, library, searchValues]);

  useEffect(() => {
    if (groupId) {
      loadGroupData();
    }
  }, [groupId]);

  const loadGroupData = async () => {
    if (!groupId) return;

    setLoading(true);
    try {
      const [
        rawGroupData,
        rawGlobalConfigData,
        skillsData,
        mcpData,
        commandsData,
      ] = await Promise.all([
        invoke<unknown>("load_config_group", { groupId }),
        invoke<unknown>("load_global_config"),
        invoke<LibraryItem[]>("list_library_items", { configType: "skills" }),
        invoke<LibraryItem[]>("list_library_items", { configType: "mcp" }),
        invoke<LibraryItem[]>("list_library_items", { configType: "commands" }),
      ]);
      const groupData = normalizeGroup(rawGroupData);
      const globalConfigData = normalizeGlobalConfig(
        rawGlobalConfigData as Record<string, unknown>,
      );

      const nextLibrary = {
        skills: skillsData,
        mcp: mcpData,
        plugins: [],
        commands: commandsData,
      };
      setLibrary(nextLibrary);
      setGlobalConfig(globalConfigData);
      const existingToolIds = Object.entries(globalConfigData.aiTools)
        .filter(([, tool]) => tool.enabled)
        .map(([toolId]) => toolId);
      const baseSelection =
        existingToolIds.length > 0
          ? getSelectionForTool(groupData, existingToolIds[0], nextLibrary)
          : createDefaultSelection(nextLibrary);
      setSelection(baseSelection);
      setGroup(groupData);
    } catch (error) {
      console.error("Failed to load group data:", error);
      toast({
        title: t("groups.toast.loadFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggleItem = (
    configType: SupportedConfigType,
    itemName: string,
    checked: boolean,
  ) => {
    const items = selection[configType];
    const newItems = checked
      ? Array.from(new Set([...items, itemName]))
      : items.filter((i) => i !== itemName);
    const nextSelectionState = {
      ...selection,
      [configType]: newItems,
    };

    setSelection(nextSelectionState);
    void persistSelectionDraft(nextSelectionState);
  };

  const handleApplyAll = async () => {
    if (!group || !globalConfig) return;

    const existingTools = Object.entries(globalConfig.aiTools).filter(
      ([, tool]) => tool.enabled,
    );
    if (existingTools.length === 0) {
      toast({
        title: t("groups.toast.cannotApplyTitle"),
        description: t("groups.toast.cannotApplyDescription"),
        variant: "destructive",
      });
      return;
    }

    const nextSelection = Object.fromEntries(
      existingTools.map(([toolId, tool]) => [
        toolId,
        filterSelectionForTool(selection, tool.pathMappings),
      ]),
    );

    const nextGroup = {
      ...group,
      selection: nextSelection,
      updatedAt: new Date().toISOString(),
    };

    setApplying(true);
    try {
      let usedFallbackCopy = false;
      console.log("[group.apply] saving group before apply", {
        groupId: nextGroup.id,
        enabledTools: existingTools.map(([toolId, tool]) => ({
          toolId,
          name: tool.name,
          pathMappings: tool.pathMappings,
        })),
        selection,
        nextSelection,
      });
      await invoke("save_config_group", {
        group: serializeConfigGroup(nextGroup),
      });
      setGroup(nextGroup);
      for (const [toolId] of existingTools) {
        const result = await invoke<ApplyResult>("apply_config_group", {
          groupId: nextGroup.id,
          toolId,
          force: true,
        });
        usedFallbackCopy ||= Boolean(
          result.usedFallbackCopy ?? result.used_fallback_copy,
        );
        console.log("[group.apply] apply result", {
          groupId: nextGroup.id,
          toolId,
          result,
        });
      }
      await loadConfig();
      toast({
        title: t("groups.toast.applySuccessTitle"),
        description: t("groups.toast.applySuccessDescription", {
          groupId: nextGroup.id,
          count: existingTools.length,
        }),
        variant: "success",
      });
      if (usedFallbackCopy) {
        toast({
          title: t("common.toast.windowsFallbackCopyTitle"),
          description: t("common.toast.windowsFallbackCopyDescription"),
          variant: "default",
        });
      }
    } catch (error) {
      console.error("Failed to apply group:", error);
      toast({
        title: t("groups.toast.applyFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-16">
        <ArrowPathIcon className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!group) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-muted-foreground">{t("common.empty.groupNotFound")}</div>
      </div>
    );
  }

  const hasAnyLibraryItems = CONFIG_TYPES.some(
    (type) => library[type].length > 0,
  );
  const currentItems = filteredItems;
  const enabledToolNames = availableTools.map((tool) => tool.name).join(", ");

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <section
        className={`rounded-[32px] px-6 py-5 backdrop-blur-xl ${
          isDarkTheme
            ? "border border-white/10 bg-[linear-gradient(135deg,rgba(28,50,43,0.98),rgba(28,73,58,0.92)_48%,rgba(25,56,61,0.9))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
            : "border border-white/50 bg-[linear-gradient(135deg,rgba(240,255,247,0.98),rgba(219,246,234,0.84)_46%,rgba(224,250,241,0.72))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        }`}
      >
      <div className="flex items-start justify-between gap-6">
        <div>
          <h2 className="text-[26px] font-semibold tracking-[-0.04em] text-foreground">
            {group.name}
          </h2>
          <p className="mt-2 text-[14px] leading-6 text-muted-foreground">
            {group.description}
          </p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {t("common.labels.totalItems", { count: totalItems })}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleApplyAll}
            disabled={
              applying || !hasAnyLibraryItems || availableTools.length === 0
            }
            variant="success"
          >
            {applying ? t("common.status.applying") : t("groups.applyAll")}
          </Button>
        </div>
      </div>
      </section>

      {availableTools.length > 0 ? (
        <div className="space-y-3">
          <div className="px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("groups.availableTools")}
          </div>
          <div className="flex flex-wrap gap-2">
            {availableTools.map((tool) => (
              <Button
                key={tool.id}
                type="button"
                variant="outline"
                className="rounded-2xl"
              >
                {tool.name}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <div className={`rounded-[28px] px-6 py-5 text-sm text-muted-foreground shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-emerald-200/70 bg-[linear-gradient(135deg,rgba(247,255,250,0.95),rgba(233,249,240,0.82))]"}`}>
          {t("groups.noAvailableTools")}
        </div>
      )}

      <Tabs
        value={activeType}
        onValueChange={(value) => setActiveType(value as SupportedConfigType)}
      >
        <TabsList className={`grid h-auto grid-cols-3 rounded-[22px] p-1 shadow-[0_12px_32px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-white/10 bg-black/20" : "border border-white/45 bg-[linear-gradient(135deg,rgba(233,248,239,0.9),rgba(223,243,234,0.72))]"}`}>
          {CONFIG_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {CONFIG_TYPE_LABELS[type]}
              <span className="ml-1.5 text-xs opacity-60">
                {library[type].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {hasAnyLibraryItems ? (
        <div className={`flex flex-col gap-3 rounded-[28px] p-4 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between ${isDarkTheme ? "border border-white/10 bg-black/20" : "border border-white/50 bg-[linear-gradient(135deg,rgba(247,255,250,0.94),rgba(232,248,239,0.82))]"}`}>
          <Input
            value={searchValues[activeType]}
            onChange={(event) =>
              setSearchValues((current) => ({
                ...current,
                [activeType]: event.target.value,
              }))
            }
            placeholder={t("groups.searchPlaceholder", {
              type: CONFIG_TYPE_LABELS[activeType],
            })}
            className="h-11 max-w-md text-[14px]"
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const nextSelectionState = {
                ...selection,
                [activeType]: library[activeType].map((item) => item.name),
              };
              setSelection(nextSelectionState);
              void persistSelectionDraft(nextSelectionState);
            }}
          >
            {t("common.actions.quickEnable")}
          </Button>
        </div>
      ) : null}

      {!hasAnyLibraryItems ? (
        <div className={`rounded-[30px] px-6 py-14 text-center shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-emerald-200/70 bg-[linear-gradient(135deg,rgba(247,255,250,0.95),rgba(233,249,240,0.82))]"}`}>
          <h3 className="text-lg font-semibold text-foreground">{t("groups.emptyLibraryTitle")}</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("groups.emptyLibraryDescription")}
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Button asChild>
              <Link to="/library">{t("groups.goImport")}</Link>
            </Button>
          </div>
        </div>
      ) : null}

      {hasAnyLibraryItems ? (
        currentItems.length === 0 ? (
          <div className={`rounded-[30px] px-6 py-14 text-center shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-emerald-200/70 bg-[linear-gradient(135deg,rgba(247,255,250,0.95),rgba(233,249,240,0.82))]"}`}>
            <p className="text-[14px] font-medium text-foreground">
              {t("groups.noItems", { type: CONFIG_TYPE_LABELS[activeType] })}
            </p>
            <p className="mt-2 text-[14px] text-muted-foreground">
              {t("groups.importBackHint")}
            </p>
            <Button asChild className="mt-4">
              <Link to="/library">{t("groups.goImport")}</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {currentItems.map((item) => {
              const isSelected = selection[activeType].includes(item.name);
              return (
                <div
                  key={item.name}
                  className={`flex h-full flex-col rounded-[28px] border px-6 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.12)] ${
                    isSelected
                      ? isDarkTheme
                        ? "border border-emerald-400/35 bg-[linear-gradient(135deg,rgba(24,44,39,0.98),rgba(22,58,48,0.94))] hover:border-emerald-300/50"
                        : "border border-emerald-300/80 bg-[linear-gradient(135deg,rgba(245,255,249,0.98),rgba(228,248,238,0.9))] hover:border-emerald-400/90"
                      : isDarkTheme
                        ? "border border-white/10 bg-[linear-gradient(135deg,rgba(24,30,42,0.96),rgba(28,36,50,0.92))] hover:border-primary/40"
                        : "border-white/50 bg-card/86 hover:border-primary/30"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-4">
                      <div
                        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] text-[22px] font-semibold ${getNameBadgeClassName(item.name)}`}
                      >
                        {getNameBadgeLabel(item.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-[15px] font-semibold tracking-[-0.02em] text-foreground">
                          {item.name}
                        </h3>
                        <p className="mt-2 line-clamp-3 max-w-xl text-[13px] leading-6 text-muted-foreground">
                          {item.description || item.path}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isSelected}
                      onCheckedChange={(checked) =>
                        handleToggleItem(activeType, item.name, checked)
                      }
                      aria-label={`${t("common.actions.edit")} ${item.name}`}
                    />
                  </div>

                  <div className="mt-auto pt-5">
                    <div className="h-px bg-border" />
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span className="font-semibold">{t("groups.forLabel")}</span>
                      <span className="normal-case text-[13px] italic tracking-normal text-muted-foreground line-clamp-1">
                        {isSelected
                          ? enabledToolNames || t("groups.currentToolsLabel")
                          : t("groups.disabledLabel")}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : null}
    </div>
  );
}
