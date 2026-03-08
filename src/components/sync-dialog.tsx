import { useEffect, useMemo, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  normalizeToolDetection,
  type ToolDetection,
} from '@/lib/ai-tools';
import { useAppStore, useSettingsStore } from '@/stores';
import { toast } from '@/hooks/use-toast';

interface SyncDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialTab?: 'tools' | 'github';
}

const SUPPORTED_SYNC_TYPES = ['skills', 'mcp', 'commands'] as const;

export function SyncDialog({
  isOpen,
  onClose,
  onSuccess,
  initialTab = 'tools',
}: SyncDialogProps) {
  const { t } = useTranslation();
  const [sourceTab, setSourceTab] = useState<'tools' | 'github'>(initialTab);
  const [tools, setTools] = useState<ToolDetection[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const repoUrl = useSettingsStore((state) => state.githubRepoUrl);
  const setRepoUrl = useSettingsStore((state) => state.setGithubRepoUrl);
  const useRelativePath = useSettingsStore((state) => state.githubUseRelativePath);
  const setUseRelativePath = useSettingsStore((state) => state.setGithubUseRelativePath);
  const relativePath = useSettingsStore((state) => state.githubRelativePath);
  const setRelativePath = useSettingsStore((state) => state.setGithubRelativePath);
  const bumpLibraryVersion = useAppStore((state) => state.bumpLibraryVersion);

  const syncableTools = useMemo(
    () =>
      tools.filter(
        (tool) =>
          tool.detected &&
          tool.configTypes.some((configType) =>
            SUPPORTED_SYNC_TYPES.includes(
              configType as (typeof SUPPORTED_SYNC_TYPES)[number],
            ),
          ),
      ),
    [tools],
  );

  useEffect(() => {
    if (isOpen) {
      setSourceTab(initialTab);
      detectTools();
    }
  }, [isOpen, initialTab]);

  const detectTools = async () => {
    setLoading(true);
    try {
      const detected = await invoke<unknown[]>('detect_ai_tools');
      const nextTools = detected
        .map((tool) => normalizeToolDetection(tool as Record<string, unknown>))
        .filter((tool) => tool.detected);
      setTools(nextTools);
      setSelected(new Set(nextTools.map((tool) => tool.id)));
    } catch (error) {
      console.error('Failed to detect AI tools:', error);
      toast({
        title: t('syncDialog.toast.detectFailedTitle'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (toolId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  const handleSync = async () => {
    if (sourceTab === 'github') {
      if (!repoUrl.trim()) return;

      setSyncing(true);
      try {
        await invoke('sync_github_repo_to_library', {
          request: {
            repoUrl: repoUrl.trim(),
            relativePath: useRelativePath ? relativePath.trim() : '',
          },
        });
        toast({
          title: t('syncDialog.toast.githubSyncSuccessTitle'),
          description: t('syncDialog.toast.githubSyncSuccessDescription'),
          variant: 'success',
        });
        bumpLibraryVersion();
        onSuccess?.();
        onClose();
      } catch (error) {
        console.error('Failed to sync from GitHub:', error);
        toast({
          title: t('syncDialog.toast.githubSyncFailedTitle'),
          description: String(error),
          variant: 'destructive',
        });
      } finally {
        setSyncing(false);
      }
      return;
    }

    const requests = syncableTools
      .filter((tool) => selected.has(tool.id))
      .map((tool) => ({
        toolId: tool.id,
        configTypes: tool.configTypes.filter((configType) =>
          SUPPORTED_SYNC_TYPES.includes(
            configType as (typeof SUPPORTED_SYNC_TYPES)[number],
          ),
        ),
      }))
      .filter((request) => request.configTypes.length > 0);

    if (requests.length === 0) return;

    setSyncing(true);
    try {
      await invoke('batch_sync_to_library', { requests });
      toast({
        title: t('syncDialog.toast.toolsSyncSuccessTitle'),
        description: t('syncDialog.toast.toolsSyncSuccessDescription'),
        variant: 'success',
      });
      bumpLibraryVersion();
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to sync:', error);
      toast({
        title: t('syncDialog.toast.syncFailedTitle'),
        description: String(error),
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="flex max-h-[80vh] max-w-xl flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle>{t('syncDialog.title')}</DialogTitle>
          <DialogDescription>
            {t('syncDialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <Tabs value={sourceTab} onValueChange={(value) => setSourceTab(value as 'tools' | 'github')}>
            <TabsList className="grid h-auto grid-cols-2 rounded-[20px] border border-white/45 bg-secondary/80 p-1">
              <TabsTrigger value="tools">{t('syncDialog.tabs.tools')}</TabsTrigger>
              <TabsTrigger value="github">{t('syncDialog.tabs.github')}</TabsTrigger>
            </TabsList>
          </Tabs>

          <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
            {sourceTab === 'tools' ? (
              <div className="space-y-2">
                {loading ? (
                  <div className="py-8 text-center text-muted-foreground">{t('syncDialog.loadingTools')}</div>
                ) : syncableTools.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">
                    {t('syncDialog.noTools')}
                  </div>
                ) : (
                  syncableTools.map((tool) => (
                    <label
                      key={tool.id}
                      className="flex cursor-pointer items-start gap-3 rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3 transition-colors hover:bg-secondary/70"
                    >
                      <Checkbox
                        checked={selected.has(tool.id)}
                        onCheckedChange={() => handleToggle(tool.id)}
                        className="mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-foreground">{tool.name}</div>
                        <div className="mt-1 text-xs text-muted-foreground">{tool.path}</div>
                        <div className="mt-2 text-xs text-muted-foreground">
                          {t('syncDialog.syncTypes')}{' '}
                          {tool.configTypes
                            .filter((configType) =>
                              SUPPORTED_SYNC_TYPES.includes(
                                configType as (typeof SUPPORTED_SYNC_TYPES)[number],
                              ),
                            )
                            .join(', ')}
                        </div>
                      </div>
                    </label>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">{t('syncDialog.githubRepoUrl')}</div>
                  <Input
                    value={repoUrl}
                    onChange={(event) => setRepoUrl(event.target.value)}
                    placeholder={t('syncDialog.repoUrlPlaceholder')}
                  />
                </div>

                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border/70 bg-secondary/35 px-4 py-3 transition-colors hover:bg-secondary/70">
                  <Checkbox
                    checked={useRelativePath}
                    onCheckedChange={(checked) => setUseRelativePath(Boolean(checked))}
                  />
                  <div>
                    <div className="text-sm font-medium text-foreground">{t('syncDialog.useRelativePath')}</div>
                    <div className="text-xs text-muted-foreground">
                      {t('syncDialog.useRelativePathDescription')}
                    </div>
                  </div>
                </label>

                <div className="space-y-2">
                  <div className="text-sm font-medium text-foreground">{t('syncDialog.relativePath')}</div>
                  <Input
                    value={relativePath}
                    onChange={(event) => setRelativePath(event.target.value)}
                    placeholder={t('syncDialog.relativePathPlaceholder')}
                    disabled={!useRelativePath}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={syncing}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            onClick={handleSync}
            disabled={
              syncing ||
              (sourceTab === 'tools'
                ? selected.size === 0 || syncableTools.length === 0
                : !repoUrl.trim() || (useRelativePath && !relativePath.trim()))
            }
            variant="success"
          >
            {syncing ? t('common.status.syncing') : t('syncDialog.confirmSync')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
