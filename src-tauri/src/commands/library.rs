use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use crate::commands::config::AppState;
use serde_json::Value;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
fn hide_windows_console(command: &mut Command) {
    command.creation_flags(CREATE_NO_WINDOW);
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct LibraryItem {
    pub name: String,
    pub path: String,
    pub size: u64,
    pub is_dir: bool,
    pub description: String,
}

#[tauri::command]
pub async fn scan_claude_configs(
    config_type: String,
    _state: State<'_, AppState>,
) -> Result<Vec<LibraryItem>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let claude_path = home.join(".claude").join(&config_type);

    if !claude_path.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&claude_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;

        if let Some(name) = path.file_name() {
            items.push(LibraryItem {
                name: name.to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                is_dir: metadata.is_dir(),
                description: summarize_library_path(&path),
            });
        }
    }

    Ok(items)
}

#[tauri::command]
pub async fn sync_to_library(
    config_type: String,
    items: Vec<String>,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let base_path = home.join(".wr-ai-manager");

    let claude_path = home.join(".claude").join(&config_type);
    let library_path = base_path.join("library").join(&config_type);

    fs::create_dir_all(&library_path).map_err(|e| e.to_string())?;

    for item in items {
        let source = claude_path.join(&item);
        let target = library_path.join(&item);

        if source.exists() {
            if source.is_dir() {
                copy_dir_recursive(&source, &target).map_err(|e| e.to_string())?;
            } else {
                fs::copy(&source, &target).map_err(|e| e.to_string())?;
            }
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn list_library_items(
    config_type: String,
    _state: State<'_, AppState>,
) -> Result<Vec<LibraryItem>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let base_path = home.join(".wr-ai-manager");
    let library_path = base_path.join("library").join(&config_type);

    if !library_path.exists() {
        return Ok(Vec::new());
    }

    let mut items = Vec::new();
    let entries = fs::read_dir(&library_path).map_err(|e| e.to_string())?;

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let metadata = entry.metadata().map_err(|e| e.to_string())?;

        if let Some(name) = path.file_name() {
            items.push(LibraryItem {
                name: name.to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
                size: metadata.len(),
                is_dir: metadata.is_dir(),
                description: summarize_library_path(&path),
            });
        }
    }

    Ok(items)
}

#[tauri::command]
pub async fn delete_library_item(
    config_type: String,
    item_name: String,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let library_path = home
        .join(".wr-ai-manager")
        .join("library")
        .join(&config_type)
        .join(&item_name);

    if !library_path.exists() {
        return Err(format!("Item {} does not exist", item_name));
    }

    if library_path.is_dir() {
        fs::remove_dir_all(&library_path).map_err(|e| e.to_string())?;
    } else {
        fs::remove_file(&library_path).map_err(|e| e.to_string())?;
    }

    Ok(())
}

#[tauri::command]
pub async fn clear_library_items(
    config_type: String,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let library_path = home
        .join(".wr-ai-manager")
        .join("library")
        .join(&config_type);

    if !library_path.exists() {
        return Ok(());
    }

    let entries = fs::read_dir(&library_path).map_err(|e| e.to_string())?;
    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();

        if path.is_dir() {
            fs::remove_dir_all(path).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn open_library_item_with(
    config_type: String,
    item_name: String,
    application: String,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let item_path = home
        .join(".wr-ai-manager")
        .join("library")
        .join(&config_type)
        .join(&item_name);

    let target_path = if config_type == "skills" && item_path.is_dir() {
        item_path
    } else {
        item_path
    };
    let working_dir = if target_path.is_dir() {
        target_path.clone()
    } else {
        target_path
            .parent()
            .map(|value| value.to_path_buf())
            .unwrap_or(target_path.clone())
    };

    open_with_application(&application, &target_path, &working_dir)
}

#[tauri::command]
pub async fn open_library_root_with(
    application: String,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let library_root = home.join(".wr-ai-manager").join("library");

    fs::create_dir_all(&library_root).map_err(|e| e.to_string())?;

    open_with_application(&application, &library_root, &library_root)
}

const KNOWN_TOOLS: &[(&str, &str, &str)] = &[
    ("claude-code", "Claude Code", ".claude"),
    ("codex", "Codex", ".codex"),
    ("cursor", "Cursor", ".cursor"),
    ("gemini", "Gemini CLI", ".gemini"),
    ("antigravity", "Antigravity", ".antigravity"),
    ("trae", "Trae", ".trae"),
    ("kiro", "Kiro", ".kiro"),
    ("codebuddy", "CodeBuddy", ".codebuddy"),
];

const CONFIG_TYPES: &[&str] = &["skills", "mcp", "commands"];

#[derive(Debug, Clone, serde::Serialize)]
pub struct DetectedTool {
    pub id: String,
    pub name: String,
    pub path: String,
    pub detected: bool,
    pub config_types: Vec<String>,
    pub path_mappings: std::collections::HashMap<String, String>,
}

#[tauri::command]
pub async fn detect_ai_tools(
    _state: State<'_, AppState>,
) -> Result<Vec<DetectedTool>, String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let mut tools = Vec::new();

    for (id, name, dir) in KNOWN_TOOLS {
        let tool_path = home.join(dir);
        let mut found_types = Vec::new();
        let mut path_mappings = std::collections::HashMap::new();
        for config_type in CONFIG_TYPES {
            let config_path = if *config_type == "mcp" {
                let file_path = tool_path.join(".mcp.json");
                if file_path.exists() {
                    file_path
                } else {
                    tool_path.join(config_type)
                }
            } else {
                tool_path.join(config_type)
            };
            if config_path.exists() {
                found_types.push(config_type.to_string());
                path_mappings.insert(
                    config_type.to_string(),
                    config_path.to_string_lossy().to_string(),
                );
            }
        }

        tools.push(DetectedTool {
            id: id.to_string(),
            name: name.to_string(),
            path: tool_path.to_string_lossy().to_string(),
            detected: tool_path.exists(),
            config_types: found_types,
            path_mappings,
        });
    }

    Ok(tools)
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncRequest {
    pub tool_id: String,
    pub config_types: Vec<String>,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GithubSyncRequest {
    pub repo_url: String,
    pub relative_path: Option<String>,
}

#[tauri::command]
pub async fn batch_sync_to_library(
    requests: Vec<SyncRequest>,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let library_base = home.join(".wr-ai-manager").join("library");

    for req in requests {
        let tool_dir_name = KNOWN_TOOLS
            .iter()
            .find(|(id, _, _)| *id == req.tool_id)
            .map(|(_, _, dir)| *dir)
            .ok_or(format!("Unknown tool: {}", req.tool_id))?;

        let tool_path = home.join(tool_dir_name);

        for config_type in &req.config_types {
            let target_dir = library_base.join(config_type);

            fs::create_dir_all(&target_dir).map_err(|e| e.to_string())?;

            if req.tool_id == "claude-code" && config_type == "mcp" {
                sync_mcp_json_to_library(&tool_path.join(".mcp.json"), &target_dir)
                    .map_err(|e| e.to_string())?;
                continue;
            }

            let source_dir = tool_path.join(config_type);
            if !source_dir.exists() {
                continue;
            }

            sync_directory_to_library(&source_dir, &target_dir).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[tauri::command]
pub async fn sync_github_repo_to_library(
    request: GithubSyncRequest,
    _state: State<'_, AppState>,
) -> Result<(), String> {
    let home = dirs::home_dir().ok_or("Failed to get home directory")?;
    let library_base = home.join(".wr-ai-manager").join("library");
    let temp_dir = create_temp_clone_dir()?;

    let mut clone_command = Command::new("git");
    clone_command
        .args(["clone", "--depth", "1", &request.repo_url])
        .arg(&temp_dir);
    #[cfg(target_os = "windows")]
    hide_windows_console(&mut clone_command);

    let clone_result = clone_command
        .status()
        .map_err(|e| format!("Failed to start git clone: {}", e));

    if let Err(error) = clone_result {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err(error);
    }

    let mut verify_command = Command::new("git");
    verify_command
        .args(["-C"])
        .arg(&temp_dir)
        .args(["rev-parse", "--is-inside-work-tree"]);
    #[cfg(target_os = "windows")]
    hide_windows_console(&mut verify_command);

    let status = verify_command
        .status()
        .map_err(|e| format!("Failed to verify cloned repository: {}", e))?;

    if !status.success() {
        let _ = fs::remove_dir_all(&temp_dir);
        return Err("Failed to clone GitHub repository".to_string());
    }

    let sync_result = (|| -> Result<(), String> {
        let base_path = resolve_relative_sync_path(&temp_dir, request.relative_path.as_deref())?;

        fs::create_dir_all(&library_base).map_err(|e| e.to_string())?;

        let skills_dir = base_path.join("skills");
        if skills_dir.exists() {
            sync_directory_to_library(&skills_dir, &library_base.join("skills"))
                .map_err(|e| e.to_string())?;
        }

        let commands_dir = base_path.join("commands");
        if commands_dir.exists() {
            sync_directory_to_library(&commands_dir, &library_base.join("commands"))
                .map_err(|e| e.to_string())?;
        }

        let mcp_file = base_path.join(".mcp.json");
        if mcp_file.exists() {
            sync_mcp_json_to_library(&mcp_file, &library_base.join("mcp"))?;
        } else {
            let mcp_dir = base_path.join("mcp");
            if mcp_dir.exists() {
                sync_directory_to_library_preserve_existing(&mcp_dir, &library_base.join("mcp"))
                    .map_err(|e| e.to_string())?;
            }
        }

        Ok(())
    })();

    let _ = fs::remove_dir_all(&temp_dir);
    sync_result
}

fn sync_mcp_json_to_library(mcp_file: &PathBuf, target_dir: &PathBuf) -> Result<(), String> {
    if !mcp_file.exists() {
        return Ok(());
    }

    let content = fs::read_to_string(&mcp_file).map_err(|e| e.to_string())?;
    let value: Value = serde_json::from_str(&content).map_err(|e| e.to_string())?;
    let servers = value
        .get("mcpServers")
        .and_then(|item| item.as_object())
        .ok_or("Invalid .mcp.json: missing mcpServers object")?;

    for (server_name, server_config) in servers {
        let file_name = format!("{}.json", sanitize_item_name(server_name));
        let target_path = target_dir.join(file_name);
        if target_path.exists() {
            continue;
        }
        let server_content =
            serde_json::to_string_pretty(server_config).map_err(|e| e.to_string())?;
        fs::write(target_path, server_content).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn sync_directory_to_library(source_dir: &PathBuf, target_dir: &PathBuf) -> std::io::Result<()> {
    fs::create_dir_all(target_dir)?;
    let entries = fs::read_dir(source_dir)?;
    for entry in entries {
        let entry = entry?;
        let source = entry.path();
        let target = target_dir.join(entry.file_name());

        if source.is_dir() {
            copy_dir_recursive(&source, &target)?;
        } else {
            fs::copy(&source, &target)?;
        }
    }

    Ok(())
}

fn sync_directory_to_library_preserve_existing(
    source_dir: &PathBuf,
    target_dir: &PathBuf,
) -> std::io::Result<()> {
    fs::create_dir_all(target_dir)?;
    let entries = fs::read_dir(source_dir)?;
    for entry in entries {
        let entry = entry?;
        let source = entry.path();
        let target = target_dir.join(entry.file_name());

        if target.exists() {
            continue;
        }

        if source.is_dir() {
            copy_dir_recursive(&source, &target)?;
        } else {
            fs::copy(&source, &target)?;
        }
    }

    Ok(())
}

fn resolve_relative_sync_path(repo_root: &PathBuf, relative_path: Option<&str>) -> Result<PathBuf, String> {
    let trimmed = relative_path.unwrap_or("").trim();
    if trimmed.is_empty() {
        return Ok(repo_root.clone());
    }

    let relative = PathBuf::from(trimmed);
    if relative.is_absolute() || trimmed.contains("..") {
        return Err("relativePath must be a safe relative path".to_string());
    }

    let base_path = repo_root.join(relative);
    if !base_path.exists() {
        return Err(format!("Relative path not found: {}", trimmed));
    }

    Ok(base_path)
}

fn create_temp_clone_dir() -> Result<PathBuf, String> {
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_millis();

    let dir = std::env::temp_dir().join(format!("wr-ai-manager-sync-{}", millis));
    if dir.exists() {
        fs::remove_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    Ok(dir)
}

fn sanitize_item_name(name: &str) -> String {
    name.replace('/', "_")
}

fn open_with_application(
    application: &str,
    target_path: &PathBuf,
    working_dir: &PathBuf,
) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let mut command = Command::new("open");
        match application {
            "finder" => {
                command.arg("-R").arg(target_path);
            }
            "terminal" => {
                command.arg("-a").arg("Terminal").arg(working_dir);
            }
            "warp" => {
                command.arg("-a").arg("Warp").arg(working_dir);
            }
            "vscode" => {
                command.arg("-a").arg("Visual Studio Code").arg(target_path);
            }
            "cursor" => {
                command.arg("-a").arg("Cursor").arg(target_path);
            }
            "antigravity" => {
                command.arg("-a").arg("Antigravity").arg(target_path);
            }
            _ => return Err(format!("Unsupported application: {}", application)),
        }

        return run_command(command, application);
    }

    #[cfg(target_os = "windows")]
    {
        let target = target_path.to_string_lossy().to_string();
        let dir = working_dir.to_string_lossy().to_string();

        let commands: Vec<(&str, Vec<String>)> = match application {
            "finder" => vec![("explorer", vec![target])],
            "terminal" => vec![
                ("wt", vec!["-d".to_string(), dir.clone()]),
                ("cmd", vec!["/C".to_string(), "start".to_string(), "".to_string(), "cmd".to_string(), "/K".to_string(), format!("cd /d {}", dir)]),
            ],
            "warp" => vec![
                ("warp", vec![dir.clone()]),
                ("wt", vec!["-d".to_string(), dir.clone()]),
            ],
            "vscode" => vec![("cmd", vec!["/C".to_string(), "code".to_string(), target.clone()])],
            "cursor" => vec![("cmd", vec!["/C".to_string(), "cursor".to_string(), target.clone()])],
            "antigravity" => vec![("cmd", vec!["/C".to_string(), "antigravity".to_string(), target.clone()])],
            _ => return Err(format!("Unsupported application: {}", application)),
        };

        return run_first_available(commands, application);
    }

    #[cfg(target_os = "linux")]
    {
        let target = target_path.to_string_lossy().to_string();
        let dir = working_dir.to_string_lossy().to_string();

        let commands: Vec<(&str, Vec<String>)> = match application {
            "finder" => vec![("xdg-open", vec![target])],
            "terminal" => vec![
                ("x-terminal-emulator", vec!["--working-directory".to_string(), dir.clone()]),
                ("gnome-terminal", vec!["--working-directory".to_string(), dir.clone()]),
                ("konsole", vec!["--workdir".to_string(), dir.clone()]),
            ],
            "warp" => vec![
                ("warp-terminal", vec![dir.clone()]),
                ("warp", vec![dir.clone()]),
                ("x-terminal-emulator", vec!["--working-directory".to_string(), dir.clone()]),
            ],
            "vscode" => vec![("code", vec![target.clone()])],
            "cursor" => vec![("cursor", vec![target.clone()])],
            "antigravity" => vec![("antigravity", vec![target.clone()])],
            _ => return Err(format!("Unsupported application: {}", application)),
        };

        return run_first_available(commands, application);
    }

    #[allow(unreachable_code)]
    Err("Unsupported operating system".to_string())
}

#[cfg(any(target_os = "windows", target_os = "linux"))]
fn run_first_available(
    candidates: Vec<(&str, Vec<String>)>,
    application: &str,
) -> Result<(), String> {
    let mut last_error = None;

    for (program, args) in candidates {
        let mut command = Command::new(program);
        command.args(args);
        #[cfg(target_os = "windows")]
        hide_windows_console(&mut command);
        match command.status() {
            Ok(status) if status.success() => return Ok(()),
            Ok(status) => {
                last_error = Some(format!(
                    "{} exited with status {}",
                    program,
                    status
                ));
            }
            Err(error) => {
                last_error = Some(error.to_string());
            }
        }
    }

    Err(format!(
        "Failed to open item with {}: {}",
        application,
        last_error.unwrap_or_else(|| "no available launcher".to_string())
    ))
}

#[cfg(target_os = "macos")]
fn run_command(mut command: Command, application: &str) -> Result<(), String> {
    command.status().map_err(|e| e.to_string()).and_then(|status| {
        if status.success() {
            Ok(())
        } else {
            Err(format!("Failed to open item with {}", application))
        }
    })
}

fn copy_dir_recursive(src: &PathBuf, dst: &PathBuf) -> std::io::Result<()> {
    fs::create_dir_all(dst)?;

    for entry in fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let target = dst.join(entry.file_name());

        if path.is_dir() {
            copy_dir_recursive(&path, &target)?;
        } else {
            fs::copy(&path, &target)?;
        }
    }

    Ok(())
}

fn summarize_library_path(path: &Path) -> String {
    if path
        .parent()
        .and_then(|parent| parent.file_name())
        .map(|name| name == "mcp")
        .unwrap_or(false)
    {
        return String::new();
    }

    let summary_file = if path.is_dir() {
        [
            "SKILL.md",
            "skill.md",
            "README.md",
            "readme.md",
            "index.md",
        ]
        .iter()
        .map(|candidate| path.join(candidate))
        .find(|candidate| candidate.exists() && candidate.is_file())
    } else {
        path.extension()
            .and_then(|extension| extension.to_str())
            .filter(|extension| extension.eq_ignore_ascii_case("md"))
            .map(|_| path.to_path_buf())
    };

    let Some(summary_file) = summary_file else {
        return String::new();
    };

    let Ok(content) = fs::read_to_string(summary_file) else {
        return String::new();
    };

    extract_summary(&content)
}

fn extract_summary(content: &str) -> String {
    let mut in_frontmatter = false;
    let mut found_frontmatter = false;

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed == "---" {
            in_frontmatter = !in_frontmatter;
            found_frontmatter = true;
            continue;
        }

        if in_frontmatter {
            if let Some((key, value)) = trimmed.split_once(':') {
                if key.trim().eq_ignore_ascii_case("description") {
                    return value.trim().trim_matches('"').trim_matches('\'').to_string();
                }
            }
            continue;
        }

        if found_frontmatter {
            break;
        }
    }

    String::new()
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct AvailableApp {
    pub id: String,
    pub label: String,
}

#[tauri::command]
pub async fn detect_available_apps() -> Result<Vec<AvailableApp>, String> {
    let mut apps = Vec::new();

    #[cfg(target_os = "macos")]
    {
        let checks: &[(&str, &str, &str)] = &[
            ("vscode", "VS Code", "com.microsoft.VSCode"),
            ("cursor", "Cursor", "com.todesktop.230313mzl4w4u92"),
            ("antigravity", "Antigravity", "com.antigravity.app"),
            ("windsurf", "Windsurf", "com.codeium.windsurf"),
            ("zed", "Zed", "dev.zed.Zed"),
            ("finder", "Finder", "com.apple.finder"),
            ("terminal", "Terminal", "com.apple.Terminal"),
            ("iterm", "iTerm2", "com.googlecode.iterm2"),
            ("warp", "Warp", "dev.warp.Warp-Stable"),
        ];

        for (id, label, bundle_id) in checks {
            let output = Command::new("mdfind")
                .args(["kMDItemCFBundleIdentifier", "=", bundle_id])
                .output();

            if let Ok(out) = output {
                let result = String::from_utf8_lossy(&out.stdout);
                if !result.trim().is_empty() {
                    apps.push(AvailableApp {
                        id: id.to_string(),
                        label: label.to_string(),
                    });
                }
            }
        }
    }

    #[cfg(target_os = "windows")]
    {
        let checks: &[(&str, &str, &str)] = &[
            ("vscode", "VS Code", "code"),
            ("cursor", "Cursor", "cursor"),
            ("antigravity", "Antigravity", "antigravity"),
            ("windsurf", "Windsurf", "windsurf"),
            ("explorer", "Explorer", "explorer"),
            ("terminal", "Terminal", "wt"),
            ("warp", "Warp", "warp"),
        ];

        for (id, label, cmd) in checks {
            let mut command = Command::new("where");
            command.arg(cmd);
            hide_windows_console(&mut command);
            let output = command.output();
            if let Ok(out) = output {
                if out.status.success() {
                    apps.push(AvailableApp {
                        id: id.to_string(),
                        label: label.to_string(),
                    });
                }
            }
        }
    }

    #[cfg(target_os = "linux")]
    {
        let checks: &[(&str, &str, &str)] = &[
            ("vscode", "VS Code", "code"),
            ("cursor", "Cursor", "cursor"),
            ("antigravity", "Antigravity", "antigravity"),
            ("nautilus", "Files", "nautilus"),
            ("terminal", "Terminal", "gnome-terminal"),
            ("warp", "Warp", "warp-terminal"),
        ];

        for (id, label, cmd) in checks {
            let output = Command::new("which").arg(cmd).output();
            if let Ok(out) = output {
                if out.status.success() {
                    apps.push(AvailableApp {
                        id: id.to_string(),
                        label: label.to_string(),
                    });
                }
            }
        }
    }

    Ok(apps)
}
