use crate::symlink_manager::{SymlinkManager, ConflictInfo};
use std::path::PathBuf;
use tauri::State;
use std::sync::Mutex;

pub struct SymlinkState {
    pub manager: Mutex<SymlinkManager>,
}

#[tauri::command]
pub async fn create_symlink(
    source: String,
    target: String,
    state: State<'_, SymlinkState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let source_path = expand_path(&source)?;
    let target_path = expand_path(&target)?;

    manager.create_symlink(&source_path, &target_path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn remove_symlink(
    path: String,
    state: State<'_, SymlinkState>,
) -> Result<(), String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let path = expand_path(&path)?;

    manager.remove_symlink(&path)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn is_symlink(
    path: String,
    state: State<'_, SymlinkState>,
) -> Result<bool, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let path = expand_path(&path)?;

    Ok(manager.is_symlink(&path))
}

#[tauri::command]
pub async fn check_symlink_conflict(
    path: String,
    state: State<'_, SymlinkState>,
) -> Result<ConflictInfo, String> {
    let manager = state.manager.lock().map_err(|e| e.to_string())?;
    let path = expand_path(&path)?;

    Ok(manager.check_conflict(&path))
}

fn expand_path(path: &str) -> Result<PathBuf, String> {
    if path.starts_with("~/") {
        let home = dirs::home_dir().ok_or("Failed to get home directory")?;
        Ok(home.join(&path[2..]))
    } else {
        Ok(PathBuf::from(path))
    }
}
