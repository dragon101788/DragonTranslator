use std::sync::Mutex;
use tauri::Manager;
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri_plugin_global_shortcut::{Code, GlobalShortcutExt, Modifiers, Shortcut, ShortcutEvent};

// Keep our internal state struct name distinct from the plugin's type
struct RegisteredShortcut(Mutex<Option<Shortcut>>);

/// Ensure only one instance runs. On Windows, uses a named mutex so the
/// second launch brings the existing window to front instead of starting
/// a new process.
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
        fn FindWindowW(
            lpClassName: *const u16,
            lpWindowName: *const u16,
        ) -> *mut std::ffi::c_void;
        fn SetForegroundWindow(hWnd: *mut std::ffi::c_void) -> i32;
        fn ShowWindow(hWnd: *mut std::ffi::c_void, nCmdShow: i32) -> i32;
    }

    const ERROR_ALREADY_EXISTS: u32 = 183;
    const SW_RESTORE: i32 = 9;

    let name: Vec<u16> = OsStr::new("DragonTec-Translator-SingleInstance")
        .encode_wide()
        .chain(std::iter::once(0))
        .collect();

    unsafe {
        let handle = CreateMutexW(std::ptr::null(), 0, name.as_ptr());
        if handle.is_null() {
            return true;
        }
        if GetLastError() == ERROR_ALREADY_EXISTS {
            CloseHandle(handle);
            let title: Vec<u16> = OsStr::new("龙腾翻译")
                .encode_wide()
                .chain(std::iter::once(0))
                .collect();
            let hwnd = FindWindowW(std::ptr::null(), title.as_ptr());
            if !hwnd.is_null() {
                ShowWindow(hwnd, SW_RESTORE);
                SetForegroundWindow(hwnd);
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
    // Prevent multiple instances
    if cfg!(windows) && !ensure_single_instance() {
        std::process::exit(0);
    }

    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(
            tauri_plugin_global_shortcut::Builder::default()
                .with_handler(|app, shortcut, event: ShortcutEvent| {
                    // Only respond to Pressed — the handler fires on
                    // both Pressed and Released, and we don't want to
                    // toggle the window twice.
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
                                if window.is_visible().unwrap_or(false) {
                                    let _ = window.hide();
                                } else {
                                    let _ = window.show();
                                    let _ = window.set_focus();
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
        .invoke_handler(tauri::generate_handler![configure_shortcut])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
