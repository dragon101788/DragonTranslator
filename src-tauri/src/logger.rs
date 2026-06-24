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
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let path = format!("{}\\Dragon\\Translator\\logs\\{}.log", home.trim_end_matches('\\'), tag);
    if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
        let ts = SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = write!(f, "--- {} ---\n{}\n", ts, content.trim());
    }
}

/// Log directory path
pub fn log_dir() -> String {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    format!("{}\\Dragon\\Translator\\logs", home.trim_end_matches('\\'))
}
