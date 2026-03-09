use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton},
};

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;
    let open_item = MenuItem::with_id(app, "open_window", "打开主窗口", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &open_item,
        &PredefinedMenuItem::separator(app)?,
        &quit_item,
    ])?;

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
