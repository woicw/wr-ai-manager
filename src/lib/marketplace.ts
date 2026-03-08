import { invoke } from "@tauri-apps/api/core";

export interface MarketplaceSkill {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  installName: string;
  skillId?: string;
  source: string;
  badge: string;
  installs?: number;
  origin: "github" | "skills.sh";
}

export interface MarketplaceSourceStatus {
  source: "github" | "skills.sh" | string;
  ok: boolean;
  error?: string;
}

export interface MarketplaceSkillsPayload {
  items: MarketplaceSkill[];
  sources: MarketplaceSourceStatus[];
}

export interface InstallMarketplaceSkillResult {
  installed: boolean;
  alreadyInstalled: boolean;
  groupId: string;
  appliedToolCount: number;
}

interface MarketplaceSkillResult {
  id: string;
  name: string;
  description: string;
  repoUrl: string;
  installName: string;
  skillId?: string | null;
  source: string;
  badge: string;
  installs?: number | null;
  origin: "github" | "skills.sh";
}

interface MarketplacePayloadResult {
  items: MarketplaceSkillResult[];
  sources: MarketplaceSourceStatus[];
}

export async function fetchMarketplaceSkills(
  query: string,
): Promise<MarketplaceSkillsPayload> {
  const payload = await invoke<MarketplacePayloadResult>(
    "fetch_marketplace_skills",
    {
      query: query.trim() || null,
      limit: 50,
    },
  );

  return {
    items: payload.items.map((skill) => ({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      repoUrl: skill.repoUrl,
      installName: skill.installName,
      skillId: skill.skillId ?? undefined,
      source: skill.source,
      badge: skill.badge,
      installs: skill.installs ?? undefined,
      origin: skill.origin,
    })),
    sources: payload.sources,
  };
}

export async function installMarketplaceSkill(
  skill: MarketplaceSkill,
): Promise<InstallMarketplaceSkillResult> {
  return invoke<InstallMarketplaceSkillResult>("install_marketplace_skill", {
    request: {
      installName: skill.installName,
      origin: skill.origin,
      repoUrl: skill.repoUrl,
      source: skill.source,
      skillId: skill.skillId ?? null,
    },
  });
}
