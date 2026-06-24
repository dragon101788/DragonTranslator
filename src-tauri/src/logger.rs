use std::fs::OpenOptions;
use std::io::Write;
use std::sync::Mutex;
use std::time::SystemTime;

static LOG_INITIALIZED: Mutex<bool> = Mutex::new(false);

/// Initialize log directory. Called once at startup.
pub fn init_logs(log_dir: &str) {
    let mut init = LOG_INITIALIZED.lock().unwrap();
    if *init { return; }
    let _ = std::fs::create_dir_all(log_dir);
    *init = true;
}

/// Append a line to a log file (and print to console).
#[allow(dead_code)]
pub fn log(tag: &str, msg: &str) {
    let ts = SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let line = format!("[{}] [{}] {}\n", ts, tag, msg);
    print!("{}", line);
}

/// Write raw bytes (e.g. subprocess stderr) to a log file.
pub fn write_raw(tag: &str, content: &str) {
    let dir = crate::paths::logs_dir();
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join(format!("{}.log", tag));
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let ts = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = write!(f, "--- {} ---\n{}\n", ts, content.trim());
    }
}
