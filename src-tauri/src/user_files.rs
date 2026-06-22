use std::path::{Path, PathBuf};

// UNIX_EPOCH is used by #[cfg(not(debug_assertions))] helpers.
// In debug mode it's not referenced, so gate the import.
#[cfg(not(debug_assertions))]
use std::time::UNIX_EPOCH;

// Include the build-time generated manifest (lists all embedded files).
// Only available in release builds — debug builds read directly from filesystem.
#[cfg(not(debug_assertions))]
mod user_manifest {
    include!(concat!(env!("OUT_DIR"), "/user_manifest.rs"));
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/// Project root `user/` directory (debug: source tree; release: exe-relative).
fn user_source_dir() -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest.join("..").join("user")
}

/// `~/Dragon/Translator` — user's persistent config directory.
fn config_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Dragon").join("Translator")
}




// ---------------------------------------------------------------------------
// Release-only: read embedded bytes
// ---------------------------------------------------------------------------


#[cfg(not(debug_assertions))]
fn read_embedded(path: &str) -> Option<&'static [u8]> {
    user_manifest::FILES
        .iter()
        .find(|f| f.relative_path == path)
        .map(|f| f.data)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Return the raw content of `default-config.json`.
///
/// Release: read from exe-embedded data.
/// Debug:   read from the `user/` directory in the project tree.
pub fn get_default_config_json() -> Result<String, String> {
    #[cfg(not(debug_assertions))]
    {
        if let Some(data) = read_embedded("default-config.json") {
            return String::from_utf8(data.to_vec()).map_err(|e| e.to_string());
        }
    }

    let path = user_source_dir().join("default-config.json");
    std::fs::read_to_string(&path).map_err(|e| format!("读取默认配置失败: {}", e))
}

/// Release all runtime files from the embedded payload (release) or source tree
/// (debug) into `~/Dragon/Translator/`, then seed `config.json` if it
/// doesn't exist yet.
///
/// Release strategy:
///   - All files (including `default-config.json`) → `~/Dragon/Translator/`.
///     Overwrites only when the embedded mtime is newer than the disk copy.
///   - After releasing, if `~/Dragon/Translator/config.json` does not exist:
///     copy `default-config.json` → `config.json` (wrapped in store format).
///     **Never overwrites** an existing `config.json`.
///
/// Debug strategy:
///   - Copy any missing files from the project `user/` source tree.
///   - Same config.json seeding logic.
pub fn ensure_user_files() -> Result<Vec<String>, String> {
    let mut log: Vec<String> = Vec::new();
    let cfg_dir = config_dir();

    std::fs::create_dir_all(&cfg_dir).map_err(|e| e.to_string())?;

    // ---- Release: walk embedded manifest ----
    #[cfg(not(debug_assertions))]
    {
        for file in user_manifest::FILES {
            let dest = cfg_dir.join(&file.relative_path);
            let performed = copy_if_needed_for_embedded(file, &dest);
            if performed {
                log.push(format!("{} (已释放)", file.relative_path));
            }
        }
    }

    // ---- Debug: copy from project user/ source tree ----
    #[cfg(debug_assertions)]
    {
        log.push("调试模式: runtime 文件源自开发目录 user/".to_string());
        copy_dir_if_missing(&user_source_dir(), &cfg_dir, &mut log)
            .map_err(|e| format!("复制 user/ 文件失败: {}", e))?;
    }

    // ---- Seed config.json (first run only) ----
    let config_json = cfg_dir.join("config.json");
    if !config_json.exists() {
        let default_config = cfg_dir.join("default-config.json");
        if default_config.exists() {
            let raw = std::fs::read_to_string(&default_config)
                .map_err(|e| format!("读取 default-config.json 失败: {}", e))?;
            // tauri-plugin-store format: {"app": <value>}
            let wrapped = format!("{{\"app\":{}}}", raw);
            std::fs::write(&config_json, &wrapped)
                .map_err(|e| format!("写入 config.json 失败: {}", e))?;
            log.push("config.json (首次创建, 来自 default-config.json)".to_string());
        }
    }

    Ok(log)
}

// ---- Helpers ----

#[cfg(not(debug_assertions))]
fn copy_if_needed_for_embedded(file: &user_manifest::EmbeddedFile, dest: &Path) -> bool {
    let should = if !dest.exists() {
        true
    } else {
        let disk_mtime = std::fs::metadata(dest)
            .ok()
            .and_then(|m| m.modified().ok())
            .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
            .map(|d| d.as_secs())
            .unwrap_or(0);
        disk_mtime < file.mtime
    };

    if should {
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent).ok();
        }
        std::fs::write(dest, file.data).is_ok()
    } else {
        false
    }
}

#[cfg(debug_assertions)]
fn copy_dir_if_missing(
    src: &Path,
    dst: &Path,
    log: &mut Vec<String>,
) -> Result<(), std::io::Error> {
    for entry in std::fs::read_dir(src)? {
        let entry = entry?;
        let path = entry.path();
        let dest = dst.join(path.file_name().unwrap());
        if path.is_dir() {
            copy_dir_if_missing(&path, &dest, log)?;
        } else if !dest.exists() {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent)?;
            }
            std::fs::copy(&path, &dest)?;
            log.push(format!("{} (调试拷贝)", path.file_name().unwrap().to_string_lossy()));
        }
    }
    Ok(())
}
