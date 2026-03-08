use crate::config_manager::ConfigManager;
use crate::models::config::{GlobalConfig, ConfigGroup};
use tauri::State;
use std::sync::Mutex;

pub struct AppState {
    pub config_manager: Mutex<ConfigManager>,
}

#[tauri::command]
pub async fn load_global_config(state: State<'_, AppState>) -> Result<GlobalConfig, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.load_global_config().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_global_config(
    config: GlobalConfig,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.save_global_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn load_config_group(
    group_id: String,
    state: State<'_, AppState>,
) -> Result<ConfigGroup, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.load_config_group(&group_id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_config_group(
    group: ConfigGroup,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;
    manager.save_config_group(&group).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn create_config_group(
    group_id: String,
    name: String,
    description: String,
    state: State<'_, AppState>,
) -> Result<ConfigGroup, String> {
    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;

    let group = ConfigGroup {
        id: group_id.clone(),
        name,
        description,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
        selection: std::collections::HashMap::new(),
    };

    manager.save_config_group(&group).map_err(|e| e.to_string())?;

    // Update global config to include new group
    let mut config = manager.load_global_config().map_err(|e| e.to_string())?;
    if !config.groups.contains(&group_id) {
        config.groups.push(group_id);
        manager.save_global_config(&config).map_err(|e| e.to_string())?;
    }

    Ok(group)
}

#[tauri::command]
pub async fn delete_config_group(
    group_id: String,
    state: State<'_, AppState>,
) -> Result<(), String> {
    if group_id == "default" {
        return Err("Cannot delete default group".to_string());
    }

    let manager = state.config_manager.lock().map_err(|e| e.to_string())?;

    // Remove from global config
    let mut config = manager.load_global_config().map_err(|e| e.to_string())?;
    config.groups.retain(|g| g != &group_id);

    // If this was the active group, clear activation state
    if config.active_group == group_id {
        config.active_group.clear();
    }

    manager.save_global_config(&config).map_err(|e| e.to_string())?;

    // Delete group directory
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let group_dir = home.join(".wr-ai-manager/groups").join(&group_id);

    if group_dir.exists() {
        std::fs::remove_dir_all(&group_dir).map_err(|e| e.to_string())?;
    }

    Ok(())
}
