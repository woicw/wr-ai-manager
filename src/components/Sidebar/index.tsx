import {
  Cog6ToothIcon,
  RectangleStackIcon,
  SparklesIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import { invoke } from "@tauri-apps/api/core";
import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router";
import { useTranslation } from "react-i18next";

import { ConfigGroupSection } from "./config-group-section";
import { useAppStore, useConfigStore } from "@/stores";
import { toast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import { cn } from "@/lib/utils";
import type { ApplyResult, ConfigGroup } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const EMPTY_GROUPS: string[] = [];

export function Sidebar() {
  const location = useLocation();
  const { t } = useTranslation();
  const isDarkTheme = useIsDarkTheme();
  const config = useConfigStore((state) => state.config);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const libraryVersion = useAppStore((state) => state.libraryVersion);
  const activeGroup = config?.activeGroup ?? "";
  const groups = config?.groups ?? EMPTY_GROUPS;
  const groupsKey = useMemo(() => groups.join("|"), [groups]);
  const [switchingGroup, setSwitchingGroup] = useState(false);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const [hasLibraryConfigs, setHasLibraryConfigs] = useState(false);
  const navigationItems = [
    {
      label: t("sidebar.nav.library"),
      icon: SparklesIcon,
      to: "/library",
      enabled: true,
    },
    {
      label: t("sidebar.nav.tools"),
      icon: WrenchScrewdriverIcon,
      to: "/tools",
      enabled: true,
    },
    {
      label: t("sidebar.nav.marketplace"),
      icon: RectangleStackIcon,
      to: "/marketplace",
      enabled: true,
    },
    {
      label: t("sidebar.nav.settings"),
      icon: Cog6ToothIcon,
      to: "/settings",
      enabled: true,
    },
  ];

  const handleQuickApply = async (nextGroupId: string) => {
    if (!config || nextGroupId === activeGroup) return;
    const hasAppliedGroup = Object.values(config.activations ?? {}).some(
      (activation) => activation,
    );

    if (!hasAppliedGroup && !hasLibraryConfigs) {
      toast({
        title: t("sidebar.quickApply.noBaseGroupTitle"),
        description: t("sidebar.quickApply.noBaseGroupDescription"),
        variant: "destructive",
      });
      return;
    }

    const enabledToolIds = Object.entries(config.aiTools)
      .filter(([, tool]) => tool.enabled)
      .map(([toolId]) => toolId);

    if (enabledToolIds.length === 0) {
      toast({
        title: t("sidebar.quickApply.noEnabledToolsTitle"),
        description: t("sidebar.quickApply.noEnabledToolsDescription"),
        variant: "destructive",
      });
      return;
    }

    setSwitchingGroup(true);
    try {
      let usedFallbackCopy = false;
      const rawGroup = await invoke<unknown>("load_config_group", {
        groupId: nextGroupId,
      });
      const selection = ((rawGroup as Record<string, unknown>)?.selection ??
        {}) as Record<string, { enabled?: boolean }>;
      const applicableToolIds = enabledToolIds.filter((toolId) => {
        const toolSelection = selection[toolId];
        return toolSelection?.enabled !== false;
      });

      if (applicableToolIds.length === 0) {
        toast({
          title: t("sidebar.quickApply.noSavedSelectionTitle"),
          description: t("sidebar.quickApply.noSavedSelectionDescription", {
            groupId: nextGroupId,
          }),
          variant: "destructive",
        });
        return;
      }

      for (const toolId of applicableToolIds) {
        const result = await invoke<ApplyResult>("apply_config_group", {
          groupId: nextGroupId,
          toolId,
          force: true,
        });
        usedFallbackCopy ||= Boolean(
          result.usedFallbackCopy ?? result.used_fallback_copy,
        );
      }

      await loadConfig();
      toast({
        title: t("sidebar.quickApply.successTitle"),
        description: t("sidebar.quickApply.successDescription", {
          groupId: nextGroupId,
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
      console.error("Failed to quick apply group:", error);
      toast({
        title: t("sidebar.quickApply.failedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setSwitchingGroup(false);
    }
  };

  useEffect(() => {
    const loadLibraryStatus = async () => {
      try {
        const [skills, mcp, commands] = await Promise.all([
          invoke<unknown[]>("list_library_items", { configType: "skills" }),
          invoke<unknown[]>("list_library_items", { configType: "mcp" }),
          invoke<unknown[]>("list_library_items", { configType: "commands" }),
        ]);

        setHasLibraryConfigs(
          skills.length > 0 || mcp.length > 0 || commands.length > 0,
        );
      } catch {
        setHasLibraryConfigs(false);
      }
    };

    void loadLibraryStatus();
  }, [groupsKey, config?.activeGroup, libraryVersion]);

  useEffect(() => {
    const loadGroupNames = async () => {
      if (!groups.length) {
        setGroupNames((current) =>
          Object.keys(current).length === 0 ? current : {},
        );
        return;
      }

      try {
        const loadedGroups = await Promise.all(
          groups.map((groupId) =>
            invoke<ConfigGroup>("load_config_group", { groupId }).catch(() => ({
              id: groupId,
              name: groupId,
            })),
          ),
        );

        const nextGroupNames = Object.fromEntries(
          loadedGroups.map((group) => [group.id, group.name || group.id]),
        );

        setGroupNames((current) => {
          const currentKeys = Object.keys(current);
          const nextKeys = Object.keys(nextGroupNames);

          if (
            currentKeys.length === nextKeys.length &&
            nextKeys.every((key) => current[key] === nextGroupNames[key])
          ) {
            return current;
          }

          return nextGroupNames;
        });
      } catch {
        setGroupNames({});
      }
    };

    void loadGroupNames();
  }, [groupsKey]);

  const hasAppliedGroup = Boolean(
    config &&
      Object.values(config.activations ?? {}).some((activation) => activation),
  );
  const quickSwitchDisabled =
    switchingGroup || !config || (!hasAppliedGroup && !hasLibraryConfigs);
  const activeGroupName = activeGroup
    ? groupNames[activeGroup] ?? activeGroup
    : "";
  const activeGroupDisplayName = hasAppliedGroup
    ? activeGroupName
    : t("sidebar.noActiveGroup");
  const activeGroupCardClassName = isDarkTheme
    ? "rounded-[20px] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_34%),linear-gradient(135deg,rgba(52,63,74,0.94),rgba(39,48,60,0.92))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.04),0_12px_24px_rgba(15,23,42,0.18)]"
    : "rounded-[20px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,rgba(45,212,191,0.12),transparent_34%),linear-gradient(135deg,rgba(249,251,255,0.98),rgba(239,244,250,0.94))] px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.78),0_10px_22px_rgba(15,23,42,0.06)]";
  const activeGroupEyebrowClassName = isDarkTheme
    ? "flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-200/80"
    : "flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-teal-700/85";
  const activeGroupNameClassName = isDarkTheme
    ? "truncate text-[22px] font-semibold tracking-[-0.05em] text-white"
    : "truncate text-[22px] font-semibold tracking-[-0.05em] text-slate-950";
  const activeGroupMetaClassName = isDarkTheme
    ? "mt-0.5 text-[11px] font-medium text-white/62"
    : "mt-0.5 text-[11px] font-medium text-slate-600";
  const activeGroupBadgeClassName = isDarkTheme
    ? "rounded-full border border-teal-300/14 bg-teal-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-100"
    : "rounded-full border border-teal-200/80 bg-white/85 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-teal-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.66)]";
  const activeGroupSelectLabelClassName = isDarkTheme
    ? "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/48"
    : "mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500";
  const activeGroupSelectTriggerClassName = isDarkTheme
    ? "h-10 rounded-2xl border-white/12 bg-black/18 text-[13px] font-semibold text-white"
    : "h-10 rounded-2xl border-slate-200/90 bg-white/92 text-[13px] font-semibold text-slate-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]";
  const activeGroupTitleRowClassName = isDarkTheme
    ? "mt-2 rounded-[18px] border border-teal-300/10 bg-teal-400/6 p-3"
    : "mt-2 rounded-[18px] border border-teal-100 bg-teal-50/80 p-3";
  const activeGroupIndicatorClassName = isDarkTheme
    ? "absolute left-0 top-0 h-full w-1 rounded-full bg-teal-300/90"
    : "absolute left-0 top-0 h-full w-1 rounded-full bg-teal-500";

  return (
    <aside className="mr-3 flex w-[294px] shrink-0 flex-col rounded-[32px] border border-white/45 bg-card/72 shadow-[0_20px_60px_rgba(15,23,42,0.1)] backdrop-blur-xl">
      <div className="px-6 pb-3 pt-7">
        <div className="flex items-center gap-3">
          <img
            src="/wr-logo.svg"
            alt="WR AI Manager"
            className="h-9 w-9 rounded-xl"
          />
          <h1 className="text-[18px] font-semibold tracking-[-0.03em] text-foreground">
            WR-AI-Manager
          </h1>
        </div>
        <div className="mt-2.5">
          <div className={activeGroupCardClassName}>
            <div className={activeGroupEyebrowClassName}>
              <span className="relative inline-flex h-2.5 w-2.5 shrink-0 rounded-full bg-teal-400 shadow-[0_0_0_4px_rgba(45,212,191,0.1)] dark:shadow-[0_0_0_4px_rgba(45,212,191,0.08)]" />
              <span>{t("common.labels.currentAppliedGroup")}</span>
            </div>
            <div className={activeGroupTitleRowClassName}>
              <div className="relative flex items-end justify-between gap-3 pl-3">
                <span className={activeGroupIndicatorClassName} />
                <div className="min-w-0 flex-1">
                  <div className={activeGroupNameClassName}>
                    {activeGroupDisplayName}
                  </div>
                  <div className={activeGroupMetaClassName}>
                    {hasAppliedGroup
                      ? t("sidebar.activeNow")
                      : t("sidebar.noActiveGroupHint")}
                  </div>
                </div>
                {hasAppliedGroup ? (
                  <div className={activeGroupBadgeClassName}>
                    {t("sidebar.live")}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="mt-3 pt-1.5">
              <div className={activeGroupSelectLabelClassName}>
                {t("sidebar.selectGroupPlaceholder")}
              </div>
              <Select
                value={activeGroup || undefined}
                onValueChange={(value) => {
                  void handleQuickApply(value);
                }}
                disabled={quickSwitchDisabled}
              >
                <SelectTrigger className={activeGroupSelectTriggerClassName}>
                  <SelectValue
                    placeholder={t("sidebar.selectGroupPlaceholder")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {groups.map((groupId) => (
                    <SelectItem key={groupId} value={groupId}>
                      {groupNames[groupId] ?? groupId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-5 overflow-auto px-4 py-4">
        <div className="space-y-2">
          {navigationItems.map(({ enabled, icon: Icon, label, to }) => {
            const isActive =
              enabled &&
              (to === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(to));
            const itemClassName = cn(
              "relative flex items-center gap-4 rounded-[22px] px-4 py-3.5 text-[15px] font-medium transition-all outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/35 focus-visible:ring-offset-0",
              isActive
                ? "border border-white/65 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(242,246,251,0.84))] text-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.88),0_12px_28px_rgba(15,23,42,0.09)] dark:border-white/12 dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_12px_28px_rgba(2,6,23,0.22)]"
                : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground",
              !enabled &&
                "cursor-default opacity-90 hover:bg-transparent hover:text-muted-foreground",
            );

            const content = (
              <>
                <Icon className="h-5 w-5" />
                <span>{label}</span>
              </>
            );

            if (!enabled) {
              return (
                <div key={label} className={itemClassName}>
                  {content}
                </div>
              );
            }

            return (
              <Link key={label} to={to} className={itemClassName}>
                {content}
              </Link>
            );
          })}
        </div>

        <div className="rounded-[28px] border border-white/45 bg-secondary/70 px-3 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]">
          <ConfigGroupSection />
        </div>
      </nav>
    </aside>
  );
}
