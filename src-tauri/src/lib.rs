mod user_files;
mod paths;
mod llama_manager;
mod tts;
mod logger;

use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

// Keep our internal state struct name distinct from the plugin's type
struct RegisteredShortcut(Mutex<Option<Shortcut>>);

/// Ensure only one instance runs. On Windows, uses a named mutex to detect an
/// existing instance, then signals a named event so the first instance can
/// activate its window via Tauri's own APIs (avoiding raw Win32 state
/// manipulation that would desync Tauri/winit's window state).
#[cfg(windows)]
fn ensure_single_instance() -> bool {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn CreateMutexW(
            lpMutexAttributes: *const std::ffi::c_void,
            bInitialOwner: i32,
            lpName: *const u16,
        ) -> *mut std::ffi::c_void;
        fn CloseHandle(hObject: *mut std::ffi::c_void) -> i32;
        fn GetLastError() -> u32;
        fn CreateEventW(
            lpEventAttributes: *const std::ffi::c_void,
            bManualReset: i32,
            bInitialState: i32,
            lpName: *const u16,
        ) -> *mut std::ffi::c_void;
        fn SetEvent(hEvent: *mut std::ffi::c_void) -> i32;
    }

    const ERROR_ALREADY_EXISTS: u32 = 183;

    let mutex_name: Vec<u16> = OsStr::new("DragonTec-Translator-SingleInstance")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();
    let event_name: Vec<u16> = OsStr::new("DragonTec-Translator-ActivateEvent")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let handle = CreateMutexW(std::ptr::null(), 0, mutex_name.as_ptr());
        if handle.is_null() {
            return true;
        }
        if GetLastError() == ERROR_ALREADY_EXISTS {
            CloseHandle(handle);
            // Signal the existing instance to activate itself via Tauri APIs
            let evt = CreateEventW(std::ptr::null(), 1, 0, event_name.as_ptr());
            if !evt.is_null() {
                SetEvent(evt);
                CloseHandle(evt);
            }
            return false;
        }
    }
    true
}

#[cfg(not(windows))]
fn ensure_single_instance() -> bool {
    true
}

/// Listens on a named event for activation requests from a second instance.
/// Uses Tauri's own window API so the internal window state stays consistent.
#[cfg(windows)]
fn spawn_activate_listener(handle: tauri::AppHandle) {
    use std::ffi::OsStr;
    use std::os::windows::ffi::OsStrExt;

    extern "system" {
        fn CreateEventW(
            lpEventAttributes: *const std::ffi::c_void,
            bManualReset: i32,
            bInitialState: i32,
            lpName: *const u16,
        ) -> *mut std::ffi::c_void;
        fn WaitForSingleObject(
            hHandle: *mut std::ffi::c_void,
            dwMilliseconds: u32,
        ) -> u32;
        fn ResetEvent(hEvent: *mut std::ffi::c_void) -> i32;
    }

    let event_name: Vec<u16> = OsStr::new("DragonTec-Translator-ActivateEvent")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    std::thread::spawn(move || unsafe {
        let evt = CreateEventW(std::ptr::null(), 1, 0, event_name.as_ptr());
        if evt.is_null() {
            return;
        }
        loop {
            WaitForSingleObject(evt, std::u32::MAX);
            if let Some(window) = handle.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
            ResetEvent(evt);
        }
    });
}

#[cfg(not(windows))]
fn spawn_activate_listener(_handle: tauri::AppHandle) {}

fn parse_modifiers(mods: &[String]) -> Modifiers {
    let mut result = Modifiers::empty();
    for m in mods {
        match m.to_lowercase().as_str() {
            "ctrl" => result |= Modifiers::CONTROL,
            "alt" => result |= Modifiers::ALT,
            "shift" => result |= Modifiers::SHIFT,
            "meta" | "win" | "super" => result |= Modifiers::SUPER,
            _ => {}
        }
    }
    result
}

fn parse_code(key: &str) -> Result<Code, String> {
    match key.to_uppercase().as_str() {
        "A" => Ok(Code::KeyA),
        "B" => Ok(Code::KeyB),
        "C" => Ok(Code::KeyC),
        "D" => Ok(Code::KeyD),
        "E" => Ok(Code::KeyE),
        "F" => Ok(Code::KeyF),
        "G" => Ok(Code::KeyG),
        "H" => Ok(Code::KeyH),
        "I" => Ok(Code::KeyI),
        "J" => Ok(Code::KeyJ),
        "K" => Ok(Code::KeyK),
        "L" => Ok(Code::KeyL),
        "M" => Ok(Code::KeyM),
        "N" => Ok(Code::KeyN),
        "O" => Ok(Code::KeyO),
        "P" => Ok(Code::KeyP),
        "Q" => Ok(Code::KeyQ),
        "R" => Ok(Code::KeyR),
        "S" => Ok(Code::KeyS),
        "T" => Ok(Code::KeyT),
        "U" => Ok(Code::KeyU),
        "V" => Ok(Code::KeyV),
        "W" => Ok(Code::KeyW),
        "X" => Ok(Code::KeyX),
        "Y" => Ok(Code::KeyY),
        "Z" => Ok(Code::KeyZ),
        "SPACE" => Ok(Code::Space),
        "ENTER" => Ok(Code::NumpadEnter),
        "ESCAPE" | "ESC" => Ok(Code::Escape),
        "TAB" => Ok(Code::Tab),
        "F1" => Ok(Code::F1),
        "F2" => Ok(Code::F2),
        "F3" => Ok(Code::F3),
        "F4" => Ok(Code::F4),
        "F5" => Ok(Code::F5),
        "F6" => Ok(Code::F6),
        "F7" => Ok(Code::F7),
        "F8" => Ok(Code::F8),
        "F9" => Ok(Code::F9),
        "F10" => Ok(Code::F10),
        "F11" => Ok(Code::F11),
        "F12" => Ok(Code::F12),
        "0" => Ok(Code::Digit0),
        "1" => Ok(Code::Digit1),
        "2" => Ok(Code::Digit2),
        "3" => Ok(Code::Digit3),
        "4" => Ok(Code::Digit4),
        "5" => Ok(Code::Digit5),
        "6" => Ok(Code::Digit6),
        "7" => Ok(Code::Digit7),
        "8" => Ok(Code::Digit8),
        "9" => Ok(Code::Digit9),
        _ => Err(format!("不支持的按键: {}", key)),
    }
}

/// Returns the app directory path (for config file, etc.).
#[tauri::command]
fn get_app_dir() -> Result<String, String> {
    Ok(paths::app_dir().to_string_lossy().to_string())
}

/// Read default-config.json from runtime directory.
#[tauri::command]
fn get_default_config() -> Result<String, String> {
    user_files::get_default_config_json()
}

/// Append a line to logs/frontend.log
#[tauri::command]
fn log_frontend(level: String, message: String) {
    let lvl = match level.as_str() {
        "debug" => 0, "info" => 1, "warn" => 2, "error" => 3, _ => 1,
    };
    logger::log(lvl, "frontend", &message);
}

/// Set global log level (0=DEBUG, 1=INFO, 2=WARN, 3=ERROR, 4=OFF)
#[tauri::command]
fn set_log_level(level: u8) {
    logger::set_level(level);
}

/// Open the app directory in File Explorer.
#[tauri::command]
fn open_user_dir() -> Result<(), String> {
    let dir = paths::app_dir();
    let _ = std::fs::create_dir_all(&dir);
    std::process::Command::new("explorer")
        .arg(dir.to_string_lossy().to_string())
        .spawn()
        .map_err(|e| format!("无法打开目录: {}", e))?;
    Ok(())
}

#[tauri::command]
fn configure_shortcut(
    app: tauri::AppHandle,
    state: tauri::State<RegisteredShortcut>,
    modifiers: Vec<String>,
    key: String,
) -> Result<(), String> {
    let shortcut = app.global_shortcut();
    let mods = parse_modifiers(&modifiers);
    let code = parse_code(&key)?;
    let new_shortcut = Shortcut::new(Some(mods), code);

    // If the same shortcut is already registered, skip
    {
        let guard = state.0.lock().map_err(|e| e.to_string())?;
        if let Some(ref existing) = *guard {
            if existing.eq(&new_shortcut) {
                return Ok(());
            }
        }
    }

    // Unregister previous shortcut
    if let Some(old) = state.0.lock().map_err(|e| e.to_string())?.take() {
        let _ = shortcut.unregister(old);
    }

    // Unregister any leftover with the same key (shouldn't happen, but safe)
    let _ = shortcut.unregister(new_shortcut.clone());

    shortcut
        .register(new_shortcut.clone())
        .map_err(|e| format!("注册快捷键失败: {}", e))?;

    *state.0.lock().map_err(|e| e.to_string())? = Some(new_shortcut);
    println!("[Shortcut] 快捷键已更新: {:?}+{:?}", modifiers, key);
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Prevent multiple instances — exit early if another instance is running
    if cfg!(windows) && !ensure_single_instance() {
        let _ = llama_manager::stop_local_model();
        return;
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::default()
                .with_handler(|app, shortcut, event: ShortcutEvent| {
                    use tauri_plugin_global_shortcut::ShortcutState as GShortcutState;
                    if event.state != GShortcutState::Pressed {
                        return;
                    }
                    let active = app
                        .state::<RegisteredShortcut>()
                        .0
                        .lock()
                        .unwrap()
                        .clone();
                    if let Some(ref active) = active {
                        if shortcut.eq(active) {
                            if let Some(window) = app.get_webview_window("main") {
                                let is_visible = window.is_visible().unwrap_or(false);
                                let is_minimized = window.is_minimized().unwrap_or(false);
                                if is_visible && !is_minimized {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
                                    let _ = window.unminimize();
                                }
                            }
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            // Manage shortcut state (actual registration happens on the
            // frontend side via configure_shortcut during startup)
            app.manage(RegisteredShortcut(Mutex::new(None)));

            // Start the single-instance activation listener (Windows only)
            spawn_activate_listener(app.handle().clone());

            // Initialize log directory
            let logs = paths::logs_dir();
            let _ = std::fs::create_dir_all(&logs);
            logger::init_logs(&logs.to_string_lossy());
            logger::log(1, "app", &format!("App started, logs at {}", logs.display()));

            // Seed config.json from default-config.json on first run
            let app_root = paths::app_dir();
            let config_path = app_root.join("config.json");
            if !config_path.exists() {
                user_files::seed_config(&app_root);
            }

            // ---- System tray ----
            let show_item = MenuItemBuilder::with_id("show", "显示窗口").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "退出").build(app)?;
            let menu = MenuBuilder::new(app)
                .item(&show_item)
                .item(&quit_item)
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("龙图腾翻译")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "quit" => {
                        let _ = llama_manager::stop_local_model();
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        if let Some(w) = tray.app_handle().get_webview_window("main") {
                            if w.is_visible().unwrap_or(false) {
                                let _ = w.hide();
                            } else {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                    }
                })
                .build(app)?;

            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            configure_shortcut,
            open_user_dir,
            get_default_config,
            get_app_dir,
            llama_manager::start_local_model,
            llama_manager::stop_local_model,
            llama_manager::get_local_model_status,
            tts::tts_speak,
            tts::tts_stop,
            tts::tts_get_voices,
            tts::tts_get_voices_dir,
            tts::tts_open_voices_dir,
            tts::tts_download_voice,
            tts::tts_delete_voice,
            log_frontend,
            set_log_level,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, event| {
            if let tauri::RunEvent::Exit = event {
                let _ = llama_manager::stop_local_model();
            }
        });
}
