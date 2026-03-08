use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GlobalConfig {
    pub version: String,
    pub active_group: String,
    pub activations: HashMap<String, Option<Activation>>,
    pub groups: Vec<String>,
    pub ai_tools: HashMap<String, AITool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Activation {
    pub group_id: String,
    pub timestamp: String,
    pub config_types: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AITool {
    pub name: String,
    pub enabled: bool,
    pub path_mappings: HashMap<String, String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ConfigGroup {
    pub id: String,
    pub name: String,
    pub description: String,
    pub created_at: String,
    pub updated_at: String,
    pub selection: HashMap<String, ToolSelection>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ToolSelection {
    pub enabled: bool,
    pub skills: Vec<String>,
    pub mcp: Vec<String>,
    pub plugins: Vec<String>,
    pub commands: Vec<String>,
}

impl Default for GlobalConfig {
    fn default() -> Self {
        let ai_tools = default_ai_tools();

        Self {
            version: "1.0.0".to_string(),
            active_group: String::new(),
            activations: HashMap::new(),
            groups: vec!["default".to_string()],
            ai_tools,
        }
    }
}

pub fn default_ai_tools() -> HashMap<String, AITool> {
    let mut ai_tools = HashMap::new();

    let Some(home) = dirs::home_dir() else {
        return ai_tools;
    };

    for (id, name, dir_name, mappings) in [
        (
            "claude-code",
            "Claude Code",
            ".claude",
            vec!["skills", "plugins", "commands"],
        ),
        ("codex", "Codex", ".codex", vec!["skills", "mcp"]),
        ("cursor", "Cursor", ".cursor", vec!["skills"]),
        ("gemini", "Gemini CLI", ".gemini", vec!["skills"]),
        ("antigravity", "Antigravity", ".antigravity", vec!["skills"]),
        ("trae", "Trae", ".trae", vec!["skills"]),
        ("kiro", "Kiro", ".kiro", vec!["skills"]),
        ("codebuddy", "CodeBuddy", ".codebuddy", vec!["skills"]),
    ] {
        let mut path_mappings: HashMap<String, String> = mappings
            .into_iter()
            .map(|config_type| {
                (
                    config_type.to_string(),
                    home.join(dir_name)
                        .join(config_type)
                        .to_string_lossy()
                        .to_string(),
                )
            })
            .collect();

        if id == "claude-code" {
            path_mappings.insert(
                "mcp".to_string(),
                home.join(dir_name).join(".mcp.json").to_string_lossy().to_string(),
            );
        } else if id == "codex" {
            path_mappings.insert(
                "mcp".to_string(),
                home.join(dir_name).join(".mcp.json").to_string_lossy().to_string(),
            );
        }

        ai_tools.insert(
            id.to_string(),
            AITool {
                name: name.to_string(),
                enabled: id != "codebuddy",
                path_mappings,
            },
        );
    }

    ai_tools
}
