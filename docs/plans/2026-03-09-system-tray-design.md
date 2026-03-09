# 系统托盘功能设计文档

## 概述

为 WR AI Manager 添加系统托盘功能,允许用户通过托盘图标快速访问应用和切换配置组。

## 需求

- 应用在系统托盘显示图标
- 点击托盘图标显示菜单
- 菜单显示所有配置组,支持快速切换
- 双击托盘图标打开/显示主窗口
- 点击配置组后直接切换并应用,无需确认
- 使用现有应用图标作为托盘图标

## 技术方案

### 架构选择

使用 Tauri 2.x 的 `tray-icon` feature 实现原生系统托盘功能。

**优势:**
- 跨平台支持 (macOS/Windows/Linux)
- 与 Tauri 生态集成良好
- API 简洁,维护成本低
- 支持动态更新菜单内容

### 核心组件

1. **Rust 端 (src-tauri/)**
   - 托盘初始化模块:在应用启动时创建托盘图标
   - 菜单构建器:动态生成配置组菜单项
   - 事件处理器:响应托盘点击和菜单选择事件

2. **前端 (src/)**
   - 无需新增 UI 组件(托盘菜单由系统原生渲染)
   - 可选:添加托盘相关的状态管理逻辑

### 数据流

```
用户点击托盘 → Rust 事件处理器 → 调用配置管理逻辑 → 更新全局配置 → 应用配置组
```

## 菜单结构

```
WR AI Manager
├── 打开主窗口
├── ──────────── (分隔符)
├── 配置组
│   ├── ✓ default (当前生效)
│   ├── development
│   ├── production
│   └── testing
├── ──────────── (分隔符)
├── 刷新配置
└── 退出应用
```

### 菜单项说明

1. **打开主窗口** - 显示/聚焦主窗口
2. **配置组列表** - 动态生成,从 `GlobalConfig.groups` 读取
   - 当前激活的配置组前显示 ✓ 标记
   - 点击任意配置组立即切换并应用
3. **刷新配置** - 重新加载配置文件(可选,用于外部修改配置后同步)
4. **退出应用** - 完全退出程序

### 交互行为

- **左键单击托盘图标** → 显示菜单
- **双击托盘图标** → 打开/显示主窗口
- **点击配置组** → 调用 `apply_config_group` 命令,直接切换
- **切换成功** → 更新 `GlobalConfig.activeGroup`,菜单中的 ✓ 标记移动到新配置组

## 实现细节

### Rust 端实现

#### 1. 依赖配置

在 `src-tauri/Cargo.toml` 中添加 `tray-icon` feature:

```toml
[dependencies]
tauri = { version = "2.10.1", features = ["tray-icon"] }
```

#### 2. 托盘模块 (src-tauri/src/tray.rs)

新增托盘管理模块,包含以下函数:

- `create_tray(app: &AppHandle) -> Result<TrayIcon>` - 初始化托盘图标
- `build_tray_menu(app: &AppHandle, config_manager: &ConfigManager) -> Result<Menu>` - 动态构建菜单
- `handle_tray_event(app: &AppHandle, event: TrayIconEvent)` - 处理托盘点击事件
- `handle_menu_event(app: &AppHandle, event: MenuEvent)` - 处理菜单项点击事件
- `update_tray_menu(app: &AppHandle)` - 更新托盘菜单(配置组切换后调用)

#### 3. 事件处理逻辑

**托盘点击事件:**
- 双击托盘图标 → 调用 `window.show()` + `window.set_focus()` 显示主窗口

**菜单点击事件:**
- `open_window` → 显示主窗口
- `config_group_{id}` → 调用 `apply_config_group` 切换配置组
- `refresh_config` → 重新加载配置并更新菜单
- `quit` → 调用 `app.exit(0)` 退出应用

#### 4. 窗口行为调整

修改窗口关闭行为,关闭时隐藏而非退出:

```rust
.on_window_event(|window, event| {
    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
        window.hide().unwrap();
        api.prevent_close();
    }
})
```

### 配置文件变更

#### tauri.conf.json

```json
{
  "app": {
    "windows": [
      {
        "title": "WR AI Manager",
        "width": 1200,
        "height": 800,
        "visible": true
      }
    ]
  }
}
```

### 错误处理

- **配置组切换失败** → 使用系统通知提示用户
- **配置文件读取失败** → 菜单显示"无可用配置组"占位项
- **托盘创建失败** → 记录日志,应用继续运行(降级为无托盘模式)

## 文件清单

### 新增文件
- `src-tauri/src/tray.rs` - 托盘管理模块

### 修改文件
- `src-tauri/Cargo.toml` - 添加 tray-icon feature
- `src-tauri/src/lib.rs` - 引入托盘模块,在 setup 中初始化托盘
- `src-tauri/src/main.rs` - 添加窗口关闭事件处理

## 测试计划

1. **功能测试**
   - 托盘图标正常显示
   - 菜单项正确显示所有配置组
   - 当前配置组显示 ✓ 标记
   - 点击配置组成功切换
   - 双击托盘图标显示主窗口
   - 关闭主窗口后托盘图标仍然存在
   - 点击退出应用完全退出

2. **跨平台测试**
   - macOS 系统托盘功能
   - Windows 系统托盘功能
   - Linux 系统托盘功能(如适用)

3. **边界情况**
   - 无配置组时的菜单显示
   - 配置组切换失败的错误提示
   - 配置文件损坏时的降级处理

## 后续优化

- 添加托盘图标右键菜单(与左键菜单相同)
- 支持托盘图标 tooltip 显示当前配置组
- 添加"启动时最小化到托盘"选项
- 配置组切换时显示通知提示
