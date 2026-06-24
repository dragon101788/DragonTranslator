use std::path::PathBuf;

/// The app's root directory — where config.json lives.
///
/// Debug:   project root (e.g. `D:/IMPORTANT/rust/Dragon_translator/`)
/// Release: directory containing the running exe
pub fn app_dir() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
        manifest.join("..")
    }
    #[cfg(not(debug_assertions))]
    {
        std::env::current_exe()
            .ok()
            .and_then(|p| p.parent().map(|d| d.to_path_buf()))
            .unwrap_or_else(|| PathBuf::from("."))
    }
}

/// Directory containing runtime resource files (piper/, piper-voices/,
/// llamafile, default-config.json, etc.).
///
/// Debug:   `<project_root>/runtime/`
/// Release: same as `app_dir()` — files sit alongside the exe
pub fn runtime_dir() -> PathBuf {
    #[cfg(debug_assertions)]
    {
        app_dir().join("runtime")
    }
    #[cfg(not(debug_assertions))]
    {
        app_dir()
    }
}

/// Log output directory (`logs/`).
///
/// Debug:   `<project_root>/logs/`
/// Release: `<exe_dir>/logs/`
pub fn logs_dir() -> PathBuf {
    app_dir().join("logs")
}
