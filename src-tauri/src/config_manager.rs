use crate::models::config::{default_ai_tools, ConfigGroup, GlobalConfig};
use std::fs;
use std::path::PathBuf;
use anyhow::{Context, Result};

pub struct ConfigManager {
    base_path: PathBuf,
}

impl ConfigManager {
    pub fn new() -> Result<Self> {
        let home = dirs::home_dir().context("Failed to get home directory")?;
        let base_path = home.join(".wr-ai-manager");

        Self::ensure_base_dirs(&base_path)?;

        Ok(Self { base_path })
    }

    fn ensure_base_dirs(base_path: &PathBuf) -> Result<()> {
        fs::create_dir_all(base_path)?;
        fs::create_dir_all(base_path.join("library/skills"))?;
        fs::create_dir_all(base_path.join("library/mcp"))?;
        fs::create_dir_all(base_path.join("library/plugins"))?;
        fs::create_dir_all(base_path.join("library/commands"))?;
        fs::create_dir_all(base_path.join("groups"))?;
        fs::create_dir_all(base_path.join("backups"))?;

        Ok(())
    }

    fn validate_group_id(id: &str) -> Result<()> {
        if id.is_empty() || id.contains("..") || id.contains('/') || id.contains('\\') {
            anyhow::bail!("Invalid group_id: {}", id);
        }
        Ok(())
    }

    pub fn load_global_config(&self) -> Result<GlobalConfig> {
        Self::ensure_base_dirs(&self.base_path)?;
        let config_path = self.base_path.join("config.json");

        if !config_path.exists() {
            // 创建默认配置
            let default_config = GlobalConfig::default();
            self.save_global_config(&default_config)?;

            // 创建默认配置组
            self.create_default_group()?;

            return Ok(default_config);
        }

        let content = fs::read_to_string(&config_path)?;
        let mut config: GlobalConfig = serde_json::from_str(&content)?;

        let mut changed = false;
        let default_tools = default_ai_tools();

        if let Some(legacy_claude) = config.ai_tools.remove("claude") {
            config
                .ai_tools
                .entry("claude-code".to_string())
                .or_insert(legacy_claude);
            changed = true;
        }

        if !config.groups.iter().any(|group_id| group_id == "default") {
            config.groups.insert(0, "default".to_string());
            changed = true;
        }

        for (tool_id, default_tool) in default_tools {
            if let Some(existing) = config.ai_tools.get_mut(&tool_id) {
                for (config_type, default_path) in default_tool.path_mappings {
                    existing
                        .path_mappings
                        .entry(config_type)
                        .or_insert(default_path);
                }
            } else {
                config.ai_tools.insert(tool_id, default_tool);
                changed = true;
            }
        }

        let default_group_path = self.base_path.join("groups/default/group.json");
        if !default_group_path.exists() {
            self.create_default_group()?;
        }

        if changed {
            self.save_global_config(&config)?;
        }

        Ok(config)
    }

    pub fn save_global_config(&self, config: &GlobalConfig) -> Result<()> {
        let config_path = self.base_path.join("config.json");
        let content = serde_json::to_string_pretty(config)?;
        fs::write(config_path, content)?;
        Ok(())
    }

    fn create_default_group(&self) -> Result<()> {
        let group_dir = self.base_path.join("groups/default");
        fs::create_dir_all(&group_dir)?;

        let default_group = ConfigGroup {
            id: "default".to_string(),
            name: "默认配置".to_string(),
            description: "默认的 AI 工具配置环境".to_string(),
            created_at: chrono::Utc::now().to_rfc3339(),
            updated_at: chrono::Utc::now().to_rfc3339(),
            selection: std::collections::HashMap::new(),
        };

        let group_path = group_dir.join("group.json");
        let content = serde_json::to_string_pretty(&default_group)?;
        fs::write(group_path, content)?;

        Ok(())
    }

    pub fn load_config_group(&self, group_id: &str) -> Result<ConfigGroup> {
        Self::validate_group_id(group_id)?;
        let group_path = self.base_path.join(format!("groups/{}/group.json", group_id));
        let content = fs::read_to_string(&group_path)?;
        let group: ConfigGroup = serde_json::from_str(&content)?;
        Ok(group)
    }

    pub fn save_config_group(&self, group: &ConfigGroup) -> Result<()> {
        Self::validate_group_id(&group.id)?;
        let group_dir = self.base_path.join(format!("groups/{}", group.id));
        fs::create_dir_all(&group_dir)?;

        let group_path = group_dir.join("group.json");
        let content = serde_json::to_string_pretty(group)?;
        fs::write(group_path, content)?;
        Ok(())
    }
}
