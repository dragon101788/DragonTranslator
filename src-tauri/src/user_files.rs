use std::path::Path;

use crate::paths;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/// Return the raw content of `default-config.json`.
pub fn get_default_config_json() -> Result<String, String> {
    let runtime = paths::runtime_dir();
    let path = runtime.join("default-config.json");
    if path.exists() {
        return std::fs::read_to_string(&path)
            .map_err(|e| format!("读取默认配置失败: {}", e));
    }
    // Fallback: app dir (release mode both are same)
    let app = paths::app_dir();
    let path = app.join("default-config.json");
    if path.exists() {
        return std::fs::read_to_string(&path)
            .map_err(|e| format!("读取默认配置失败: {}", e));
    }
    Err("default-config.json 未找到".to_string())
}

/// Seed `config.json` from `default-config.json` (first run only, called from setup).
pub fn seed_config(app_dir: &Path) {
    let raw = match get_seed_json(app_dir) {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[Setup] config seed failed: {}", e);
            return;
        }
    };

    let config_json = app_dir.join("config.json");
    let wrapped = if raw.trim_start().starts_with("{\"app\"") {
        raw
    } else {
        format!("{{\"app\":{}}}", raw)
    };

    if let Err(e) = std::fs::write(&config_json, &wrapped) {
        eprintln!("[Setup] write config.json failed: {}", e);
    } else {
        println!("[Setup] config.json seeded");
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Read default-config.json from the runtime directory.
fn get_seed_json(app_dir: &Path) -> Result<String, String> {
    let runtime = paths::runtime_dir();
    let path = runtime.join("default-config.json");
    if path.exists() {
        return std::fs::read_to_string(&path)
            .map_err(|e| format!("读取 default-config.json 失败: {}", e));
    }
    // Fallback for release mode where runtime == app_dir
    let path = app_dir.join("default-config.json");
    if path.exists() {
        return std::fs::read_to_string(&path)
            .map_err(|e| format!("读取 default-config.json 失败: {}", e));
    }
    Err("default-config.json 未找到".to_string())
}
