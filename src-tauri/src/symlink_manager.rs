use anyhow::{Context, Result};
use std::fs;
use std::path::{Path, PathBuf};

pub struct SymlinkManager;

impl SymlinkManager {
    pub fn new() -> Self {
        Self
    }

    pub fn create_symlink(&self, source: &Path, target: &Path) -> Result<()> {
        #[cfg(unix)]
        {
            std::os::unix::fs::symlink(source, target)
                .context("Failed to create symlink")?;
        }

        #[cfg(windows)]
        {
            if source.is_dir() {
                std::os::windows::fs::symlink_dir(source, target)
                    .context("Failed to create directory symlink")?;
            } else {
                std::os::windows::fs::symlink_file(source, target)
                    .context("Failed to create file symlink")?;
            }
        }

        Ok(())
    }

    pub fn remove_symlink(&self, path: &Path) -> Result<()> {
        if path.is_symlink() {
            fs::remove_file(path).or_else(|_| fs::remove_dir(path))
                .context("Failed to remove symlink")?;
        }
        Ok(())
    }

    pub fn is_symlink(&self, path: &Path) -> bool {
        path.is_symlink()
    }

    pub fn read_symlink(&self, path: &Path) -> Result<PathBuf> {
        fs::read_link(path).context("Failed to read symlink")
    }

    pub fn check_conflict(&self, path: &Path) -> ConflictInfo {
        let exists = path.exists();
        let is_symlink = path.is_symlink();
        let target = if is_symlink {
            self.read_symlink(path).ok().map(|p| p.to_string_lossy().to_string())
        } else {
            None
        };

        ConflictInfo {
            path: path.to_string_lossy().to_string(),
            exists,
            is_symlink,
            target,
        }
    }
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
pub struct ConflictInfo {
    pub path: String,
    pub exists: bool,
    pub is_symlink: bool,
    pub target: Option<String>,
}
