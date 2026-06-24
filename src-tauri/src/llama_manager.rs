use std::fs::OpenOptions;
use std::io::Write;
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;

static LLAMA_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

const LLAMAFILE_EXE: &str = "llamafile-vulkan.exe";
const DEFAULT_MODEL: &str = "qwen3-0.6b-q4_k_m.gguf";
const DEFAULT_PORT: u16 = 5158;

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

fn llamafile_path() -> String {
    crate::paths::runtime_dir().join(LLAMAFILE_EXE).to_string_lossy().to_string()
}

fn log_file() -> String {
    let dir = crate::paths::logs_dir();
    let _ = std::fs::create_dir_all(&dir);
    dir.join("llama.log").to_string_lossy().to_string()
}

// ---------------------------------------------------------------------------
// Logging helper
// ---------------------------------------------------------------------------

fn log(msg: &str) {
    println!("[LocalModel] {}", msg);
    if let Ok(mut f) = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file())
    {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_secs();
        let _ = writeln!(f, "[{}] {}", ts, msg);
    }
}

// ---------------------------------------------------------------------------
// Process management
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn start_local_model(port: Option<u16>, model: Option<String>) -> Result<String, String> {
    let port = port.unwrap_or(DEFAULT_PORT);

    log(&format!("start_local_model 被调用, port={}, model={:?}", port, model));

    // Check if already running
    if is_port_open(port) {
        log("端口已开放，模型已在运行");
        return Ok(format!("本地模型已在端口 {} 运行", port));
    }

    let exe = llamafile_path();
    let model_name = model.unwrap_or_else(|| DEFAULT_MODEL.to_string());
    let model = if std::path::Path::new(&model_name).is_absolute() {
        model_name
    } else {
        format!("{}\\{}", crate::paths::runtime_dir().to_string_lossy(), model_name)
    };

    log(&format!("llamafile 路径: {}", exe));
    log(&format!("模型路径: {}", model));

    if !std::path::Path::new(&exe).exists() {
        log(&format!("错误: llamafile 不存在: {}", exe));
        return Err(format!("找不到 llamafile: {}", exe));
    }
    if !std::path::Path::new(&model).exists() {
        log(&format!("错误: 模型文件不存在: {}", model));
        return Err(format!("找不到模型文件: {}", model));
    }

    // Kill any leftover process
    stop_process();

    // Build args
    let args = [
        "-m",
        &model,
        "--port",
        &port.to_string(),
        "--host",
        "127.0.0.1",
    ];
    log(&format!("启动命令: {} {:?}", &exe, &args));

    // Open log file for llamafile's stderr
    let err_log = OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_file())
        .ok();

    let child = Command::new(&exe)
        .args(&args)
        .stdout(Stdio::null())
        .stderr(err_log.map(|f| f.into()).unwrap_or(Stdio::null()))
        .creation_flags(0x08000000) // CREATE_NO_WINDOW
        .spawn()
        .map_err(|e| {
            let msg = format!("启动 llamafile 失败: {}", e);
            log(&msg);
            msg
        })?;

    let pid = child.id();
    log(&format!("进程已启动, PID={}", pid));

    *LLAMA_PROCESS.lock().map_err(|e| e.to_string())? = Some(child);

    // Wait up to 60s for the server to become ready (model loading is slow)
    for i in 0..240 {
        std::thread::sleep(Duration::from_millis(250));

        // Check if child is still alive
        {
            let mut guard = LLAMA_PROCESS.lock().map_err(|e| e.to_string())?;
            if let Some(ref mut child) = *guard {
                if let Ok(Some(status)) = child.try_wait() {
                    log(&format!(
                        "进程已退出 (exit code: {:?}), 可能启动失败",
                        status.code()
                    ));
                    *guard = None;
                    return Err(format!(
                        "llamafile 进程意外退出 (exit code: {:?}), 请检查 logs/llama.log",
                        status.code()
                    ));
                }
            } else {
                log("进程句柄丢失");
                return Err("进程句柄丢失".to_string());
            }
        }

        if is_port_open(port) {
            log(&format!("模型就绪, 耗时约 {}s", i as f64 * 0.25));
            return Ok(format!("本地模型已启动 (端口 {})", port));
        }

        // Log progress every 10 seconds
        if i % 40 == 39 {
            log(&format!("等待中... 已 {}s", (i + 1) as f64 * 0.25));
        }
    }

    log("超时: 60s 内端口未开放");
    Ok(format!(
        "本地模型启动超时 (端口 {}), 请检查 logs/llama.log",
        port
    ))
}

#[tauri::command]
pub fn stop_local_model() -> Result<String, String> {
    log("stop_local_model 被调用");
    stop_process();
    log("本地模型已停止");
    Ok("本地模型已停止".to_string())
}

#[tauri::command]
pub fn get_local_model_status(port: Option<u16>) -> Result<LocalModelStatus, String> {
    let port = port.unwrap_or(DEFAULT_PORT);
    Ok(LocalModelStatus {
        running: is_port_open(port),
        port,
        model: DEFAULT_MODEL.to_string(),
        llamafile: LLAMAFILE_EXE.to_string(),
    })
}

#[derive(serde::Serialize, Clone)]
pub struct LocalModelStatus {
    pub running: bool,
    pub port: u16,
    pub model: String,
    pub llamafile: String,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn is_port_open(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(500),
    )
    .is_ok()
}

fn stop_process() {
    if let Ok(mut guard) = LLAMA_PROCESS.lock() {
        if let Some(ref mut child) = *guard {
            let pid = child.id();
            log(&format!("正在终止进程 PID={:?}...", pid));
            let _ = child.kill();
            let _ = child.wait();
            log(&format!("进程已终止"));
        }
        *guard = None;
    }
}
