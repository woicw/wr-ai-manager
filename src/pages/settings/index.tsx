import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SyncDialog } from "../../components/sync-dialog";
import { useSettingsStore, useThemeStore } from "../../stores";
import { toast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import {
  SunIcon,
  MoonIcon,
  ComputerDesktopIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function SettingsPage() {
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [githubSyncing, setGithubSyncing] = useState(false);
  const [systemDark, setSystemDark] = useState(false);
  const { t } = useTranslation();

  const theme = useThemeStore((state) => state.theme);
  const setTheme = useThemeStore((state) => state.setTheme);
  const locale = useSettingsStore((state) => state.locale);
  const setLocale = useSettingsStore((state) => state.setLocale);
  const defaultEditor = useSettingsStore((state) => state.defaultEditor);
  const setDefaultEditor = useSettingsStore((state) => state.setDefaultEditor);
  const repoUrl = useSettingsStore((state) => state.githubRepoUrl);
  const setRepoUrl = useSettingsStore((state) => state.setGithubRepoUrl);
  const useRelativePath = useSettingsStore(
    (state) => state.githubUseRelativePath,
  );
  const setUseRelativePath = useSettingsStore(
    (state) => state.setGithubUseRelativePath,
  );
  const relativePath = useSettingsStore((state) => state.githubRelativePath);
  const setRelativePath = useSettingsStore(
    (state) => state.setGithubRelativePath,
  );
  const [editorOptions, setEditorOptions] = useState<
    { id: string; label: string }[]
  >([]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setSystemDark(mediaQuery.matches);
    update();
    mediaQuery.addEventListener("change", update);

    return () => mediaQuery.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    const loadApps = async () => {
      try {
        const apps = await invoke<{ id: string; label: string }[]>(
          "detect_available_apps",
        );
        setEditorOptions(apps);

        if (apps.length === 0) return;

        const hasCurrent = apps.some((app) => app.id === defaultEditor);
        if (!hasCurrent) {
          setDefaultEditor(apps[0].id);
        }
      } catch (error) {
        console.error("Failed to load available apps:", error);
      }
    };

    void loadApps();
  }, [defaultEditor, setDefaultEditor]);

  const handleGithubSync = async () => {
    if (!repoUrl.trim()) return;

    setGithubSyncing(true);
    try {
      await invoke("sync_github_repo_to_library", {
        request: {
          repoUrl: repoUrl.trim(),
          relativePath: useRelativePath ? relativePath.trim() : "",
        },
      });
      toast({
        title: t("settings.toast.githubSyncSuccessTitle"),
        description: t("settings.toast.githubSyncSuccessDescription"),
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to sync from GitHub:", error);
      toast({
        title: t("settings.toast.githubSyncFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setGithubSyncing(false);
    }
  };

  const isDarkTheme = theme === "dark" || (theme === "system" && systemDark);
  const settingCardBaseClassName =
    "rounded-[28px] border p-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.12)]";
  const appearanceCardClassName = `${settingCardBaseClassName} ${
    isDarkTheme
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(23,31,46,0.96),rgba(28,38,58,0.92))] shadow-[0_24px_54px_rgba(0,0,0,0.28)]"
      : "border-white/50 bg-[linear-gradient(135deg,rgba(245,248,255,0.98),rgba(232,240,255,0.84))]"
  }`;
  const editorCardClassName = `${settingCardBaseClassName} ${
    isDarkTheme
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(20,34,33,0.96),rgba(24,43,40,0.92))] shadow-[0_24px_54px_rgba(0,0,0,0.28)]"
      : "border-white/50 bg-[linear-gradient(135deg,rgba(247,255,251,0.98),rgba(227,246,237,0.84))]"
  }`;
  const syncCardClassName = `${settingCardBaseClassName} ${
    isDarkTheme
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(36,29,24,0.96),rgba(49,36,30,0.92))] shadow-[0_24px_54px_rgba(0,0,0,0.28)]"
      : "border-white/50 bg-[linear-gradient(135deg,rgba(255,249,241,0.98),rgba(255,236,221,0.84))]"
  }`;
  const aboutCardClassName = `${settingCardBaseClassName} ${
    isDarkTheme
      ? "border-white/10 bg-[linear-gradient(135deg,rgba(30,24,43,0.96),rgba(39,30,56,0.92))] shadow-[0_24px_54px_rgba(0,0,0,0.28)]"
      : "border-white/50 bg-[linear-gradient(135deg,rgba(250,245,255,0.98),rgba(241,232,255,0.84))]"
  }`;
  const heroClassName = isDarkTheme
    ? "rounded-[32px] border border-white/10 bg-[linear-gradient(135deg,rgba(29,29,44,0.98),rgba(38,33,58,0.94)_42%,rgba(46,31,34,0.9))] px-6 py-5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] backdrop-blur-xl"
    : "rounded-[32px] border border-white/50 bg-[linear-gradient(135deg,rgba(244,246,255,0.98),rgba(233,228,255,0.86)_34%,rgba(255,236,226,0.78))] px-6 py-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-xl";
  const tabsListClassName = isDarkTheme
    ? "h-auto w-full bg-black/20 p-1"
    : "h-auto w-full bg-white/60 p-1";
  const selectTriggerClassName = isDarkTheme
    ? "mt-5 h-11 w-full rounded-2xl border-border bg-black/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
    : "mt-5 h-11 w-full rounded-2xl border-border bg-secondary/90 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)]";
  const checkboxCardClassName = isDarkTheme
    ? "flex cursor-pointer items-center gap-3 rounded-[24px] bg-black/20 px-4 py-4 transition-colors hover:bg-black/28"
    : "flex cursor-pointer items-center gap-3 rounded-[24px] bg-white/58 px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] transition-colors hover:bg-white/78";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
      <section className={heroClassName}>
        <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground">
          {t("settings.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-7 text-muted-foreground">
          {t("settings.description")}
        </p>
      </section>

      <section>
        <h3 className="mb-4 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.sections.appearance")}
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={appearanceCardClassName}>
            <div>
              <div className="text-[15px] font-semibold text-foreground">
                {t("settings.theme.title")}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("settings.theme.description")}
              </div>
            </div>
            <Tabs
              value={theme}
              onValueChange={(value) => setTheme(value as typeof theme)}
              className="mt-5"
            >
              <TabsList className={tabsListClassName}>
                <TabsTrigger value="light" className="gap-1.5 text-sm">
                  <SunIcon className="h-3.5 w-3.5" />
                  {t("settings.theme.light")}
                </TabsTrigger>
                <TabsTrigger value="dark" className="gap-1.5 text-sm">
                  <MoonIcon className="h-3.5 w-3.5" />
                  {t("settings.theme.dark")}
                </TabsTrigger>
                <TabsTrigger value="system" className="gap-1.5 text-sm">
                  <ComputerDesktopIcon className="h-3.5 w-3.5" />
                  {t("settings.theme.system")}
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
          <div className={appearanceCardClassName}>
            <div>
              <div className="text-[15px] font-semibold text-foreground">
                {t("settings.language.title")}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("settings.language.description")}
              </div>
            </div>
            <Select
              value={locale}
              onValueChange={(value) => setLocale(value as "zh-CN" | "en-US")}
            >
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="zh-CN">
                  {t("settings.language.zhCN")}
                </SelectItem>
                <SelectItem value="en-US">
                  {t("settings.language.enUS")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className={editorCardClassName}>
            <div>
              <div className="text-[15px] font-semibold text-foreground">
                {t("settings.editor.title")}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("settings.editor.description")}
              </div>
            </div>
            <Select
              value={defaultEditor}
              onValueChange={(value) => setDefaultEditor(value)}
              disabled={editorOptions.length === 0}
            >
              <SelectTrigger className={selectTriggerClassName}>
                <SelectValue placeholder={t("settings.editor.placeholder")} />
              </SelectTrigger>
              <SelectContent>
                {editorOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.sections.sync")}
        </h3>
        <div className="grid gap-4">
          <div className={syncCardClassName}>
            <div>
              <div className="text-[15px] font-semibold text-foreground">
                {t("settings.syncCards.toolsTitle")}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("settings.syncCards.toolsDescription")}
              </div>
            </div>
            <Button
              onClick={() => setSyncDialogOpen(true)}
              size="sm"
              className="mt-5"
            >
              {t("common.actions.sync")}
            </Button>
          </div>
          <div className={`${syncCardClassName} space-y-5`}>
            <div>
              <div className="text-[15px] font-semibold text-foreground">
                {t("settings.syncCards.githubTitle")}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                {t("settings.syncCards.githubDescription")}
              </div>
            </div>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("settings.syncCards.repoUrl")}
              </div>
              <Input
                value={repoUrl}
                onChange={(event) => setRepoUrl(event.target.value)}
                placeholder={t("settings.syncCards.repoUrlPlaceholder")}
              />
            </div>
            <label className={checkboxCardClassName}>
              <Checkbox
                checked={useRelativePath}
                onCheckedChange={(checked) =>
                  setUseRelativePath(Boolean(checked))
                }
              />
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {t("settings.syncCards.useRelativePath")}
                </div>
                <div className="mt-1 text-sm leading-6 text-muted-foreground">
                  {t("settings.syncCards.useRelativePathDescription")}
                </div>
              </div>
            </label>
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {t("settings.syncCards.relativePath")}
              </div>
              <Input
                value={relativePath}
                onChange={(event) => setRelativePath(event.target.value)}
                placeholder={t("settings.syncCards.relativePathPlaceholder")}
                disabled={!useRelativePath}
              />
            </div>
            <div className="flex justify-end">
              <Button
                onClick={handleGithubSync}
                disabled={
                  githubSyncing ||
                  !repoUrl.trim() ||
                  (useRelativePath && !relativePath.trim())
                }
                size="sm"
              >
                {githubSyncing
                  ? t("common.status.syncing")
                  : t("common.actions.sync")}
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section>
        <h3 className="mb-4 px-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          {t("settings.sections.about")}
        </h3>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className={aboutCardClassName}>
            <div className="text-sm font-medium text-foreground">
              {t("settings.about.version")}
            </div>
            <div className="mt-3 text-lg font-semibold tracking-[-0.02em] text-foreground">
              0.1.1
            </div>
          </div>
          <div className={aboutCardClassName}>
            <div className="text-sm font-medium text-foreground">
              {t("settings.about.configDir")}
            </div>
            <div className="mt-3 text-sm leading-7 text-muted-foreground">
              ~/.wr-ai-manager
            </div>
          </div>
        </div>
      </section>

      <SyncDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
      />
    </div>
  );
}
