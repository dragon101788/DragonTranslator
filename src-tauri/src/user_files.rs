#[cfg(not(debug_assertions))]
use std::io::{Cursor, Read};
use std::path::{Path, PathBuf};

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

/// Project root `user/` directory (debug: source tree).
#[cfg(debug_assertions)]
fn user_source_dir() -> PathBuf {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest.join("..").join("user")
}

/// `~/Dragon/Translator` — user's persistent config directory.
pub fn config_dir() -> PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    PathBuf::from(home).join("Dragon").join("Translator")
}

// ---------------------------------------------------------------------------
// Self-extracting ZIP: find & extract data appended to exe
// ---------------------------------------------------------------------------

/// Look for ZIP EOCD signature (`PK\x05\x06`) in the last 64KB of the exe.
/// Returns the offset of the ZIP data if found.
#[cfg(not(debug_assertions))]
fn find_appended_zip(data: &[u8]) -> Option<u64> {
    let search_start = data.len().saturating_sub(65536);
    let window = &data[search_start..];
    // Scan backwards for PK\x05\x06 (ZIP End of Central Directory Record)
    for i in (0..window.len().saturating_sub(22)).rev() {
        if &window[i..i + 4] == b"PK\x05\x06" {
            // Verify: there must be a Local File Header before this
            let eocd_offset = (search_start + i) as u64;
            return Some(eocd_offset);
        }
    }
    None
}

/// Find the actual start of the appended ZIP by locating the first
/// `PK\x03\x04` (Local File Header) at or before the EOCD.
/// Returns (start_offset, total_zip_size).
#[cfg(not(debug_assertions))]
fn find_zip_bounds(data: &[u8], eocd_offset: u64) -> Option<(u64, u64)> {
    let eocd = eocd_offset as usize;
    let comment_len = u16::from_le_bytes([data[eocd + 20], data[eocd + 21]]) as usize;
    let zip_end = eocd + 22 + comment_len;
    // The EOCD's CD offset (bytes 16-19) points to Central Directory, which is
    // relative to the ZIP start. To find the ZIP start within the exe, scan from
    // the beginning for the first PK\x03\x04 (Local File Header) marker.
    // cd_offset from EOCD is relative to ZIP start, not helpful for absolute pos.
    let cd_offset_from_eocd = u32::from_le_bytes([
        data[eocd + 16], data[eocd + 17], data[eocd + 18], data[eocd + 19],
    ]) as u64;
    // Scan forward from beginning to find ZIP start
    for pos in 0..eocd {
        if data[pos..pos + 4] == *b"PK\x03\x04" {
            let _ = cd_offset_from_eocd; // preserved for reference
            return Some((pos as u64, (zip_end - pos) as u64));
        }
    }
    None
}

/// Extract the appended ZIP from the running exe into `dest_dir`.
#[cfg(not(debug_assertions))]
fn extract_appended_zip(dest_dir: &Path) -> Result<Vec<String>, String> {
    let exe_path =
        std::env::current_exe().map_err(|e| format!("无法获取 exe 路径: {}", e))?;

    let mut f = std::fs::File::open(&exe_path)
        .map_err(|e| format!("无法打开自身 exe: {}", e))?;
    let mut buf = Vec::new();
    f.read_to_end(&mut buf)
        .map_err(|e| format!("读取 exe 失败: {}", e))?;

    let eocd = find_appended_zip(&buf)
        .ok_or_else(|| "exe 中未找到附加的 ZIP 数据".to_string())?;

    let (zip_start, _zip_size) = find_zip_bounds(&buf, eocd)
        .ok_or_else(|| "无法确定 ZIP 数据边界".to_string())?;

    let zip_data = &buf[zip_start as usize..];
    let cursor = Cursor::new(zip_data.to_vec());

    let mut archive =
        zip::ZipArchive::new(cursor).map_err(|e| format!("解析 ZIP 失败: {}", e))?;

    let mut log: Vec<String> = Vec::new();
    for i in 0..archive.len() {
        let mut file = archive.by_index(i).map_err(|e| format!("读取 ZIP 条目失败: {}", e))?;
        let name = file.name().to_string();
        let dest = dest_dir.join(&name);

        if file.is_dir() {
            std::fs::create_dir_all(&dest).ok();
        } else {
            if let Some(parent) = dest.parent() {
                std::fs::create_dir_all(parent).ok();
            }
            let mut out = std::fs::File::create(&dest)
                .map_err(|e| format!("创建文件 {} 失败: {}", name, e))?;
            std::io::copy(&mut file, &mut out)
                .map_err(|e| format!("写入文件 {} 失败: {}", name, e))?;
            log.push(format!("{} (已释放)", name));
        }
    }

    Ok(log)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Return the raw content of `default-config.json`.
pub fn get_default_config_json() -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        let path = user_source_dir().join("default-config.json");
        if path.exists() {
            return std::fs::read_to_string(&path)
                .map_err(|e| format!("读取默认配置失败: {}", e));
        }
    }

    // Fallback: read from config dir
    let path = config_dir().join("default-config.json");
    if path.exists() {
        return std::fs::read_to_string(&path)
            .map_err(|e| format!("读取默认配置失败: {}", e));
    }

    Err("default-config.json 未找到".to_string())
}

/// Release runtime files into `~/Dragon/Translator/`.
///
/// Release strategy:
///   - If `<exe>/user/` folder exists alongside the exe → copy from there.
///   - Otherwise → try to extract from appended ZIP in the exe itself.
///   - Debug mode: copy from project `user/` source tree.
///   - `default-config.json` seeds `config.json` only when missing.
pub fn ensure_user_files() -> Result<Vec<String>, String> {
    let mut log: Vec<String> = Vec::new();
    let cfg_dir = config_dir();
    std::fs::create_dir_all(&cfg_dir).map_err(|e| e.to_string())?;

    // ---- Debug: copy from source tree ----
    #[cfg(debug_assertions)]
    {
        log.push("调试模式: runtime 文件源自开发目录 user/".to_string());
        copy_dir_if_missing(&user_source_dir(), &cfg_dir, &mut log)
            .map_err(|e| format!("复制 user/ 文件失败: {}", e))?;
    }

    // ---- Release: copy from exe-adjacent user/ or appended ZIP ----
    #[cfg(not(debug_assertions))]
    {
        let exe_user = std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.join("user")))
            .unwrap_or_else(|| PathBuf::from("user"));

        if exe_user.is_dir() {
            log.push("从 exe 同级 user/ 目录释放...".to_string());
            copy_dir_if_missing(&exe_user, &cfg_dir, &mut log)
                .map_err(|e| format!("复制 user/ 文件失败: {}", e))?;
        } else {
            log.push("从 exe 内嵌 ZIP 释放...".to_string());
            match extract_appended_zip(&cfg_dir) {
                Ok(zip_log) => log.extend(zip_log),
                Err(e) => {
                    // Non-fatal: files may already exist from a previous run
                    log.push(format!("ZIP 提取失败 (如果文件已存在可忽略): {}", e));
                }
            }
        }
    }

    // ---- Seed config.json (first run only) ----
    let config_json = cfg_dir.join("config.json");
    if !config_json.exists() {
        seed_config_json(&cfg_dir, &mut log);
    }

    Ok(log)
}

// ---- Helpers ----

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
            log.push(format!("{} (已释放)", path.file_name().unwrap().to_string_lossy()));
        }
    }
    Ok(())
}

/// Seed `config.json` from the canonical `default-config.json`.
fn seed_config_json(cfg_dir: &Path, log: &mut Vec<String>) {
    let raw = get_seed_json(cfg_dir);
    let Ok(raw) = raw else {
        log.push(format!("config.json 种子失败: {}", raw.unwrap_err()));
        return;
    };

    let config_json = cfg_dir.join("config.json");
    let wrapped = if raw.trim_start().starts_with("{\"app\"") {
        log.push("config.json (从已有 store 格式播种)".to_string());
        raw
    } else {
        log.push("config.json (首次创建)".to_string());
        format!("{{\"app\":{}}}", raw)
    };

    if let Err(e) = std::fs::write(&config_json, &wrapped) {
        log.push(format!("写入 config.json 失败: {}", e));
    }
}

/// Read default-config.json from the canonical source.
fn get_seed_json(cfg_dir: &Path) -> Result<String, String> {
    #[cfg(debug_assertions)]
    {
        let src = user_source_dir().join("default-config.json");
        if src.exists() {
            return std::fs::read_to_string(&src)
                .map_err(|e| format!("读取项目 default-config.json 失败: {}", e));
        }
    }
    let runtime = cfg_dir.join("default-config.json");
    if runtime.exists() {
        std::fs::read_to_string(&runtime)
            .map_err(|e| format!("读取 default-config.json 失败: {}", e))
    } else {
        Err("default-config.json 未找到".to_string())
    }
}
