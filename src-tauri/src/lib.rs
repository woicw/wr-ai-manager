mod models;
mod config_manager;
mod symlink_manager;
mod commands;
mod tray;

use commands::config::AppState;
use commands::symlink::SymlinkState;
use config_manager::ConfigManager;
use symlink_manager::SymlinkManager;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let config_manager = ConfigManager::new().expect("Failed to initialize config manager");
    let symlink_manager = SymlinkManager::new();

    tauri::Builder::default()
        .setup(|app| {
            tray::create_tray(app.handle())?;
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .manage(AppState {
            config_manager: Mutex::new(config_manager),
        })
        .manage(SymlinkState {
            manager: Mutex::new(symlink_manager),
        })
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            commands::config::load_global_config,
            commands::config::save_global_config,
            commands::config::load_config_group,
            commands::config::save_config_group,
            commands::config::create_config_group,
            commands::config::delete_config_group,
            commands::symlink::create_symlink,
            commands::symlink::remove_symlink,
            commands::symlink::is_symlink,
            commands::symlink::check_symlink_conflict,
            commands::library::scan_claude_configs,
            commands::library::sync_to_library,
            commands::library::list_library_items,
            commands::library::delete_library_item,
            commands::library::clear_library_items,
            commands::library::open_library_item_with,
            commands::library::open_library_root_with,
            commands::library::detect_ai_tools,
            commands::library::batch_sync_to_library,
            commands::library::sync_github_repo_to_library,
            commands::library::detect_available_apps,
            commands::marketplace::fetch_official_skills,
            commands::marketplace::search_skills_sh,
            commands::marketplace::fetch_marketplace_skills,
            commands::marketplace::install_marketplace_skill,
            commands::apply::apply_config_group,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
