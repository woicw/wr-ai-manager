import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowTopRightOnSquareIcon } from "@heroicons/react/24/outline";
import { invoke } from "@tauri-apps/api/core";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import {
  fetchMarketplaceSkills,
  installMarketplaceSkill,
  type MarketplaceSourceStatus,
  type MarketplaceSkill,
} from "@/lib/marketplace";
import type { LibraryItem } from "@/types";

type MarketplaceTab = "skills" | "mcp" | "plugins";

export function MarketplacePage() {
  const { t } = useTranslation();
  const isDarkTheme = useIsDarkTheme();
  const [activeTab, setActiveTab] = useState<MarketplaceTab>("skills");
  const [skills, setSkills] = useState<MarketplaceSkill[]>([]);
  const [sources, setSources] = useState<MarketplaceSourceStatus[]>([]);
  const [installedSkillNames, setInstalledSkillNames] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [installingSkillId, setInstallingSkillId] = useState<string | null>(null);
  const deferredQuery = useDeferredValue(query);

  useEffect(() => {
    const loadInstalledSkills = async () => {
      try {
        const items = await invoke<LibraryItem[]>("list_library_items", {
          configType: "skills",
        });
        setInstalledSkillNames(new Set(items.map((item) => item.name)));
      } catch (error) {
        console.error("Failed to load installed marketplace skills:", error);
      }
    };

    void loadInstalledSkills();
  }, []);

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const payload = await fetchMarketplaceSkills(deferredQuery);
        setSkills(payload.items);
        setSources(payload.sources);

        const hasAvailableSource = payload.sources.some((source) => source.ok);
        if (!hasAvailableSource && payload.items.length === 0) {
          const firstError = payload.sources.find((source) => source.error)?.error;
          toast({
            title: t("marketplace.errors.loadFailed"),
            description: firstError ?? t("marketplace.empty"),
            variant: "destructive",
          });
        }
      } catch (error) {
        console.error("Failed to fetch marketplace skills:", error);
        toast({
          title: t("marketplace.errors.loadFailed"),
          description: String(error),
          variant: "destructive",
        });
        setSkills([]);
        setSources([]);
      } finally {
        setLoading(false);
      }
    };

    void run();
  }, [deferredQuery, t]);

  const sourceNote = useMemo(() => {
    const failedSources = sources.filter((source) => !source.ok);
    if (failedSources.length === 0) {
      return t("marketplace.note");
    }

    return `${t("marketplace.note")} ${failedSources
      .map((source) =>
        t("marketplace.sourceUnavailable", { source: source.source }),
      )
      .join(" · ")}`;
  }, [sources, t]);

  const handleInstall = async (skill: MarketplaceSkill) => {
    setInstallingSkillId(skill.id);
    try {
      const result = await installMarketplaceSkill(skill);
      setInstalledSkillNames((current) => {
        const next = new Set(current);
        next.add(skill.installName);
        return next;
      });
      toast({
        title: result.alreadyInstalled
          ? t("marketplace.toast.alreadyInstalledTitle")
          : t("marketplace.toast.installSuccessTitle"),
        description: result.alreadyInstalled
          ? t("marketplace.toast.alreadyInstalledDescription", {
              name: skill.name,
              group: result.groupId,
            })
          : t("marketplace.toast.installSuccessDescription", {
              name: skill.name,
              group: result.groupId,
            }),
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to install marketplace skill:", error);
      toast({
        title: t("marketplace.toast.installFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setInstallingSkillId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <section
        className={`rounded-[32px] px-6 py-5 backdrop-blur-xl ${
          isDarkTheme
            ? "border border-white/10 bg-[linear-gradient(135deg,rgba(72,46,25,0.98),rgba(94,60,30,0.92)_40%,rgba(28,57,78,0.9))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
            : "border border-white/50 bg-[linear-gradient(135deg,rgba(255,250,240,0.98),rgba(255,236,214,0.86)_34%,rgba(228,245,255,0.76))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        }`}
      >
        <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground">
          {t("marketplace.title")}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          {t("marketplace.subtitle")}
        </p>
      </section>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as MarketplaceTab)}>
        <TabsList className={`grid h-auto grid-cols-3 rounded-[22px] p-1 shadow-[0_12px_32px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-white/10 bg-black/20" : "border border-white/45 bg-[linear-gradient(135deg,rgba(255,243,224,0.9),rgba(231,245,255,0.72))]"}`}>
          <TabsTrigger value="skills">{t("marketplace.tabs.skills")}</TabsTrigger>
          <TabsTrigger value="mcp" disabled>
            {t("marketplace.tabs.mcp")}
          </TabsTrigger>
          <TabsTrigger value="plugins" disabled>
            {t("marketplace.tabs.plugins")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="skills" className="space-y-4">
          <div className={`flex flex-col gap-3 rounded-[28px] p-4 shadow-[0_18px_44px_rgba(15,23,42,0.06)] backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between ${isDarkTheme ? "border border-white/10 bg-black/20" : "border border-white/50 bg-[linear-gradient(135deg,rgba(255,249,240,0.95),rgba(233,246,255,0.82))]"}`}>
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("marketplace.searchPlaceholder")}
              className="h-10 max-w-md"
            />
            <div className="text-xs text-muted-foreground">{sourceNote}</div>
          </div>

          {loading ? (
            <div className={`rounded-[30px] px-6 py-14 text-center text-sm text-muted-foreground shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-sky-200/70 bg-[linear-gradient(135deg,rgba(255,249,240,0.95),rgba(233,246,255,0.82))]"}`}>
              {t("marketplace.loading")}
            </div>
          ) : skills.length === 0 ? (
            <div className={`rounded-[30px] px-6 py-14 text-center text-sm text-muted-foreground shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-sky-200/70 bg-[linear-gradient(135deg,rgba(255,249,240,0.95),rgba(233,246,255,0.82))]"}`}>
              {t("marketplace.empty")}
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {skills.map((skill) => (
                <div
                  key={skill.id}
                  className={`rounded-[28px] px-6 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.12)] ${isDarkTheme ? "border border-white/10 bg-[linear-gradient(135deg,rgba(28,24,23,0.94),rgba(32,29,25,0.9)_44%,rgba(18,34,44,0.88))] hover:border-primary/40" : "border border-white/50 bg-[linear-gradient(135deg,rgba(255,255,255,0.95),rgba(255,247,238,0.88)_45%,rgba(237,248,255,0.82))] hover:border-primary/30"}`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">
                          {skill.name}
                        </h3>
                        <span className="rounded-full border border-slate-900/10 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-white shadow-[0_8px_18px_rgba(15,23,42,0.14)] dark:border-white/12 dark:bg-white dark:text-slate-950 dark:shadow-[0_8px_18px_rgba(2,6,23,0.18)]">
                          {skill.badge === "official" ? t("marketplace.official") : skill.badge}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-3 text-[14px] leading-7 text-muted-foreground">
                        {skill.description}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 h-px bg-border" />

                  <div className="mt-5 flex flex-col gap-3">
                    <div className="min-w-0 text-[12px] uppercase tracking-[0.12em] text-muted-foreground">
                      <span className="font-semibold">{t("marketplace.sourceLabel")}</span>
                      <span className="ml-2 inline-block max-w-full break-all normal-case text-[14px] tracking-normal">
                        {skill.source}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant={
                          installedSkillNames.has(skill.installName)
                            ? "outline"
                            : "success"
                        }
                        className="h-10 min-w-[132px] rounded-2xl px-4 text-[14px] font-semibold"
                        disabled={
                          installingSkillId === skill.id ||
                          installedSkillNames.has(skill.installName)
                        }
                        onClick={() => void handleInstall(skill)}
                      >
                        {installedSkillNames.has(skill.installName)
                          ? t("marketplace.installed")
                          : installingSkillId === skill.id
                          ? t("marketplace.installing")
                          : t("marketplace.install")}
                      </Button>
                      <Button
                        asChild
                        variant="outline"
                        className="h-10 min-w-[172px] rounded-2xl bg-background px-4 text-[14px] font-semibold"
                      >
                        <a href={skill.repoUrl} target="_blank" rel="noreferrer">
                          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                          {skill.origin === "github"
                            ? t("marketplace.openSource")
                            : t("common.actions.open")}
                        </a>
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mcp">
          <div className={`rounded-[30px] px-6 py-14 text-center shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-sky-200/70 bg-[linear-gradient(135deg,rgba(255,249,240,0.95),rgba(233,246,255,0.82))]"}`}>
            <h3 className="text-lg font-semibold text-foreground">
              {t("marketplace.disabled.title", {
                type: t("marketplace.tabs.mcp"),
              })}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("marketplace.disabled.description")}
            </p>
          </div>
        </TabsContent>

        <TabsContent value="plugins">
          <div className={`rounded-[30px] px-6 py-14 text-center shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-dashed border-white/10 bg-black/20" : "border border-dashed border-sky-200/70 bg-[linear-gradient(135deg,rgba(255,249,240,0.95),rgba(233,246,255,0.82))]"}`}>
            <h3 className="text-lg font-semibold text-foreground">
              {t("marketplace.disabled.title", {
                type: t("marketplace.tabs.plugins"),
              })}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("marketplace.disabled.description")}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
