import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { ConfigType, LibraryItem } from "../../types";
import { SyncDialog } from "../../components/sync-dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { useIsDarkTheme } from "@/hooks/use-is-dark-theme";
import { getNameBadgeClassName, getNameBadgeLabel } from "@/lib/name-badge";
import { useSettingsStore } from "@/stores";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowPathIcon,
  CodeBracketIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const CONFIG_TYPES: ConfigType[] = ["skills", "mcp", "plugins", "commands"];

const CONFIG_TYPE_LABELS: Record<ConfigType, string> = {
  skills: "common.configTypes.skills",
  mcp: "common.configTypes.mcp",
  plugins: "common.configTypes.plugins",
  commands: "common.configTypes.commands",
};

interface AvailableApp {
  id: string;
  label: string;
}

export function LibraryPage() {
  const { t } = useTranslation();
  const isDarkTheme = useIsDarkTheme();
  const [activeType, setActiveType] = useState<ConfigType>("skills");
  const [items, setItems] = useState<Record<ConfigType, LibraryItem[]>>({
    skills: [],
    mcp: [],
    plugins: [],
    commands: [],
  });
  const [loading, setLoading] = useState(false);
  const [syncDialogOpen, setSyncDialogOpen] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [openOptions, setOpenOptions] = useState<AvailableApp[]>([]);
  const defaultEditor = useSettingsStore((state) => state.defaultEditor);
  const setDefaultEditor = useSettingsStore((state) => state.setDefaultEditor);

  const loadLibrary = async () => {
    setLoading(true);
    try {
      const results = await Promise.all([
        ...CONFIG_TYPES.map((type) =>
          invoke<LibraryItem[]>("list_library_items", { configType: type }),
        ),
      ]);
      setItems({
        skills: results[0],
        mcp: results[1],
        plugins: results[2],
        commands: results[3],
      });
    } catch (error) {
      console.error("Failed to load library:", error);
      toast({
        title: t("library.toast.loadFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadLibrary();

    invoke<AvailableApp[]>("detect_available_apps")
      .then((apps) => {
        setOpenOptions(apps);

        if (apps.length === 0) return;

        const hasCurrent = apps.some((option) => option.id === defaultEditor);
        if (!hasCurrent) {
          setDefaultEditor(apps[0].id);
        }
      })
      .catch(console.error);
  }, [defaultEditor, setDefaultEditor]);

  const handleDelete = async (configType: ConfigType, itemName: string) => {
    try {
      await invoke("delete_library_item", { configType, itemName });
      await loadLibrary();
    } catch (error) {
      console.error("Failed to delete library item:", error);
      toast({
        title: t("library.toast.deleteFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const resolveEditor = () => {
    if (openOptions.length === 0) return null;
    return (
      openOptions.find((option) => option.id === defaultEditor)?.id ??
      openOptions[0].id
    );
  };

  const handleEdit = async (configType: ConfigType, itemName: string) => {
    const application = resolveEditor();
    if (!application) {
      toast({
        title: t("library.toast.openFailedTitle"),
        description: t("common.errors.noEditorDetected"),
        variant: "destructive",
      });
      return;
    }

    try {
      await invoke("open_library_item_with", {
        configType,
        itemName,
        application,
      });
    } catch (error) {
      console.error("Failed to open library item:", error);
      toast({
        title: t("library.toast.openFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleOpenLibraryRoot = async () => {
    const application = resolveEditor();
    if (!application) {
      toast({
        title: t("library.toast.openFailedTitle"),
        description: t("common.errors.noEditorDetected"),
        variant: "destructive",
      });
      return;
    }

    try {
      await invoke("open_library_root_with", { application });
    } catch (error) {
      console.error("Failed to open library root:", error);
      toast({
        title: t("library.toast.openFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await Promise.all(
        CONFIG_TYPES.map((configType) =>
          invoke("clear_library_items", { configType }),
        ),
      );
      setClearDialogOpen(false);
      await loadLibrary();
      toast({
        title: t("library.toast.clearSuccessTitle"),
        description: t("library.toast.clearSuccessDescription"),
        variant: "success",
      });
    } catch (error) {
      console.error("Failed to clear library items:", error);
      toast({
        title: t("library.toast.clearFailedTitle"),
        description: String(error),
        variant: "destructive",
      });
    } finally {
      setClearing(false);
    }
  };

  const totalItems = CONFIG_TYPES.reduce(
    (sum, type) => sum + items[type].length,
    0,
  );
  const currentItems = items[activeType];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-6 py-6">
      <section
        className={`rounded-[32px] px-6 py-5 backdrop-blur-xl ${
          isDarkTheme
            ? "border border-white/10 bg-[linear-gradient(135deg,rgba(72,36,54,0.98),rgba(92,43,34,0.94)_48%,rgba(90,62,24,0.9))] shadow-[0_24px_70px_rgba(0,0,0,0.34)]"
            : "border border-rose-200/70 bg-[linear-gradient(135deg,rgba(255,247,249,0.98),rgba(255,238,232,0.88)_42%,rgba(255,245,214,0.82))] shadow-[0_20px_60px_rgba(15,23,42,0.08)]"
        }`}
      >
        <div className="flex items-start justify-between gap-6">
          <div>
            <h2 className="text-[30px] font-semibold tracking-[-0.04em] text-foreground">
              {t("library.title")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("common.labels.totalItems", { count: totalItems })}
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setSyncDialogOpen(true)}
              className="border border-black/15 bg-[linear-gradient(135deg,rgba(87,125,255,0.96),rgba(76,170,255,0.92))] shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_10px_22px_rgba(59,130,246,0.16)] hover:border-black/20 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_14px_26px_rgba(59,130,246,0.2)] dark:border-black/30"
            >
              {t("common.actions.sync")}
            </Button>
            <Button
              onClick={handleOpenLibraryRoot}
              variant="outline"
              disabled={openOptions.length === 0}
            >
              {t("library.add")}
            </Button>
            <Button
              onClick={() => setClearDialogOpen(true)}
              disabled={loading || totalItems === 0}
              variant="destructive"
            >
              {t("common.actions.clearAll")}
            </Button>
          </div>
        </div>
      </section>

      <Tabs
        value={activeType}
        onValueChange={(value) => setActiveType(value as ConfigType)}
      >
        <TabsList className={`grid h-auto grid-cols-4 rounded-[22px] p-1 shadow-[0_12px_32px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border border-white/10 bg-black/20" : "border border-white/45 bg-card/75"}`}>
          {CONFIG_TYPES.map((type) => (
            <TabsTrigger key={type} value={type}>
              {t(CONFIG_TYPE_LABELS[type])}
              <span className="ml-1.5 text-xs opacity-60">
                {items[type].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <ArrowPathIcon className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : currentItems.length === 0 ? (
        <div className={`rounded-[30px] border border-dashed px-6 py-14 text-center shadow-[0_18px_44px_rgba(15,23,42,0.06)] ${isDarkTheme ? "border-white/10 bg-black/20" : "border-border/80 bg-card/80"}`}>
          <p className="text-sm font-medium text-foreground">
            {t("library.noItems", { type: t(CONFIG_TYPE_LABELS[activeType]) })}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("library.importHint")}
          </p>
          <Button onClick={() => setSyncDialogOpen(true)} className="mt-4">
            {t("library.importNow")}
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {currentItems.map((item) => (
            <div
              key={item.name}
              className={`rounded-[28px] px-6 py-5 shadow-[0_18px_44px_rgba(15,23,42,0.08)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_24px_54px_rgba(15,23,42,0.12)] ${
                isDarkTheme
                  ? "border border-white/10 bg-[linear-gradient(135deg,rgba(23,28,38,0.96),rgba(27,33,45,0.92))] hover:border-primary/40"
                  : "border border-white/50 bg-card/86 hover:border-primary/30"
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
                    <h3 className="text-[16px] font-semibold tracking-[-0.02em] text-foreground">
                      {item.name}
                    </h3>
                    {activeType !== "mcp" && item.description ? (
                      <p className="mt-2 line-clamp-3 max-w-xl text-[14px] leading-7 text-muted-foreground">
                        {item.description}
                      </p>
                    ) : null}
                  </div>
                </div>
                <Button
                  onClick={() => handleDelete(activeType, item.name)}
                  variant="ghost"
                  size="sm"
                  className="h-9 w-9 p-0 text-muted-foreground hover:bg-red-100 hover:text-red-600"
                  title={t("common.actions.delete")}
                >
                  <TrashIcon className="h-5 w-5" />
                </Button>
              </div>

              <div className="mt-5 h-px bg-border" />

              <div className="mt-5 flex justify-end">
                <Button
                  onClick={() => handleEdit(activeType, item.name)}
                  variant="outline"
                  disabled={openOptions.length === 0}
                  className="h-10 rounded-2xl bg-background px-4 text-[14px] font-semibold text-foreground"
                >
                  <CodeBracketIcon className="h-4 w-4 text-blue-600" />
                  {t("common.actions.edit")}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <SyncDialog
        isOpen={syncDialogOpen}
        onClose={() => setSyncDialogOpen(false)}
        onSuccess={() => {
          setSyncDialogOpen(false);
          loadLibrary();
        }}
      />

      <Dialog open={clearDialogOpen} onOpenChange={setClearDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t("library.clearDialog.title")}</DialogTitle>
            <DialogDescription>
              {t("library.clearDialog.description")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setClearDialogOpen(false)}
              disabled={clearing}
            >
              {t("common.actions.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleClearAll}
              disabled={clearing}
              variant="success"
            >
              {clearing
                ? t("library.clearDialog.clearing")
                : t("library.clearDialog.confirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
