import { useEffect, useMemo, useState } from "react";
import { useConfigStore } from "../../stores";
import { useNavigate, useLocation } from "react-router";
import { CreateGroupDialog } from "../create-group-dialog";
import { DeleteGroupDialog } from "../delete-group-dialog";
import { FolderOpenIcon, PlusIcon } from "@heroicons/react/24/outline";
import { invoke } from "@tauri-apps/api/core";
import { useTranslation } from "react-i18next";
import type { ConfigGroup } from "@/types";

const EMPTY_GROUPS: string[] = [];

export function ConfigGroupSection() {
  const { t } = useTranslation();
  const config = useConfigStore((state) => state.config);
  const setCurrentGroup = useConfigStore((state) => state.setCurrentGroup);
  const loadConfig = useConfigStore((state) => state.loadConfig);
  const navigate = useNavigate();
  const location = useLocation();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [groupNames, setGroupNames] = useState<Record<string, string>>({});
  const groups = config?.groups ?? EMPTY_GROUPS;
  const groupsKey = useMemo(() => groups.join("|"), [groups]);

  const handleGroupClick = (groupId: string) => {
    setCurrentGroup(groupId);
    navigate(`/groups/${groupId}`);
  };

  const handleDeleteClick = (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation();
    setGroupToDelete({ id: groupId, name: groupId });
    setDeleteDialogOpen(true);
  };

  const handleSuccess = () => {
    loadConfig();
  };

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

  if (!config) {
    return null;
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <div className="flex items-center gap-4">
          <FolderOpenIcon className="h-4.5 w-4.5 text-muted-foreground" />
          <h2 className="font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            {t("sidebar.groups")}
          </h2>
        </div>
        <button
          onClick={() => setCreateDialogOpen(true)}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/35 focus-visible:ring-offset-0 hover:bg-accent hover:text-foreground"
          title={t("sidebar.addGroup")}
        >
          <PlusIcon className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-1">
        {groups.map((groupId) => {
          const isActive = location.pathname === `/groups/${groupId}`;
          return (
            <div key={groupId} className="group relative">
              <button
                onClick={() => handleGroupClick(groupId)}
                className={`relative flex w-full items-center rounded-2xl px-3 py-2.5 pr-10 text-left text-[13px] transition-colors outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-teal-300/35 focus-visible:ring-offset-0 ${
                  isActive
                    ? "bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(242,246,251,0.84))] text-foreground font-medium shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),inset_0_1px_0_rgba(255,255,255,0.88),0_10px_24px_rgba(15,23,42,0.08)] dark:bg-[linear-gradient(135deg,rgba(255,255,255,0.09),rgba(255,255,255,0.04))] dark:shadow-[inset_0_0_0_1px_rgba(255,255,255,0.09),inset_0_1px_0_rgba(255,255,255,0.06),0_10px_24px_rgba(2,6,23,0.2)]"
                    : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
                }`}
              >
                <span>{groupNames[groupId] ?? groupId}</span>
              </button>
              {groupId !== "default" ? (
                <button
                  onClick={(e) => handleDeleteClick(e, groupId)}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1 text-muted-foreground transition-all outline-none focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/40 focus-visible:ring-offset-0 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-950 ${
                    isActive
                      ? "opacity-100"
                      : "opacity-0 group-hover:opacity-100"
                  }`}
                  title={t("sidebar.deleteGroup")}
                >
                  <svg
                    className="h-3 w-3"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              ) : null}
            </div>
          );
        })}
      </div>

      <CreateGroupDialog
        isOpen={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onSuccess={handleSuccess}
      />

      {groupToDelete && (
        <DeleteGroupDialog
          isOpen={deleteDialogOpen}
          onClose={() => {
            setDeleteDialogOpen(false);
            setGroupToDelete(null);
          }}
          onSuccess={handleSuccess}
          groupId={groupToDelete.id}
          groupName={groupToDelete.name}
        />
      )}
    </div>
  );
}
