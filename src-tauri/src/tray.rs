use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem, Submenu},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
};
use crate::commands::config::AppState;

fn build_tray_menu(app: &AppHandle, state: &AppState) -> tauri::Result<Menu<tauri::Wry>> {
    let open_item = MenuItem::with_id(app, "open_window", "打开主窗口", true, None::<&str>)?;

    // Load config groups
    let manager = state.config_manager.lock().map_err(|e| {
        tauri::Error::Anyhow(anyhow::anyhow!("Failed to lock config manager: {}", e))
    })?;

    let global_config = manager.load_global_config().map_err(|e| {
        tauri::Error::Anyhow(anyhow::anyhow!("Failed to load global config: {}", e))
    })?;

    // Build config groups submenu
    let mut config_items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();

    for group_id in &global_config.groups {
        let group = manager.load_config_group(group_id).ok();
        let label = if let Some(g) = group {
            format!("{} ({})", g.name, group_id)
        } else {
            group_id.clone()
        };

        let is_active = global_config.active_group == *group_id;
        let item_id = format!("config_group_{}", group_id);
        let item = MenuItem::with_id(app, item_id, label, true, None::<&str>)?;

        if is_active {
            item.set_text(format!("✓ {}", item.text().unwrap_or_default()))?;
        }

        config_items.push(Box::new(item));
    }

    drop(manager);

    let config_submenu = if !config_items.is_empty() {
        let submenu = Submenu::with_id(app, "config_groups", "配置组", true)?;
        for item in config_items {
            submenu.append(item.as_ref())?;
        }
        Some(submenu)
    } else {
        None
    };

    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

    // Build final menu
    let menu = Menu::new(app)?;
    menu.append(&open_item)?;

    if let Some(submenu) = config_submenu {
        menu.append(&submenu)?;
    }

    menu.append(&PredefinedMenuItem::separator(app)?)?;
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
    let _tray = TrayIconBuilder::new()
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
    match event.id.as_ref() {
        "quit" => {
            app.exit(0);
        }
        "open_window" => {
            show_main_window(app);
        }
        _ => {}
    }
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
