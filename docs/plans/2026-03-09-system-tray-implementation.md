# 系统托盘功能实现计划

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 为 WR AI Manager 添加系统托盘功能,支持快速切换配置组

**Architecture:** 使用 Tauri 2.x 的 tray-icon feature 实现原生系统托盘。托盘菜单动态生成配置组列表,点击后调用现有的 apply_config_group 逻辑完成切换。窗口关闭时隐藏而非退出,保持托盘图标常驻。

**Tech Stack:** Rust (Tauri 2.x), tray-icon feature, 现有的 ConfigManager

---

### Task 1: 添加 tray-icon 依赖

**Files:**
- Modify: `src-tauri/Cargo.toml:21`

**Step 1: 添加 tray-icon feature**

在 Cargo.toml 的 tauri 依赖中添加 "tray-icon" feature:

```toml
tauri = { version = "2.10.2", features = ["devtools", "tray-icon"] }
```

**Step 2: 验证依赖**

Run: `cd src-tauri && cargo check`
Expected: 编译成功,无错误

**Step 3: Commit**

```bash
git add src-tauri/Cargo.toml
git commit -m "feat: add tray-icon feature to tauri dependencies"
```

---

### Task 2: 创建托盘模块基础结构

**Files:**
- Create: `src-tauri/src/tray.rs`
- Modify: `src-tauri/src/lib.rs:1`

**Step 1: 创建托盘模块文件**

```rust
use tauri::{
    AppHandle, Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{TrayIconBuilder, TrayIconEvent, MouseButton, MouseButtonState},
};
use crate::config_manager::ConfigManager;
use std::sync::Mutex;

pub fn create_tray(app: &AppHandle) -> tauri::Result<()> {
    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;
    let open_item = MenuItem::with_id(app, "open_window", "打开主窗口", true, None::<&str>)?;

    let menu = Menu::with_items(app, &[
        &open_item,
        &PredefinedMenuItem::separator(app)?,
        &quit_item,
    ])?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .menu_on_left_click(true)
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
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        _ => {}
    }
}

fn handle_tray_event(tray: &tauri::tray::TrayIcon, event: TrayIconEvent) {
    if let TrayIconEvent::DoubleClick { button: MouseButton::Left, .. } = event {
        if let Some(window) = tray.app_handle().get_webview_window("main") {
            let _ = window.show();
            let _ = window.set_focus();
        }
    }
}
```

**Step 2: 在 lib.rs 中引入托盘模块**

在 `src-tauri/src/lib.rs` 文件顶部添加:

```rust
mod tray;
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src-tauri/src/tray.rs src-tauri/src/lib.rs
git commit -m "feat: create basic tray module with quit and open window"
```

---

### Task 3: 在应用启动时初始化托盘

**Files:**
- Modify: `src-tauri/src/lib.rs:13-55`

**Step 1: 在 setup 中调用 create_tray**

在 `tauri::Builder::default()` 后添加 `.setup()` 调用:

```rust
tauri::Builder::default()
    .setup(|app| {
        tray::create_tray(app.handle())?;
        Ok(())
    })
    .manage(AppState {
        config_manager: Mutex::new(config_manager),
    })
    // ... 其余代码
```

**Step 2: 测试托盘功能**

Run: `cd src-tauri && cargo tauri dev`
Expected: 应用启动,系统托盘显示图标,点击显示菜单(打开主窗口、退出应用)

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: initialize tray icon on app startup"
```

---

### Task 4: 实现窗口关闭时隐藏而非退出

**Files:**
- Modify: `src-tauri/src/lib.rs:13-55`

**Step 1: 添加窗口事件处理**

在 `.setup()` 之后添加 `.on_window_event()`:

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        window.hide().unwrap();
        api.prevent_close();
    }
})
```

**Step 2: 测试窗口行为**

Run: `cd src-tauri && cargo tauri dev`
Expected: 关闭主窗口后,窗口隐藏但应用继续运行,托盘图标仍然存在

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: hide window instead of exit on close"
```

---

### Task 5: 动态构建配置组菜单

**Files:**
- Modify: `src-tauri/src/tray.rs:1-60`

**Step 1: 添加构建菜单函数**

在 `tray.rs` 中添加 `build_tray_menu` 函数:

```rust
use crate::commands::config::AppState;
use tauri::State;

pub fn build_tray_menu(app: &AppHandle, state: &State<AppState>) -> tauri::Result<Menu> {
    let open_item = MenuItem::with_id(app, "open_window", "打开主窗口", true, None::<&str>)?;
    let refresh_item = MenuItem::with_id(app, "refresh_config", "刷新配置", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;

    let mut menu_items: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = vec![
        &open_item,
        &PredefinedMenuItem::separator(app)?,
    ];

    // 读取配置组列表
    if let Ok(config_manager) = state.config_manager.lock() {
        if let Ok(global_config) = config_manager.load_global_config() {
            let active_group = &global_config.active_group;

            for group_id in &global_config.groups {
                let is_active = group_id == active_group;
                let label = if is_active {
                    format!("✓ {}", group_id)
                } else {
                    group_id.clone()
                };

                let item = MenuItem::with_id(
                    app,
                    &format!("config_group_{}", group_id),
                    label,
                    true,
                    None::<&str>
                )?;
                menu_items.push(Box::leak(Box::new(item)));
            }
        }
    }

    menu_items.push(&PredefinedMenuItem::separator(app)?);
    menu_items.push(&refresh_item);
    menu_items.push(&quit_item);

    Menu::with_items(app, &menu_items)
}
```

**Step 2: 更新 create_tray 使用动态菜单**

修改 `create_tray` 函数签名和实现:

```rust
pub fn create_tray(app: &AppHandle, state: &State<AppState>) -> tauri::Result<()> {
    let menu = build_tray_menu(app, state)?;

    let _tray = TrayIconBuilder::new()
        .icon(app.default_window_icon().unwrap().clone())
        .menu(&menu)
        .menu_on_left_click(true)
        .on_menu_event(move |app, event| {
            handle_menu_event(app, event);
        })
        .on_tray_icon_event(|tray, event| {
            handle_tray_event(tray, event);
        })
        .build(app)?;

    Ok(())
}
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "feat: dynamically build tray menu with config groups"
```

---

### Task 6: 处理配置组切换事件

**Files:**
- Modify: `src-tauri/src/tray.rs:40-60`

**Step 1: 更新 handle_menu_event 处理配置组点击**

```rust
fn handle_menu_event(app: &AppHandle, event: tauri::menu::MenuEvent) {
    let event_id = event.id.as_ref();

    match event_id {
        "quit" => {
            app.exit(0);
        }
        "open_window" => {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        "refresh_config" => {
            // 刷新托盘菜单
            if let Err(e) = update_tray_menu(app) {
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
    use crate::commands::apply::apply_config_group;
    use crate::commands::config::AppState;

    let state = app.state::<AppState>();

    // 获取所有启用的 AI 工具
    if let Ok(config_manager) = state.config_manager.lock() {
        if let Ok(global_config) = config_manager.load_global_config() {
            for (tool_id, tool) in &global_config.ai_tools {
                if tool.enabled {
                    // 异步调用 apply_config_group
                    let group_id = group_id.to_string();
                    let tool_id = tool_id.clone();
                    let app_handle = app.clone();

                    tauri::async_runtime::spawn(async move {
                        match apply_config_group(
                            group_id.clone(),
                            tool_id.clone(),
                            true, // force = true
                            app_handle.state::<AppState>(),
                        ).await {
                            Ok(result) => {
                                if result.success {
                                    println!("Successfully switched to group {} for tool {}", group_id, tool_id);
                                    // 更新托盘菜单
                                    let _ = update_tray_menu(&app_handle);
                                } else {
                                    eprintln!("Failed to switch group: {}", result.message);
                                }
                            }
                            Err(e) => {
                                eprintln!("Error switching group: {}", e);
                            }
                        }
                    });
                }
            }
        }
    }
}

fn update_tray_menu(app: &AppHandle) -> tauri::Result<()> {
    use crate::commands::config::AppState;

    let state = app.state::<AppState>();
    let new_menu = build_tray_menu(app, &state)?;

    if let Some(tray) = app.tray_by_id("main") {
        tray.set_menu(Some(new_menu))?;
    }

    Ok(())
}
```

**Step 2: 给托盘图标添加 ID**

修改 `create_tray` 中的 `TrayIconBuilder`:

```rust
let _tray = TrayIconBuilder::with_id("main")
    .icon(app.default_window_icon().unwrap().clone())
    // ... 其余代码
```

**Step 3: 验证编译**

Run: `cd src-tauri && cargo check`
Expected: 编译成功

**Step 4: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "feat: handle config group switching from tray menu"
```

---

### Task 7: 更新 lib.rs 传递 state 到 create_tray

**Files:**
- Modify: `src-tauri/src/lib.rs:13-55`

**Step 1: 修改 setup 中的 create_tray 调用**

```rust
.setup(|app| {
    let state = app.state::<AppState>();
    tray::create_tray(app.handle(), &state)?;
    Ok(())
})
```

**Step 2: 测试完整功能**

Run: `cd src-tauri && cargo tauri dev`
Expected:
- 托盘图标显示
- 点击显示菜单,包含所有配置组
- 当前配置组前有 ✓ 标记
- 点击配置组可以切换
- 切换后菜单更新,✓ 标记移动

**Step 3: Commit**

```bash
git add src-tauri/src/lib.rs
git commit -m "feat: pass AppState to tray initialization"
```

---

### Task 8: 修复内存泄漏和编译问题

**Files:**
- Modify: `src-tauri/src/tray.rs:10-40`

**Step 1: 重构 build_tray_menu 避免内存泄漏**

```rust
pub fn build_tray_menu(app: &AppHandle, state: &State<AppState>) -> tauri::Result<Menu> {
    let open_item = MenuItem::with_id(app, "open_window", "打开主窗口", true, None::<&str>)?;
    let refresh_item = MenuItem::with_id(app, "refresh_config", "刷新配置", true, None::<&str>)?;
    let quit_item = MenuItem::with_id(app, "quit", "退出应用", true, None::<&str>)?;
    let separator1 = PredefinedMenuItem::separator(app)?;
    let separator2 = PredefinedMenuItem::separator(app)?;

    let menu = Menu::new(app)?;
    menu.append(&open_item)?;
    menu.append(&separator1)?;

    // 读取配置组列表
    if let Ok(config_manager) = state.config_manager.lock() {
        if let Ok(global_config) = config_manager.load_global_config() {
            let active_group = &global_config.active_group;

            for group_id in &global_config.groups {
                let is_active = group_id == active_group;
                let label = if is_active {
                    format!("✓ {}", group_id)
                } else {
                    group_id.clone()
                };

                let item = MenuItem::with_id(
                    app,
                    &format!("config_group_{}", group_id),
                    label,
                    true,
                    None::<&str>
                )?;
                menu.append(&item)?;
            }
        }
    }

    menu.append(&separator2)?;
    menu.append(&refresh_item)?;
    menu.append(&quit_item)?;

    Ok(menu)
}
```

**Step 2: 验证编译和运行**

Run: `cd src-tauri && cargo tauri dev`
Expected: 编译成功,功能正常

**Step 3: Commit**

```bash
git add src-tauri/src/tray.rs
git commit -m "fix: refactor menu building to avoid memory leaks"
```

---

### Task 9: 测试和验证

**Files:**
- N/A (手动测试)

**Step 1: 功能测试清单**

测试以下功能:
- [ ] 托盘图标正常显示
- [ ] 左键点击显示菜单
- [ ] 双击托盘图标显示主窗口
- [ ] 菜单显示所有配置组
- [ ] 当前配置组显示 ✓ 标记
- [ ] 点击配置组成功切换
- [ ] 切换后菜单更新
- [ ] 刷新配置功能正常
- [ ] 关闭窗口后托盘图标仍存在
- [ ] 点击退出应用完全退出

**Step 2: 边界情况测试**

- [ ] 无配置组时菜单显示
- [ ] 配置组切换失败的处理
- [ ] 多次快速点击配置组

**Step 3: 记录测试结果**

创建测试报告文件记录测试结果。

---

### Task 10: 文档更新

**Files:**
- Create: `docs/features/system-tray.md`

**Step 1: 创建功能文档**

```markdown
# 系统托盘功能

## 功能说明

WR AI Manager 支持系统托盘功能,允许用户快速访问应用和切换配置组。

## 使用方法

1. **显示菜单**: 左键点击托盘图标
2. **打开主窗口**: 双击托盘图标或点击菜单中的"打开主窗口"
3. **切换配置组**: 点击菜单中的配置组名称
4. **刷新配置**: 点击"刷新配置"重新加载配置文件
5. **退出应用**: 点击"退出应用"完全关闭程序

## 注意事项

- 关闭主窗口不会退出应用,只会隐藏窗口
- 配置组切换会应用到所有启用的 AI 工具
- 当前生效的配置组前会显示 ✓ 标记
```

**Step 2: Commit**

```bash
git add docs/features/system-tray.md
git commit -m "docs: add system tray feature documentation"
```
