import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { ApplyResult, ConflictDetail } from '@/types';
import { useTranslation } from 'react-i18next';

interface ApplyGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  groupId: string;
  groupName: string;
  toolId: string;
  toolName?: string;
}

export function ApplyGroupDialog({
  isOpen,
  onClose,
  onSuccess,
  groupId,
  groupName,
  toolId,
  toolName,
}: ApplyGroupDialogProps) {
  const { t } = useTranslation();
  const [applying, setApplying] = useState(false);
  const [conflicts, setConflicts] = useState<ConflictDetail[]>([]);
  const [showConflicts, setShowConflicts] = useState(false);
  const [error, setError] = useState('');

  const handleApply = async (force = false) => {
    setError('');
    setApplying(true);

    try {
      const result = await invoke<ApplyResult>('apply_config_group', {
        groupId,
        toolId,
        force,
      });

      if (result.success) {
        onSuccess();
        onClose();
      } else {
        setConflicts(result.conflicts);
        setShowConflicts(true);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setApplying(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('dialogs.applyGroup.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.applyGroup.description', { groupName, toolName: toolName || toolId })}
          </DialogDescription>
        </DialogHeader>

        {!showConflicts ? (
          <>
            <p className="text-sm leading-7 text-muted-foreground">
              {t('dialogs.applyGroup.intro')}
            </p>
            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={applying}>
                {t('common.actions.cancel')}
              </Button>
              <Button type="button" onClick={() => handleApply(false)} disabled={applying} variant="success">
                {applying ? t('common.status.applying') : t('common.actions.apply')}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <div className="overflow-hidden rounded-[24px] border border-border/80 bg-card/60">
              <table className="w-full text-sm">
                <thead className="bg-secondary/70 text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left">{t('dialogs.applyGroup.configType')}</th>
                    <th className="px-4 py-3 text-left">{t('dialogs.applyGroup.itemName')}</th>
                    <th className="px-4 py-3 text-left">{t('dialogs.applyGroup.status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {conflicts.map((conflict, index) => (
                    <tr key={index} className="border-t border-border/70">
                      <td className="px-4 py-3">{conflict.configType}</td>
                      <td className="px-4 py-3 font-mono text-xs">{conflict.itemName}</td>
                      <td className="px-4 py-3">
                        {conflict.isSymlink ? t('dialogs.applyGroup.symlink') : t('dialogs.applyGroup.actualFile')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              {t('dialogs.applyGroup.warning')}
            </div>

            {error ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            ) : null}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={applying}>
                {t('common.actions.cancel')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowConflicts(false)}
                disabled={applying}
              >
                {t('dialogs.applyGroup.back')}
              </Button>
              <Button
                type="button"
                onClick={() => handleApply(true)}
                disabled={applying}
                variant="success"
              >
                {applying ? t('common.status.applying') : t('dialogs.applyGroup.forceApply')}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
