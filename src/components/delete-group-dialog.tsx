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
import { useTranslation } from 'react-i18next';

interface DeleteGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  groupId: string;
  groupName: string;
}

export function DeleteGroupDialog({
  isOpen,
  onClose,
  onSuccess,
  groupId,
  groupName,
}: DeleteGroupDialogProps) {
  const { t } = useTranslation();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError('');
    setDeleting(true);

    try {
      await invoke('delete_config_group', { groupId });
      onSuccess();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-red-600">{t('dialogs.deleteGroup.title')}</DialogTitle>
          <DialogDescription>
            {t('dialogs.deleteGroup.description', { groupName, groupId })}
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={deleting}>
            {t('common.actions.cancel')}
          </Button>
          <Button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            variant="success"
          >
            {deleting ? t('common.status.deleting') : t('dialogs.deleteGroup.confirmDelete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
