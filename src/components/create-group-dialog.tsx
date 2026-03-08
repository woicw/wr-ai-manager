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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { ConfigGroup } from '@/types';
import { useTranslation } from 'react-i18next';

interface CreateGroupDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function CreateGroupDialog({
  isOpen,
  onClose,
  onSuccess,
}: CreateGroupDialogProps) {
  const { t } = useTranslation();
  const [groupId, setGroupId] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!groupId.trim() || !name.trim()) {
      setError(t('dialogs.createGroup.requiredFields'));
      return;
    }

    setCreating(true);
    try {
      await invoke<ConfigGroup>('create_config_group', {
        groupId: groupId.trim(),
        name: name.trim(),
        description: description.trim(),
      });

      setGroupId('');
      setName('');
      setDescription('');
      onSuccess();
      onClose();
    } catch (err) {
      setError(String(err));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('dialogs.createGroup.title')}</DialogTitle>
          <DialogDescription>{t('dialogs.createGroup.description')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="group-id">{t('dialogs.createGroup.id')}</Label>
            <Input
              id="group-id"
              value={groupId}
              onChange={(e) => setGroupId(e.target.value)}
              placeholder={t('dialogs.createGroup.idPlaceholder')}
              disabled={creating}
            />
            <p className="text-xs text-muted-foreground">{t('dialogs.createGroup.idHint')}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-name">{t('dialogs.createGroup.name')}</Label>
            <Input
              id="group-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('dialogs.createGroup.namePlaceholder')}
              disabled={creating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="group-description">{t('dialogs.createGroup.descriptionLabel')}</Label>
            <Textarea
              id="group-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t('dialogs.createGroup.descriptionPlaceholder')}
              disabled={creating}
            />
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={creating}>
              {t('common.actions.cancel')}
            </Button>
            <Button type="submit" disabled={creating} variant="success">
              {creating ? t('common.status.creating') : t('common.actions.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
