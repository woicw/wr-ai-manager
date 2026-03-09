use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
};
use crate::commands::config::AppState;

fn build_tray_menu(app: &AppHandle, state: &AppState) -> tauri::Result<Menu<tauri::Wry>> {
    let open_item = MenuItem::with_id(app, "open_window", "打开主窗口", true, None::<&str>)?;
    let refresh_item = MenuItem::with_id(app, "refresh_config", "刷新配置", true, None::<&str>)?;

    // Load config groups
    let manager = state.config_manager.lock().map_err(|e| {
        tauri::Error::Anyhow(anyhow::anyhow!("Failed to lock config manager: {}", e))
    })?;

    let global_config = manager.load_global_config().map_err(|e| {
        tauri::Error::Anyhow(anyhow::anyhow!("Failed to load global config: {}", e))
    })?;

    // Build config groups submenu using Menu::new and append
    let config_submenu = if !global_config.groups.is_empty() {
        let submenu = Submenu::with_id(app, "config_groups", "配置组", true)?;

        for group_id in &global_config.groups {
            let group = manager.load_config_group(group_id).ok();
            let label = if let Some(g) = group {
                format!("{} ({})", g.name, group_id)
            } else {
                group_id.clone()
            };

            let is_active = global_config.active_group == *group_id;
            let item_id = format!("config_group_{}", group_id);

            let display_label = if is_active {
                format!("✓ {}", label)
            } else {
                label
            };

            let item = MenuItem::with_id(app, item_id, display_label, true, None::<&str>)?;
            submenu.append(&item)?;
        }

        Some(submenu)
    } else {
        None
    };

    drop(manager);

    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

    // Build final menu using Menu::new and append
    let menu = Menu::new(app)?;
    menu.append(&open_item)?;

    if let Some(submenu) = config_submenu {
        menu.append(&submenu)?;
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
    menu.append(&refresh_item)?;
    menu.append(&quit_item)?;

    Ok(menu)
}

pub fn create_tray(app: &AppHandle, state: tauri::State<AppState>) -> tauri::Result<()> {
    let menu = build_tray_menu(app, &state)?;

    let icon = app.default_window_icon()
        .ok_or_else(|| tauri::Error::InvalidIcon(std::io::Error::new(
            std::io::ErrorKind::NotFound,
            "Default window icon not found"
        )))?
        .clone();

    // Note: The tray icon is managed by Tauri and will persist for the lifetime of the app.
    // We don't need to store the TrayIcon handle as it's automatically managed.
    let _tray = TrayIconBuilder::with_id("main")
        .icon(icon)
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event);
        })
        .on_tray_icon_event(|tray, event| {
            handle_tray_event(tray, event);
        })
        .build(app)?;

    Ok(())
}

fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let event_id = event.id.as_ref();

    match event_id {
        "quit" => {
            app.exit(0);
        }
        "open_window" => {
            show_main_window(app);
        }
        "refresh_config" => {
            let state = app.state::<AppState>();
            if let Err(e) = update_tray_menu(app, &state) {
                eprintln!("Failed to refresh tray menu: {}", e);
            }
        }
        id if id.starts_with("config_group_") => {
            let group_id = id.strip_prefix("config_group_").unwrap();
            handle_config_group_switch(app, group_id);
        }
        _ => {}
    }
}

fn handle_config_group_switch(app: &AppHandle, group_id: &str) {
    let app_handle = app.app_handle().clone();
    let group_id = group_id.to_string();

    // Spawn async task to apply config group
    tauri::async_runtime::spawn(async move {
        let state = app_handle.state::<AppState>();

        // Get all enabled AI tools
        let enabled_tools = {
            let manager = match state.config_manager.lock() {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("Failed to lock config manager: {}", e);
                    return;
                }
            };

            let global_config = match manager.load_global_config() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to load global config: {}", e);
                    return;
                }
            };

            global_config
                .ai_tools
                .iter()
                .filter(|(_, tool)| tool.enabled)
                .map(|(id, _)| id.clone())
                .collect::<Vec<_>>()
        };

        // Apply config group to each enabled tool
        for tool_id in enabled_tools {
            if let Err(e) = crate::commands::apply::apply_config_group(
                group_id.clone(),
                tool_id.clone(),
                false,
                state.clone(),
            )
            .await
            {
                eprintln!("Failed to apply config group to {}: {}", tool_id, e);
            }
        }

        // Update active group in global config
        {
            let manager = match state.config_manager.lock() {
                Ok(m) => m,
                Err(e) => {
                    eprintln!("Failed to lock config manager: {}", e);
                    return;
                }
            };

            let mut global_config = match manager.load_global_config() {
                Ok(c) => c,
                Err(e) => {
                    eprintln!("Failed to load global config: {}", e);
                    return;
                }
            };

            global_config.active_group = group_id.clone();

            if let Err(e) = manager.save_global_config(&global_config) {
                eprintln!("Failed to save global config: {}", e);
                return;
            }
        }

        // Update tray menu to reflect the change
        if let Err(e) = update_tray_menu(&app_handle, &state) {
            eprintln!("Failed to update tray menu: {}", e);
        }
    });
}

fn update_tray_menu(app: &AppHandle, state: &AppState) -> tauri::Result<()> {
    let menu = build_tray_menu(app, state)?;

    // Get the tray icon and update its menu
    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(menu))?;
    }

    Ok(())
}

/// Public function to refresh tray menu from other modules
pub fn refresh_tray_menu(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<AppState>();
    update_tray_menu(app, &state)
}

fn handle_tray_event(tray: &tauri::tray::TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
        show_main_window(tray.app_handle());
    }
}

/// Shows and focuses the main window
fn show_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if let Err(e) = window.show() {
            eprintln!("Failed to show main window: {}", e);
        }
        if let Err(e) = window.set_focus() {
            eprintln!("Failed to focus main window: {}", e);
        }
    }
}
