import { useEffect, useState } from "react";
import { Link, useParams } from "react-router";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import {
  ArrowLeftIcon,
  FolderIcon,
  CheckBadgeIcon,
} from "@heroicons/react/24/outline";

import type { AITool, GlobalConfig } from "@/types";
import {
  getToolPaths,
  normalizeGlobalConfig,
  normalizeToolDetection,
  serializeGlobalConfig,
  type ToolDetection,
} from "@/lib/ai-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import { getNameBadgeClassName, getNameBadgeLabel } from "@/lib/name-badge";

const TOOL_PATH_LABELS: Record<string, string> = {
  skills: "common.labels.skillsPath",
  mcp: "common.labels.mcpPath",
  commands: "common.labels.commandPath",
};

export function AIToolConfigPage() {
  const { t } = useTranslation();
  const isDarkTheme = useIsDarkTheme();
  const { toolId } = useParams<{ toolId: string }>();
  const [config, setConfig] = useState<GlobalConfig | null>(null);
  const [detectedTools, setDetectedTools] = useState<ToolDetection[]>([]);
  const [tool, setTool] = useState<AITool | null>(null);
  const [pathMappings, setPathMappings] = useState<Record<string, string>>({});
  const [configPath, setConfigPath] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const loadToolConfig = async () => {
    if (!toolId) return;

    setLoading(true);
    try {
      const [globalConfig, detected] = await Promise.all([
        invoke<unknown>("load_global_config"),
        invoke<unknown[]>("detect_ai_tools"),
      ]);
      const normalizedConfig = normalizeGlobalConfig(
        globalConfig as Record<string, unknown>,
      );
      const normalizedDetected = detected.map((item) =>
        normalizeToolDetection(item as Record<string, unknown>),
      );
      const currentTool = normalizedConfig.aiTools[toolId] ?? null;
      const nextPaths = currentTool?.pathMappings ?? {};
      const detectedTool =
        normalizedDetected.find((item) => item.id === toolId) ?? null;

      setConfig(normalizedConfig);
      setDetectedTools(normalizedDetected);
      setTool(currentTool);
      setPathMappings(nextPaths);
      setConfigPath(getToolPaths(toolId, currentTool, detectedTool).configPath);
    } catch (error) {
      console.error("Failed to load tool config:", error);
      toast({
        title: t("toolDetail.toast.loadFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadToolConfig();
  }, [toolId]);

  const handleSave = async () => {
    if (!config || !tool || !toolId) return;

    setSaving(true);
    try {
      const normalizedPathMappings = Object.fromEntries(
        Object.entries(pathMappings).map(([configType, path]) => {
          if (!path) {
            return [configType, path];
          }

          const detectedTool =
            detectedTools.find((item) => item.id === toolId) ?? null;
          const currentRoot = getToolPaths(
            toolId,
            { ...tool, pathMappings },
            detectedTool,
          ).configPath;
          if (!currentRoot || !path.startsWith(`${currentRoot}/`)) {
            return [configType, path];
          }

          return [configType, path.replace(currentRoot, configPath)];
        }),
      );
      normalizedPathMappings.config = configPath;

      await invoke("save_global_config", {
        config: serializeGlobalConfig({
          ...config,
          aiTools: {
            ...config.aiTools,
            [toolId]: {
              ...tool,
              pathMappings: normalizedPathMappings,
            },
          },
        }),
      });
      await loadToolConfig();
      toast({
        title: t("toolDetail.toast.saveSuccessTitle"),
        description: t("toolDetail.toast.saveSuccessDescription", {
          toolName: tool.name,
        }),
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to save tool config:", error);
      toast({
        title: t("toolDetail.toast.saveFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("common.actions.loading")}</div>
      </div>
    );
  }

  if (!toolId || !tool) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="text-sm text-muted-foreground">{t("common.empty.toolNotFound")}</div>
      </div>
    );
  }
  return (
    <div className="px-6 py-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section
          className={`flex items-center justify-between gap-4 rounded-[32px] px-6 py-5 backdrop-blur-xl ${
            isDarkTheme
              ? "border border-white/10 bg-[linear-gradient(135deg,rgba(34,42,68,0.98),rgba(28,51,84,0.92)_46%,rgba(22,55,64,0.88))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
              : "border border-white/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(245,248,253,0.78))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
          }`}
        >
          <div className="space-y-3">
            <Link
              to="/tools"
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeftIcon className="h-4 w-4" />
              {t("toolDetail.backToTools")}
            </Link>
            <div className="flex items-center gap-4">
              <div
                className={`flex h-16 w-16 items-center justify-center rounded-2xl text-4xl font-semibold ${getNameBadgeClassName(tool.name)}`}
              >
                {getNameBadgeLabel(tool.name)}
              </div>
              <div>
                <div className="flex items-center gap-3">
                  <h1 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground">
                    {tool.name}
                  </h1>
                  <span className="rounded-2xl border border-border/80 bg-secondary/70 px-3 py-1 text-sm font-medium text-muted-foreground">
                    ID: {toolId}
                  </span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  {t("toolDetail.manageDescription")}
                </p>
              </div>
            </div>
          </div>

          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-2xl px-5 py-3"
          >
            {saving ? t("common.status.saving") : t("toolDetail.saveChanges")}
          </Button>
        </section>

        <section className={`rounded-[30px] p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl ${isDarkTheme ? "border border-white/10 bg-[linear-gradient(135deg,rgba(23,28,38,0.96),rgba(27,33,45,0.92))]" : "border border-white/50 bg-card/86"}`}>
          <div className="flex items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 text-[15px] font-semibold text-foreground">
                <CheckBadgeIcon className="h-5 w-5 text-muted-foreground" />
                {t("toolDetail.enableTool")}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {t("toolDetail.enableToolDescription")}
              </p>
            </div>

            <Switch
              checked={tool.enabled}
              onCheckedChange={(checked) =>
                setTool((current) =>
                  current ? { ...current, enabled: checked } : current,
                )
              }
              aria-label="Toggle tool enabled"
            />
          </div>
        </section>

        <section className={`rounded-[30px] p-8 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl ${isDarkTheme ? "border border-white/10 bg-[linear-gradient(135deg,rgba(23,28,38,0.96),rgba(27,33,45,0.92))]" : "border border-white/50 bg-card/86"}`}>
          <div className="mb-6">
            <h2 className="text-xl font-semibold tracking-[-0.02em] text-foreground">
              {t("toolDetail.pathsTitle")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("toolDetail.pathsDescription")}
            </p>
          </div>

          <div className="space-y-5">
            <div className="grid gap-3">
              <label className="text-sm font-medium text-muted-foreground">
                {t("common.labels.configPath")}
              </label>
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/90 px-4 py-3">
                <FolderIcon className="h-5 w-5 text-muted-foreground" />
                <Input
                  value={configPath}
                  onChange={(event) => setConfigPath(event.target.value)}
                  className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                />
              </div>
            </div>

            {Object.entries(pathMappings).map(([configType, path]) => (
              <div key={configType} className="grid gap-3">
                <label className="text-sm font-medium capitalize text-muted-foreground">
                  {t(TOOL_PATH_LABELS[configType] ?? "common.labels.configPath")}
                </label>
                <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/90 px-4 py-3">
                  <FolderIcon className="h-5 w-5 text-muted-foreground" />
                  <Input
                    value={path}
                    onChange={(event) =>
                      setPathMappings((current) => ({
                        ...current,
                        [configType]: event.target.value,
                      }))
                    }
                    className="h-auto border-0 bg-transparent px-0 py-0 shadow-none focus-visible:ring-0"
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
