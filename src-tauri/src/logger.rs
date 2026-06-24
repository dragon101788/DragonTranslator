use std::fs::OpenOptions;
use std::io::Write;
use std::sync::atomic::{AtomicU8, Ordering};
use std::sync::Mutex;
use std::time::SystemTime;

// 0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=OFF
static LOG_LEVEL: AtomicU8 = AtomicU8::new(1); // default: INFO
static LOG_INITIALIZED: Mutex<bool> = Mutex::new(false);

pub fn set_level(level: u8) {
    LOG_LEVEL.store(level.min(4), Ordering::Relaxed);
}

/// Initialize log directory. Called once at startup.
pub fn init_logs(log_dir: &str) {
    let mut init = LOG_INITIALIZED
        .lock()
        .unwrap_or_else(|e| e.into_inner());
    if *init { return; }
    match std::fs::create_dir_all(log_dir) {
        Ok(()) => {}
        Err(e) => {
            eprintln!(
                "[Logger] WARNING: Cannot create log dir '{}': {}",
                log_dir, e
            );
        }
    }
    *init = true;
}

/// Main log function — filters by level, writes to file and prints to console.
/// Falls back to stderr if file write fails.
pub fn log(level: u8, tag: &str, msg: &str) {
    if level < LOG_LEVEL.load(Ordering::Relaxed) {
        return;
    }
    let level_str = match level {
        0 => "DEBUG",
        1 => "INFO",
        2 => "WARN",
        3 => "ERROR",
        _ => "?",
    };
    let ts = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let line = format!("[{}] [{}] {}\n", ts, level_str, msg);
    // Always print to stdout so terminal/devtools always show logs
    print!("{}", line);

    let dir = crate::paths::logs_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("{}.log", tag));
    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(mut f) => {
            if let Err(e) = f.write_all(line.as_bytes()) {
                eprintln!(
                    "[Logger] WARNING: Cannot write to '{}': {}",
                    path.display(),
                    e
                );
            }
        }
        Err(e) => {
            eprintln!(
                "[Logger] WARNING: Cannot open '{}': {}",
                path.display(),
                e
            );
        }
    }
}

/// Write raw subprocess stderr to a log file (always, regardless of level).
pub fn write_raw(tag: &str, content: &str) {
    let dir = crate::paths::logs_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("{}.log", tag));
    match OpenOptions::new().create(true).append(true).open(&path) {
        Ok(mut f) => {
            let ts = SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs();
            let _ = write!(f, "--- {} ---\n{}\n", ts, content.trim());
        }
        Err(e) => {
            eprintln!(
                "[Logger] WARNING: Cannot write raw to '{}': {}",
                path.display(),
                e
            );
        }
    }
}
