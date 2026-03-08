use flate2::read::GzDecoder;
use reqwest::header::USER_AGENT;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;
use std::io::{Cursor, Read};
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::commands::{apply, config::AppState};
use crate::models::config::ToolSelection;

const GITHUB_SKILLS_TARBALL_URL: &str = "https://codeload.github.com/anthropics/skills/tar.gz/refs/heads/main";

#[derive(Debug, Deserialize)]
struct SkillsShResponse {
    skills: Vec<SkillsShSkill>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SkillsShSkill {
    id: String,
    skill_id: String,
    name: String,
    installs: u64,
    source: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceSearchSkill {
    pub id: String,
    pub skill_id: String,
    pub name: String,
    pub installs: u64,
    pub source: String,
    pub url: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfficialMarketplaceSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub repo_url: String,
    pub source: String,
    pub badge: String,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceUnifiedSkill {
    pub id: String,
    pub name: String,
    pub description: String,
    pub repo_url: String,
    pub install_name: String,
    pub skill_id: Option<String>,
    pub source: String,
    pub badge: String,
    pub installs: Option<u64>,
    pub origin: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceSourceStatus {
    pub source: String,
    pub ok: bool,
    pub error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarketplaceSkillsPayload {
    pub items: Vec<MarketplaceUnifiedSkill>,
    pub sources: Vec<MarketplaceSourceStatus>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallMarketplaceSkillRequest {
    pub install_name: String,
    pub origin: String,
    pub repo_url: String,
    pub source: String,
    pub skill_id: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallMarketplaceSkillResult {
    pub installed: bool,
    pub already_installed: bool,
    pub group_id: String,
    pub applied_tool_count: usize,
}

fn github_client() -> reqwest::Client {
    reqwest::Client::builder()
        .user_agent("wr-ai-manager/0.1.0")
        .build()
        .expect("failed to build reqwest client")
}

fn extract_skill_id_from_path(path: &str) -> Option<String> {
    let segments = path.split('/').collect::<Vec<_>>();
    segments
        .windows(3)
        .find(|window| window[0] == "skills" && window[2] == "SKILL.md")
        .map(|window| window[1].to_string())
}

fn sanitize_component(value: &str) -> String {
    value
        .chars()
        .map(|ch| match ch {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '-',
            _ => ch,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

fn is_safe_relative_path(path: &Path) -> bool {
    !path.is_absolute()
        && path
            .components()
            .all(|component| matches!(component, Component::Normal(_)))
}

fn parse_github_tree_url(url: &str) -> Option<(String, String, String)> {
    let trimmed = url.trim().trim_end_matches('/');
    let marker = "github.com/";
    let index = trimmed.find(marker)?;
    let suffix = &trimmed[index + marker.len()..];
    let parts = suffix.split('/').collect::<Vec<_>>();
    if parts.len() < 5 || parts[2] != "tree" {
        return None;
    }

    let repo = format!("{}/{}", parts[0], parts[1]);
    let branch = parts[3].to_string();
    let path = parts[4..].join("/");
    Some((repo, branch, path))
}

fn parse_repo_from_source(source: &str) -> Option<String> {
    let trimmed = source
        .trim()
        .trim_start_matches("https://")
        .trim_start_matches("http://")
        .trim_start_matches("github.com/")
        .trim_matches('/');
    let parts = trimmed.split('/').collect::<Vec<_>>();
    if parts.len() < 2 {
        return None;
    }
    Some(format!("{}/{}", parts[0], parts[1]))
}

fn resolve_install_repo(
    request: &InstallMarketplaceSkillRequest,
) -> Result<(String, String, Vec<String>), String> {
    match request.origin.as_str() {
        "github" => {
            let mut branch = "main".to_string();
            let mut candidate_dirs = Vec::new();

            let repo = if let Some((parsed_repo, parsed_branch, parsed_path)) =
                parse_github_tree_url(&request.repo_url)
            {
                branch = parsed_branch;
                candidate_dirs.push(parsed_path);
                parsed_repo
            } else {
                parse_repo_from_source(&request.repo_url)
                    .or_else(|| parse_repo_from_source(&request.source))
                    .ok_or_else(|| {
                        "Could not resolve a GitHub repository from marketplace GitHub entry"
                            .to_string()
                    })?
            };

            Ok((repo, branch, candidate_dirs))
        }
        "skills.sh" => {
            let repo = parse_repo_from_source(&request.source)
                .or_else(|| parse_repo_from_source(&request.repo_url))
                .ok_or_else(|| {
                    "Could not resolve a GitHub repository from skills.sh source".to_string()
                })?;

            Ok((repo, "main".to_string(), Vec::new()))
        }
        other => Err(format!("Unsupported marketplace origin: {}", other)),
    }
}

fn github_tarball_url(repo: &str, branch: &str) -> String {
    format!(
        "https://codeload.github.com/{}/tar.gz/refs/heads/{}",
        repo, branch
    )
}

async fn download_github_tarball(
    client: &reqwest::Client,
    repo: &str,
    branch: &str,
) -> Result<Vec<u8>, String> {
    let response = client
        .get(github_tarball_url(repo, branch))
        .header(USER_AGENT, "wr-ai-manager/0.1.0")
        .send()
        .await
        .map_err(|error| format!("Failed to download repository archive: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Repository archive responded with {}",
            response.status()
        ));
    }

    response
        .bytes()
        .await
        .map(|bytes| bytes.to_vec())
        .map_err(|error| format!("Failed to read repository archive: {error}"))
}

fn extract_skill_dir_from_tarball(
    archive_bytes: &[u8],
    repo: &str,
    branch: &str,
    candidate_dirs: &[String],
    target_dir: &PathBuf,
) -> Result<bool, String> {
    let top_level = format!(
        "{}-{}/",
        repo.split('/').nth(1).unwrap_or(repo),
        branch
    );

    for candidate in candidate_dirs {
        let normalized_candidate = candidate.trim_matches('/').to_string();
        if normalized_candidate.is_empty() {
            continue;
        }

        let prefix = format!("{}{}", top_level, normalized_candidate);
        let decoder = GzDecoder::new(Cursor::new(archive_bytes.to_vec()));
        let mut archive = tar::Archive::new(decoder);
        let mut found = false;

        let entries = archive
            .entries()
            .map_err(|error| format!("Failed to read repository archive entries: {error}"))?;

        for entry_result in entries {
            let mut entry =
                entry_result.map_err(|error| format!("Failed to inspect archive entry: {error}"))?;
            let entry_path = entry
                .path()
                .map_err(|error| format!("Failed to read archive path: {error}"))?;
            let entry_path = entry_path.to_string_lossy().to_string();

            if !entry_path.starts_with(&prefix) {
                continue;
            }

            let relative = entry_path
                .trim_start_matches(&prefix)
                .trim_start_matches('/');

            if relative.is_empty() {
                found = true;
                continue;
            }

            let relative_path = PathBuf::from(relative);
            if !is_safe_relative_path(&relative_path) {
                continue;
            }

            let destination = target_dir.join(&relative_path);
            if let Some(parent) = destination.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            entry.unpack(&destination).map_err(|error| {
                format!(
                    "Failed to extract {} to {}: {error}",
                    entry_path,
                    destination.to_string_lossy()
                )
            })?;
            found = true;
        }

        if found {
            return Ok(true);
        }
    }

    Ok(false)
}

fn create_empty_selection() -> ToolSelection {
    ToolSelection {
        enabled: true,
        skills: Vec::new(),
        mcp: Vec::new(),
        plugins: Vec::new(),
        commands: Vec::new(),
    }
}

fn parse_frontmatter(content: &str) -> std::collections::HashMap<String, String> {
    let mut values = std::collections::HashMap::new();
    let mut lines = content.lines();

    if lines.next().map(str::trim) != Some("---") {
        return values;
    }

    for line in lines {
        let trimmed = line.trim();
        if trimmed == "---" {
            break;
        }

        if let Some((key, value)) = trimmed.split_once(':') {
            values.insert(
                key.trim().to_string(),
                value.trim().trim_matches('"').trim_matches('\'').to_string(),
            );
        }
    }

    values
}

fn fallback_description(content: &str) -> String {
    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed == "---" || trimmed.starts_with('#') {
            continue;
        }

        return trimmed.to_string();
    }

    String::new()
}

async fn fetch_official_skills_internal() -> Result<Vec<OfficialMarketplaceSkill>, String> {
    let client = github_client();
    let response = client
        .get(GITHUB_SKILLS_TARBALL_URL)
        .header(USER_AGENT, "wr-ai-manager/0.1.0")
        .send()
        .await
        .map_err(|error| format!("Failed to download official skills archive: {error}"))?;

    if !response.status().is_success() {
        return Err(format!(
            "Official skills archive responded with {}",
            response.status()
        ));
    }

    let archive_bytes = response
        .bytes()
        .await
        .map_err(|error| format!("Failed to read official skills archive: {error}"))?;

    let decoder = GzDecoder::new(Cursor::new(archive_bytes));
    let mut archive = tar::Archive::new(decoder);
    let mut skills = Vec::new();

    let entries = archive
        .entries()
        .map_err(|error| format!("Failed to read official skills archive entries: {error}"))?;

    for entry_result in entries {
        let mut entry =
            entry_result.map_err(|error| format!("Failed to inspect archive entry: {error}"))?;
        let path = entry
            .path()
            .map_err(|error| format!("Failed to read archive path: {error}"))?;
        let path_str = path.to_string_lossy().to_string();

        let Some(skill_id) = extract_skill_id_from_path(&path_str) else {
            continue;
        };

        let mut content = String::new();
        entry
            .read_to_string(&mut content)
            .map_err(|error| format!("Failed to read SKILL.md from archive: {error}"))?;

        let frontmatter = parse_frontmatter(&content);
        let name = frontmatter
            .get("name")
            .cloned()
            .unwrap_or_else(|| skill_id.clone());
        let description = frontmatter
            .get("description")
            .cloned()
            .filter(|value| !value.is_empty())
            .unwrap_or_else(|| {
                let fallback = fallback_description(&content);
                if fallback.is_empty() {
                    skill_id.clone()
                } else {
                    fallback
                }
            });

        skills.push(OfficialMarketplaceSkill {
            id: skill_id.clone(),
            name,
            description,
            repo_url: format!(
                "https://github.com/anthropics/skills/tree/main/skills/{}",
                skill_id
            ),
            source: "anthropics/skills".to_string(),
            badge: "official".to_string(),
        });
    }

    skills.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(skills)
}

async fn search_skills_sh_internal(query: String, limit: Option<u32>) -> Result<Vec<MarketplaceSearchSkill>, String> {
    let keyword = query.trim();
    if keyword.is_empty() {
        return Ok(Vec::new());
    }

    let client = github_client();
    let response = client
        .get("https://skills.sh/api/search")
        .query(&[
            ("q", keyword),
            ("limit", &limit.unwrap_or(50).min(100).to_string()),
        ])
        .send()
        .await
        .map_err(|error| format!("Failed to request skills.sh: {error}"))?;

    if !response.status().is_success() {
        return Err(format!("skills.sh search failed with status {}", response.status()));
    }

    let payload = response
        .json::<SkillsShResponse>()
        .await
        .map_err(|error| format!("Failed to parse skills.sh response: {error}"))?;

    Ok(payload
        .skills
        .into_iter()
        .map(|skill| MarketplaceSearchSkill {
            id: skill.id.clone(),
            skill_id: skill.skill_id,
            name: skill.name,
            installs: skill.installs,
            source: skill.source,
            url: format!("https://skills.sh/{}", skill.id),
        })
        .collect())
}

#[tauri::command]
pub async fn fetch_official_skills() -> Result<Vec<OfficialMarketplaceSkill>, String> {
    fetch_official_skills_internal().await
}

#[tauri::command]
pub async fn search_skills_sh(query: String, limit: Option<u32>) -> Result<Vec<MarketplaceSearchSkill>, String> {
    search_skills_sh_internal(query, limit).await
}

#[tauri::command]
pub async fn fetch_marketplace_skills(query: Option<String>, limit: Option<u32>) -> Result<MarketplaceSkillsPayload, String> {
    let keyword = query.unwrap_or_default().trim().to_string();
    let has_query = !keyword.is_empty();

    let official_result = fetch_official_skills_internal().await;
    let community_result = if has_query {
        Some(search_skills_sh_internal(keyword.clone(), limit).await)
    } else {
        None
    };

    let mut source_statuses = Vec::new();
    let mut items = Vec::new();
    let mut seen = HashSet::new();

    match official_result {
        Ok(official_skills) => {
            source_statuses.push(MarketplaceSourceStatus {
                source: "github".to_string(),
                ok: true,
                error: None,
            });

            let lowered_keyword = keyword.to_lowercase();
            for skill in official_skills {
                let matched = if has_query {
                    [skill.name.as_str(), skill.description.as_str(), skill.source.as_str()]
                        .iter()
                        .any(|value| value.to_lowercase().contains(&lowered_keyword))
                } else {
                    true
                };

                if !matched {
                    continue;
                }

                let dedupe_key = format!("{}:{}", skill.source, skill.name.to_lowercase());
                if !seen.insert(dedupe_key) {
                    continue;
                }

                items.push(MarketplaceUnifiedSkill {
                    id: format!("github:{}", skill.id),
                    name: skill.name,
                    description: skill.description,
                    repo_url: skill.repo_url,
                    install_name: skill.id.clone(),
                    skill_id: Some(skill.id.clone()),
                    source: skill.source,
                    badge: skill.badge,
                    installs: None,
                    origin: "github".to_string(),
                });
            }
        }
        Err(error) => {
            source_statuses.push(MarketplaceSourceStatus {
                source: "github".to_string(),
                ok: false,
                error: Some(error),
            });
        }
    }

    if let Some(result) = community_result {
        match result {
            Ok(community_skills) => {
                source_statuses.push(MarketplaceSourceStatus {
                    source: "skills.sh".to_string(),
                    ok: true,
                    error: None,
                });

                for skill in community_skills {
                    let dedupe_key = format!("{}:{}", skill.source, skill.name.to_lowercase());
                    if !seen.insert(dedupe_key) {
                        continue;
                    }

                    let description = skill.skill_id.clone();
                    let install_name = sanitize_component(&skill.name).to_lowercase();
                    let skill_id = skill.skill_id.clone();

                    items.push(MarketplaceUnifiedSkill {
                        id: format!("skills.sh:{}", skill.id),
                        name: skill.name,
                        description,
                        repo_url: format!("https://skills.sh/{}", skill.id),
                        install_name,
                        skill_id: Some(skill_id),
                        source: skill.source,
                        badge: "skills.sh".to_string(),
                        installs: Some(skill.installs),
                        origin: "skills.sh".to_string(),
                    });
                }
            }
            Err(error) => {
                source_statuses.push(MarketplaceSourceStatus {
                    source: "skills.sh".to_string(),
                    ok: false,
                    error: Some(error),
                });
            }
        }
    }

    Ok(MarketplaceSkillsPayload {
        items,
        sources: source_statuses,
    })
}

#[tauri::command]
pub async fn install_marketplace_skill(
    request: InstallMarketplaceSkillRequest,
    state: tauri::State<'_, AppState>,
) -> Result<InstallMarketplaceSkillResult, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let base_path = home.join(".wr-ai-manager");
    let library_skills_dir = base_path.join("library").join("skills");
    fs::create_dir_all(&library_skills_dir).map_err(|e| e.to_string())?;

    let install_name = sanitize_component(&request.install_name);
    if install_name.is_empty() {
        return Err("Invalid skill install name".to_string());
    }

    let target_dir = library_skills_dir.join(&install_name);
    let already_installed = target_dir.exists();

    if !already_installed {
        let client = github_client();
        let (repo, mut branch, mut candidate_dirs) = resolve_install_repo(&request)?;

        let skill_id = request.skill_id.unwrap_or_default();
        let mut unique_candidates = Vec::new();
        for candidate in [
            skill_id.clone(),
            format!("skills/{}", skill_id),
            format!(".claude/skills/{}", skill_id),
            install_name.clone(),
            format!("skills/{}", install_name),
            format!(".claude/skills/{}", install_name),
        ] {
            let trimmed = candidate.trim_matches('/').to_string();
            if !trimmed.is_empty() && !unique_candidates.contains(&trimmed) {
                unique_candidates.push(trimmed);
            }
        }
        candidate_dirs.extend(unique_candidates);

        let archive_bytes = match download_github_tarball(&client, &repo, &branch).await {
            Ok(bytes) => bytes,
            Err(primary_error) if branch != "master" => {
                branch = "master".to_string();
                download_github_tarball(&client, &repo, &branch)
                    .await
                    .map_err(|_| primary_error)?
            }
            Err(error) => return Err(error),
        };

        fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;
        let extracted =
            extract_skill_dir_from_tarball(&archive_bytes, &repo, &branch, &candidate_dirs, &target_dir)?;

        if !extracted {
            let _ = fs::remove_dir_all(&target_dir);
            return Err("Failed to locate a skill directory in the source repository".to_string());
        }
    }

    let (active_group_id, applicable_tool_ids) = {
        let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
        let global_config = manager.load_global_config().map_err(|e| e.to_string())?;
        let active_group_id = global_config.active_group.clone();
        let mut group = manager
            .load_config_group(&active_group_id)
            .map_err(|e| e.to_string())?;

        let applicable_tool_ids = global_config
            .ai_tools
            .iter()
            .filter(|(_, tool)| tool.enabled && tool.path_mappings.contains_key("skills"))
            .map(|(tool_id, _)| tool_id.clone())
            .collect::<Vec<_>>();

        for tool_id in &applicable_tool_ids {
            let selection = group
                .selection
                .entry(tool_id.clone())
                .or_insert_with(create_empty_selection);
            selection.enabled = true;
            if !selection.skills.contains(&install_name) {
                selection.skills.push(install_name.clone());
                selection.skills.sort();
            }
        }

        group.updated_at = chrono::Utc::now().to_rfc3339();
        manager.save_config_group(&group).map_err(|e| e.to_string())?;
        (active_group_id, applicable_tool_ids)
    };

    let mut applied_tool_count = 0;
    for tool_id in applicable_tool_ids {
        let result = apply::apply_config_group(
            active_group_id.clone(),
            tool_id.clone(),
            true,
            state.clone(),
        )
        .await?;

        if result.success {
            applied_tool_count += 1;
        }
    }

    Ok(InstallMarketplaceSkillResult {
        installed: true,
        already_installed,
        group_id: active_group_id,
        applied_tool_count,
    })
}
