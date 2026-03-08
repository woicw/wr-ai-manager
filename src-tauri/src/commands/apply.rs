use crate::models::config::ConfigGroup;
use crate::models::config::ToolSelection;
use crate::symlink_manager::SymlinkManager;
use crate::commands::config::AppState;
use serde_json::{Map, Value};
use std::fs;
use std::path::Path;
use tauri::State;
use std::path::PathBuf;

fn log_apply(message: &str) {
    println!("[apply_config_group] {}", message);
}

fn create_default_selection(
    base_path: &PathBuf,
    path_mappings: &std::collections::HashMap<String, String>,
) -> Result<ToolSelection, String> {
    Ok(ToolSelection {
        enabled: true,
        skills: if path_mappings.contains_key("skills") {
            list_library_item_names(base_path, "skills")?
        } else {
            Vec::new()
        },
        mcp: if path_mappings.contains_key("mcp") {
            list_library_item_names(base_path, "mcp")?
        } else {
            Vec::new()
        },
        plugins: Vec::new(),
        commands: if path_mappings.contains_key("commands") {
            list_library_item_names(base_path, "commands")?
        } else {
            Vec::new()
        },
    })
}

fn list_library_item_names(base_path: &PathBuf, config_type: &str) -> Result<Vec<String>, String> {
    let library_dir = base_path.join("library").join(config_type);
    if !library_dir.exists() {
        return Ok(Vec::new());
    }

    let mut names = Vec::new();
    for entry in fs::read_dir(&library_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        names.push(entry.file_name().to_string_lossy().to_string());
    }
    names.sort();

    Ok(names)
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ApplyResult {
    pub success: bool,
    pub message: String,
    pub conflicts: Vec<ConflictDetail>,
    pub used_fallback_copy: bool,
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConflictDetail {
    pub path: String,
    pub config_type: String,
    pub item_name: String,
    pub is_symlink: bool,
    pub target: Option<String>,
}

#[tauri::command]
pub async fn apply_config_group(
    group_id: String,
    tool_id: String,
    force: bool,
    state: State<'_, AppState>,
) -> Result<ApplyResult, String> {
    log_apply(&format!(
        "start group_id={} tool_id={} force={}",
        group_id, tool_id, force
    ));
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    let symlink_manager = SymlinkManager::new();

    // Load group
    let group = manager.load_config_group(&group_id).map_err(|e| e.to_string())?;
    log_apply(&format!(
        "loaded group {} with selection keys {:?}",
        group.id,
        group.selection.keys().collect::<Vec<_>>()
    ));

    // Load global config to get tool path mappings
    let mut global_config = manager.load_global_config().map_err(|e| e.to_string())?;
    log_apply(&format!(
        "loaded global config; enabled tools {:?}",
        global_config
            .ai_tools
            .iter()
            .filter(|(_, tool)| tool.enabled)
            .map(|(id, tool)| format!("{}:{}", id, tool.name))
            .collect::<Vec<_>>()
    ));

    let tool = global_config.ai_tools.get(&tool_id)
        .ok_or_else(|| format!("Tool {} not found", tool_id))?;
    log_apply(&format!(
        "tool {} path mappings {:?}",
        tool_id, tool.path_mappings
    ));

    if !tool.enabled {
        return Err(format!("Tool {} is not enabled", tool_id));
    }

    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let base_path = home.join(".wr-ai-manager");

    // Fall back to a default selection derived from the current library when a
    // group has no explicit per-tool selection saved yet.
    let tool_selection = match group.selection.get(&tool_id) {
        Some(selection) => selection.clone(),
        None => {
            let fallback = create_default_selection(&base_path, &tool.path_mappings)?;
            log_apply(&format!(
                "no saved selection for tool {}; using fallback skills={:?} mcp={:?} commands={:?}",
                tool_id, fallback.skills, fallback.mcp, fallback.commands
            ));
            fallback
        }
    };
    log_apply(&format!(
        "tool selection enabled={} skills={:?} mcp={:?} commands={:?}",
        tool_selection.enabled,
        tool_selection.skills,
        tool_selection.mcp,
        tool_selection.commands
    ));

    if !tool_selection.enabled {
        return Err(format!("Tool {} is not enabled in this group", tool_id));
    }

    // Check for conflicts
    let mut conflicts = Vec::new();
    for (config_type, items) in [
        ("skills", &tool_selection.skills),
        ("mcp", &tool_selection.mcp),
        ("commands", &tool_selection.commands),
    ] {
        let Some(target_mapping) = tool.path_mappings.get(config_type) else {
            log_apply(&format!(
                "skipping conflict check for config_type={} because tool {} has no mapping",
                config_type, tool_id
            ));
            continue;
        };
        let target_base = expand_path(target_mapping)?;
        let target_base = if config_type == "mcp" {
            normalize_mcp_target_path(&target_base)
        } else {
            target_base
        };
        log_apply(&format!(
            "checking conflicts config_type={} items={:?} target_base={}",
            config_type,
            items,
            target_base.to_string_lossy()
        ));

        let is_file_target = config_type == "mcp";

        if is_file_target {
            if !items.is_empty() && path_exists(&target_base) {
                let is_symlink = target_base.is_symlink();
                let target = if is_symlink {
                    fs::read_link(&target_base)
                        .ok()
                        .map(|p| p.to_string_lossy().to_string())
                } else {
                    None
                };

                conflicts.push(ConflictDetail {
                    path: target_base.to_string_lossy().to_string(),
                    config_type: config_type.to_string(),
                    item_name: ".mcp.json".to_string(),
                    is_symlink,
                    target,
                });
            }

            continue;
        }

        for item in items {
            let target_path = target_base.join(item);

            if target_path.exists() {
                let is_symlink = target_path.is_symlink();
                let target = if is_symlink {
                    std::fs::read_link(&target_path)
                        .ok()
                        .map(|p| p.to_string_lossy().to_string())
                } else {
                    None
                };

                conflicts.push(ConflictDetail {
                    path: target_path.to_string_lossy().to_string(),
                    config_type: config_type.to_string(),
                    item_name: item.clone(),
                    is_symlink,
                    target,
                });
            }
        }
    }

    // If conflicts exist and not forcing, return conflicts
    if !conflicts.is_empty() && !force {
        log_apply(&format!("conflicts found without force: {}", conflicts.len()));
        return Ok(ApplyResult {
            success: false,
            message: format!("Found {} conflicts. Use force=true to overwrite.", conflicts.len()),
            conflicts,
            used_fallback_copy: false,
        });
    }

    // Apply configuration
    let mut used_fallback_copy = false;
    for (config_type, items) in [
        ("skills", &tool_selection.skills),
        ("mcp", &tool_selection.mcp),
        ("commands", &tool_selection.commands),
    ] {
        let Some(target_mapping) = tool.path_mappings.get(config_type) else {
            log_apply(&format!(
                "skipping apply for config_type={} because tool {} has no mapping",
                config_type, tool_id
            ));
            continue;
        };
        let target_base = expand_path(target_mapping)?;
        let target_base = if config_type == "mcp" {
            normalize_mcp_target_path(&target_base)
        } else {
            target_base
        };
        log_apply(&format!(
            "applying config_type={} items={:?} target_base={}",
            config_type,
            items,
            target_base.to_string_lossy()
        ));

        let is_file_target = config_type == "mcp";

        if is_file_target {
            if items.is_empty() {
                log_apply(&format!("mcp selection empty for tool {}", tool_id));
                if path_exists(&target_base) {
                    remove_existing_path(&target_base)?;
                }
                continue;
            }

            if let Some(parent) = target_base.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }

            let generated_path = build_group_mcp_file(&group, &tool_id, items, &base_path)?;
            log_apply(&format!(
                "generated mcp file {}",
                generated_path.to_string_lossy()
            ));

            if path_exists(&target_base) {
                remove_existing_path(&target_base)?;
            }

            let copied = link_or_copy(&symlink_manager, &generated_path, &target_base)
                .map_err(|e| format!("Failed to create symlink for {}: {}", config_type, e))?;
            used_fallback_copy |= copied;
            log_apply(&format!(
                "linked mcp {} -> {}",
                target_base.to_string_lossy(),
                generated_path.to_string_lossy()
            ));

            continue;
        }

        // Ensure target directory exists
        fs::create_dir_all(&target_base).map_err(|e| e.to_string())?;
        prune_managed_symlinks(&target_base, &base_path.join("library").join(config_type), items)?;

        for item in items {
            let source_path = base_path.join("library").join(config_type).join(item);
            let target_path = target_base.join(item);
            log_apply(&format!(
                "linking config_type={} item={} source={} target={}",
                config_type,
                item,
                source_path.to_string_lossy(),
                target_path.to_string_lossy()
            ));

            // Remove existing if it exists
            if path_exists(&target_path) {
                remove_existing_path(&target_path)?;
            }

            // Create symlink
            let copied = link_or_copy(&symlink_manager, &source_path, &target_path)
                .map_err(|e| format!("Failed to create symlink for {}: {}", item, e))?;
            used_fallback_copy |= copied;
        }
    }

    // Update global config with activation info
    global_config.active_group = group_id.clone();
    let applied_config_types = ["skills", "mcp", "commands"]
        .into_iter()
        .filter(|config_type| tool.path_mappings.contains_key(*config_type))
        .map(|config_type| config_type.to_string())
        .collect();

    global_config.activations.insert(
        tool_id.clone(),
        Some(crate::models::config::Activation {
            group_id: group_id.clone(),
            timestamp: chrono::Utc::now().to_rfc3339(),
            config_types: applied_config_types,
        }),
    );

    manager.save_global_config(&global_config).map_err(|e| e.to_string())?;
    log_apply(&format!(
        "completed apply for group {} tool {}",
        group_id, tool_id
    ));

    Ok(ApplyResult {
        success: true,
        message: format!("Successfully applied group {} to {}", group_id, tool_id),
        conflicts: Vec::new(),
        used_fallback_copy,
    })
}

fn expand_path(path: &str) -> Result<PathBuf, String> {
    if path.starts_with("~/") {
        let home = dirs::home_dir().ok_or("Failed to get home directory")?;
        Ok(home.join(&path[2..]))
    } else {
        Ok(PathBuf::from(path))
    }
}

fn remove_existing_path(path: &PathBuf) -> Result<(), String> {
    if !path_exists(path) {
        return Ok(());
    }

    if path.is_symlink() || path.is_file() {
        fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        fs::remove_dir_all(path).map_err(|e| e.to_string())
    }
}

fn path_exists(path: &PathBuf) -> bool {
    fs::symlink_metadata(path).is_ok()
}

#[cfg(windows)]
fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    fs::create_dir_all(dst).map_err(|e| e.to_string())?;

    for entry in fs::read_dir(src).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let target = dst.join(entry.file_name());

        if path.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else {
            fs::copy(&path, &target).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[cfg(windows)]
fn copy_path(src: &Path, dst: &Path) -> Result<(), String> {
    if src.is_dir() {
        copy_dir_recursive(src, dst)
    } else {
        if let Some(parent) = dst.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        fs::copy(src, dst).map_err(|e| e.to_string())?;
        Ok(())
    }
}

fn link_or_copy(
    symlink_manager: &SymlinkManager,
    source: &Path,
    target: &Path,
) -> Result<bool, String> {
    match symlink_manager.create_symlink(source, target) {
        Ok(()) => Ok(false),
        Err(error) => {
            #[cfg(windows)]
            {
                log_apply(&format!(
                    "symlink failed on windows; falling back to copy source={} target={} error={}",
                    source.to_string_lossy(),
                    target.to_string_lossy(),
                    error
                ));
                copy_path(source, target)?;
                Ok(true)
            }

            #[cfg(not(windows))]
            {
                Err(error.to_string())
            }
        }
    }
}

fn prune_managed_symlinks(
    target_base: &PathBuf,
    managed_source_base: &PathBuf,
    selected_items: &[String],
) -> Result<(), String> {
    if !path_exists(target_base) {
        return Ok(());
    }

    let selected: std::collections::HashSet<&str> =
        selected_items.iter().map(|item| item.as_str()).collect();

    for entry in fs::read_dir(target_base).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let file_name = entry.file_name();
        let file_name = file_name.to_string_lossy();

        if selected.contains(file_name.as_ref()) || !path.is_symlink() {
            continue;
        }

        let Ok(link_target) = fs::read_link(&path) else {
            continue;
        };

        if link_target.starts_with(managed_source_base) {
            remove_existing_path(&path)?;
        }
    }

    Ok(())
}

fn build_group_mcp_file(
    group: &ConfigGroup,
    tool_id: &str,
    items: &[String],
    base_path: &PathBuf,
) -> Result<PathBuf, String> {
    let generated_dir = base_path.join("groups").join(&group.id).join("generated").join(tool_id);
    fs::create_dir_all(&generated_dir).map_err(|e| e.to_string())?;
    log_apply(&format!(
        "building mcp file group={} tool={} dir={}",
        group.id,
        tool_id,
        generated_dir.to_string_lossy()
    ));

    let mut mcp_servers = Map::new();

    for item in items {
        let source_path = base_path.join("library").join("mcp").join(item);
        let content = fs::read_to_string(&source_path).map_err(|e| e.to_string())?;
        let server_config: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
        let server_name = item.strip_suffix(".json").unwrap_or(item).replace('_', "/");
        log_apply(&format!(
            "including mcp server {} from {}",
            server_name,
            source_path.to_string_lossy()
        ));
        mcp_servers.insert(server_name, server_config);
    }

    let output = Value::Object(
        [("mcpServers".to_string(), Value::Object(mcp_servers))]
            .into_iter()
            .collect(),
    );

    let generated_path = generated_dir.join(".mcp.json");
    let content = serde_json::to_string_pretty(&output).map_err(|e| e.to_string())?;
    fs::write(&generated_path, content).map_err(|e| e.to_string())?;

    Ok(generated_path)
}

fn normalize_mcp_target_path(path: &PathBuf) -> PathBuf {
    if path.extension().and_then(|ext| ext.to_str()) == Some("json") {
        return path.clone();
    }

    if path.file_name().and_then(|name| name.to_str()) == Some("mcp") {
        if let Some(parent) = path.parent() {
            return parent.join(".mcp.json");
        }
    }

    path.join(".mcp.json")
}
