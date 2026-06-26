use std::fs::OpenOptions;
use std::io::{Read, Write};
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::time::Duration;
use tauri::Emitter;

static LLAMA_PROCESS: Mutex<Option<Child>> = Mutex::new(None);

const LLAMAFILE_EXE: &str = "llamafile-vulkan.exe";
const DEFAULT_MODEL: &str = "qwen3-0.6b-q4_k_m.gguf";
const DEFAULT_PORT: u16 = 5158;

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

fn llamafile_path() -> String {
    // Try reading llamafile name from llama-config.json, fall back to default
    let exe_name = read_llama_config_llamafile().unwrap_or_else(|| LLAMAFILE_EXE.to_string());
    crate::paths::runtime_dir().join(&exe_name).to_string_lossy().to_string()
}

fn read_llama_config_llamafile() -> Option<String> {
    let config_path = crate::paths::runtime_dir().join("llama-config.json");
    let data = std::fs::read_to_string(&config_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&data).ok()?;
    json.get("llamafile")?.as_str().map(|s| s.to_string())
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

    let err_msg = format!(
        "本地模型启动超时 (端口 {}, 60s). 请检查 logs/llama.log",
        port
    );
    log(&err_msg);
    stop_process();
    Err(err_msg)
}

#[tauri::command]
pub fn stop_local_model() -> Result<String, String> {
    log("stop_local_model 被调用");
    stop_process();
    log("本地模型已停止");
    Ok("本地模型已停止".to_string())
}

#[tauri::command]
pub fn get_local_model_status(port: Option<u16>, model: Option<String>) -> Result<LocalModelStatus, String> {
    let port = port.unwrap_or(DEFAULT_PORT);
    let active_model = model.unwrap_or_default();
    Ok(LocalModelStatus {
        running: is_port_open(port),
        port,
        model: active_model,
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
// Model management (download / list / delete)
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
pub struct GgufModelInfo {
    pub name: String,
    pub size_bytes: u64,
}

#[tauri::command]
pub fn list_downloaded_models() -> Result<Vec<GgufModelInfo>, String> {
    let runtime = crate::paths::runtime_dir();
    let mut models: Vec<GgufModelInfo> = Vec::new();
    let dir = match std::fs::read_dir(&runtime) {
        Ok(d) => d,
        Err(_) => return Ok(models),
    };
    for entry in dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".gguf") { continue; }
        let path = runtime.join(&name);
        let size_bytes = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
        models.push(GgufModelInfo { name, size_bytes });
    }
    models.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(models)
}

#[tauri::command]
pub fn download_model(
    app_handle: tauri::AppHandle,
    url: String,
    filename: String,
) -> Result<String, String> {
    // Safety: only allow .gguf files
    if !filename.ends_with(".gguf") {
        return Err("文件名必须以 .gguf 结尾".to_string());
    }

    let runtime = crate::paths::runtime_dir();
    let dest = runtime.join(&filename);

    if dest.exists() {
        return Ok(format!("{} 已存在", filename));
    }

    log(&format!("开始下载模型: {} -> {}", url, filename));

    let resp = ureq::get(&url)
        .call()
        .map_err(|e| format!("下载请求失败: {}", e))?;

    let total: u64 = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);

    let mut reader = resp.into_reader();
    let mut data: Vec<u8> = if total > 0 {
        Vec::with_capacity(total as usize)
    } else {
        Vec::new()
    };
    let mut buf = [0u8; 65536]; // 64KB reads
    let mut downloaded: u64 = 0;
    let mut last_emit = 0u64;

    loop {
        let n = reader
            .read(&mut buf)
            .map_err(|e| format!("下载读取失败: {}", e))?;
        if n == 0 { break; }
        data.extend_from_slice(&buf[..n]);
        downloaded += n as u64;

        // Emit progress ~every 1% or 5MB
        if total > 0 && downloaded - last_emit > total / 100 {
            last_emit = downloaded;
            let _ = app_handle.emit("model_download_progress", serde_json::json!({
                "filename": filename,
                "downloaded": downloaded,
                "total": total,
            }));
        }
    }

    std::fs::write(&dest, &data).map_err(|e| format!("写入文件失败: {}", e))?;

    let size_mb = data.len() as f64 / 1_048_576.0;
    log(&format!("下载完成: {} ({:.1} MB)", filename, size_mb));

    let _ = app_handle.emit("model_download_complete", serde_json::json!({
        "filename": filename,
        "size_bytes": data.len(),
    }));
    Ok(format!("下载完成 {} ({:.1} MB)", filename, size_mb))
}

#[tauri::command]
pub fn delete_model(filename: String) -> Result<String, String> {
    if !filename.ends_with(".gguf") {
        return Err("只能删除 .gguf 文件".to_string());
    }
    let runtime = crate::paths::runtime_dir();
    let path = runtime.join(&filename);
    if !path.exists() {
        return Err(format!("模型不存在: {}", filename));
    }
    std::fs::remove_file(&path).map_err(|e| format!("删除失败: {}", e))?;
    log(&format!("已删除模型: {}", filename));
    Ok(format!("已删除 {}", filename))
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
