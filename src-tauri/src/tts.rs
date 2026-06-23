use std::fs;
use std::io::{Read, Write};
use std::os::windows::process::CommandExt;
use std::process::{Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use rodio::{OutputStream, Sink};
use serde::Deserialize;

// ---------------------------------------------------------------------------
// Cancel token for in-progress playback
// ---------------------------------------------------------------------------

static CANCEL: Mutex<Option<Arc<AtomicBool>>> = Mutex::new(None);

// ---------------------------------------------------------------------------
// Voice config (parsed from .onnx.json)
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
struct VoiceLanguage {
    code: String,
    #[allow(dead_code)]
    family: Option<String>,
    #[allow(dead_code)]
    region: Option<String>,
    #[allow(dead_code)]
    name_native: Option<String>,
    #[allow(dead_code)]
    name_english: Option<String>,
    #[allow(dead_code)]
    country_english: Option<String>,
}

#[derive(Deserialize)]
struct VoiceConfig {
    audio: VoiceAudio,
    language: Option<VoiceLanguage>,
    #[allow(dead_code)]
    quality: Option<String>,
}

#[derive(Deserialize)]
struct VoiceAudio {
    sample_rate: u32,
}

// ---------------------------------------------------------------------------
// Path resolution
// ---------------------------------------------------------------------------

fn user_files_dir() -> String {
    // Always use ~/Dragon/Translator/ (ensure_user_files copies from source tree at startup)
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    format!("{}\\Dragon\\Translator", home.trim_end_matches('\\'))
}

fn piper_exe_path() -> String {
    format!("{}\\piper\\piper.exe", user_files_dir())
}

fn piper_voices_dir() -> String {
    format!("{}\\piper-voices", user_files_dir())
}

// ---------------------------------------------------------------------------
// Lang -> voice mapping
// ---------------------------------------------------------------------------

/// preferred_voice: exact voice name (e.g. "zh_CN-huayan-medium"), takes priority
fn find_voice(lang: &str, preferred_voice: Option<&str>) -> Result<(String, u32), String> {
    let voices_dir = piper_voices_dir();
    let voices = list_available_voices();

    println!("[TTS] find_voice: lang={} preferred={:?} dir={}", lang, preferred_voice, voices_dir);

    // If user picked a specific voice, use it directly
    if let Some(vname) = preferred_voice {
        if let Some(v) = voices.iter().find(|v| v.name == vname) {
            let model_path = format!("{}\\{}.onnx", voices_dir, v.name);
            println!("[TTS] find_voice: preferred -> {} @ {}Hz", model_path, v.sample_rate);
            return Ok((model_path, v.sample_rate));
        }
        // fall through to lang-based search
    }

    // "auto" or empty -> look for matching lang in user prefs, fallback zh_CN
    if lang.is_empty() || lang == "auto" {
        if voices.is_empty() {
            return Err("No voices installed. Please download a voice model.".to_string());
        }
        let target = voices.iter().find(|v| v.lang == "zh_CN")
            .unwrap_or(&voices[0]);
        let model_path = format!("{}\\{}.onnx", voices_dir, target.name);
        let sample_rate = target.sample_rate;
        println!("[TTS] find_voice: auto -> {} @ {}Hz", model_path, sample_rate);
        return Ok((model_path, sample_rate));
    }


    let candidates: Vec<&str> = match lang {
        "zh" => vec!["zh_CN", "zh"],
        "en" => vec!["en_US", "en_GB", "en"],
        "ja" => vec!["ja_JP", "ja"],
        "ko" => vec!["ko_KR", "ko"],
        "fr" => vec!["fr_FR", "fr"],
        "de" => vec!["de_DE", "de"],
        "es" => vec!["es_ES", "es"],
        "ru" => vec!["ru_RU", "ru"],
        "pt" => vec!["pt_BR", "pt_PT", "pt"],
        "ar" => vec!["ar_SA", "ar"],
        "th" => vec!["th_TH", "th"],
        "vi" => vec!["vi_VN", "vi"],
        _ => vec![lang],
    };
    println!("[TTS] find_voice: candidates={:?}", candidates);

    for prefix in &candidates {
        let entries = match fs::read_dir(&voices_dir) {
            Ok(d) => d,
            Err(e) => {
                eprintln!("[TTS] find_voice: read_dir error: {}", e);
                continue;
            }
        };
        for entry in entries.flatten() {
            let fname = entry.file_name().to_string_lossy().to_string();
            if fname.starts_with(&format!("{}_", prefix))
                && fname.ends_with(".onnx")
                && !fname.ends_with(".onnx.json")
            {
                let model_path = format!("{}\\{}", voices_dir, fname);
                let sample_rate = read_sample_rate(&model_path)?;
                println!("[TTS] find_voice: found {} @ {}Hz", model_path, sample_rate);
                return Ok((model_path, sample_rate));
            }
        }
    }

    let available = list_available_voices();
    let hint = if available.is_empty() {
        "piper-voices/ is empty, please download voice models".to_string()
    } else {
        format!(
            "Available: {:?}",
            available.iter().map(|v| v.name.clone()).collect::<Vec<_>>()
        )
    };
    let err = format!("No voice found for language '{}'. {}", lang, hint);
    eprintln!("[TTS] find_voice: {}", err);
    Err(err)
}

fn read_sample_rate(model_path: &str) -> Result<u32, String> {
    let json_path = format!("{}.json", model_path);
    let content = fs::read_to_string(&json_path)
        .map_err(|e| format!("Cannot read {}: {}", json_path, e))?;
    let config: VoiceConfig = serde_json::from_str(&content)
        .map_err(|e| format!("Parse {} failed: {}", json_path, e))?;
    Ok(config.audio.sample_rate)
}

// ---------------------------------------------------------------------------
// Voice discovery
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
pub struct VoiceInfo {
    pub name: String,
    pub lang: String,
    pub quality: String,
    pub size_mb: f64,
    pub sample_rate: u32,
}

fn list_available_voices() -> Vec<VoiceInfo> {
    let voices_dir = piper_voices_dir();
    let mut voices: Vec<VoiceInfo> = Vec::new();
    let dir = match fs::read_dir(&voices_dir) {
        Ok(d) => d,
        Err(_) => return voices,
    };

    for entry in dir.flatten() {
        let name = entry.file_name().to_string_lossy().to_string();
        if !name.ends_with(".onnx") || name.ends_with(".onnx.json") {
            continue;
        }
        let model_path = format!("{}\\{}", voices_dir, name);
        let size_bytes = fs::metadata(&model_path).map(|m| m.len()).unwrap_or(0);
        let size_mb = size_bytes as f64 / (1024.0 * 1024.0);
        let base_name = name.trim_end_matches(".onnx").to_string();
        let json_path = format!("{}.json", model_path);

        let (lang, quality, sample_rate) =
            if let Ok(content) = fs::read_to_string(&json_path) {
                if let Ok(config) = serde_json::from_str::<VoiceConfig>(&content) {
                    (
                        config.language.map(|l| l.code).unwrap_or_else(|| "?".to_string()),
                        config.quality.unwrap_or_else(|| "?".to_string()),
                        config.audio.sample_rate,
                    )
                } else {
                    ("?".to_string(), "?".to_string(), 22050)
                }
            } else {
                ("?".to_string(), "?".to_string(), 22050)
            };

        voices.push(VoiceInfo {
            name: base_name,
            lang,
            quality,
            size_mb: (size_mb * 10.0).round() / 10.0,
            sample_rate,
        });
    }
    voices.sort_by(|a, b| a.lang.cmp(&b.lang).then(a.name.cmp(&b.name)));
    voices
}

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub fn tts_speak(text: String, lang: String, voice: Option<String>) -> Result<(), String> {
    println!("[TTS] ========================================");
    println!("[TTS] tts_speak START lang={} text_len={}", lang, text.len());
    let preview: String = text.chars().take(50).collect();
    println!("[TTS] text preview: {}", preview);

    if text.trim().is_empty() {
        println!("[TTS] empty text, skipping");
        return Ok(());
    }

    // 1. Cancel any in-progress playback
    println!("[TTS] step1: stopping previous playback...");
    tts_stop_inner();
    std::thread::sleep(Duration::from_millis(50));

    // 2. Find voice
    println!("[TTS] step2: finding voice for lang={}", lang);
    let (model_path, sample_rate) = find_voice(&lang, voice.as_deref())?;

    let piper_exe = piper_exe_path();
    println!("[TTS] step3: piper_exe={}", piper_exe);
    println!("[TTS] step3: model_path={}", model_path);

    if !std::path::Path::new(&piper_exe).exists() {
        let err = format!("piper.exe not found: {}", piper_exe);
        eprintln!("[TTS] ERROR: {}", err);
        return Err(err);
    }
    if !std::path::Path::new(&model_path).exists() {
        let err = format!("Voice model not found: {}", model_path);
        eprintln!("[TTS] ERROR: {}", err);
        return Err(err);
    }

    println!("[TTS] step4: spawning piper (sr={}Hz)...", sample_rate);

    // 3. Start piper -- capture stderr for diagnostics
    let mut child = Command::new(&piper_exe)
        .arg("-m")
        .arg(&model_path)
        .arg("--output_raw")
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())   // <-- capture stderr instead of discarding
        .creation_flags(0x08000000)
        .spawn()
        .map_err(|e| {
            let err = format!("Failed to start piper: {}", e);
            eprintln!("[TTS] ERROR: {}", err);
            err
        })?;

    println!("[TTS] step5: writing {} bytes to piper stdin...", text.len());
    // 4. Write text to stdin, then close (EOF triggers synthesis)
    {
        let mut stdin = child.stdin.take().ok_or("Cannot open piper stdin")?;
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| format!("Failed to write piper stdin: {}", e))?;
    }
    println!("[TTS] step5: stdin closed (EOF sent)");

    // 5. Read all PCM from stdout
    println!("[TTS] step6: reading PCM from piper stdout...");
    let mut stdout = child.stdout.take().ok_or("Cannot open piper stdout")?;
    let mut all_pcm: Vec<u8> = Vec::new();
    stdout
        .read_to_end(&mut all_pcm)
        .map_err(|e| format!("Failed to read piper output: {}", e))?;
    println!("[TTS] step6: read {} bytes of PCM", all_pcm.len());

    // 6. Read stderr from piper
    let mut stderr_output = String::new();
    if let Some(ref mut stderr) = child.stderr {
        stderr.read_to_string(&mut stderr_output).ok();
        if !stderr_output.is_empty() {
            eprintln!("[TTS] piper stderr:\n{}", stderr_output.trim());
        }
    }

    // 7. Wait for piper
    let status = child
        .wait()
        .map_err(|e| format!("Failed to wait for piper: {}", e))?;
    let exit_code = status.code();
    println!("[TTS] step7: piper exited with code={:?}", exit_code);
    if !status.success() {
        let err = format!(
            "piper exited with error (code: {:?}) stderr: {}",
            exit_code,
            stderr_output.trim()
        );
        eprintln!("[TTS] ERROR: {}", err);
        return Err(err);
    }

    // 8. Convert bytes -> i16 samples
    if all_pcm.len() < 2 {
        println!("[TTS] WARNING: PCM data too short ({} bytes), no audio", all_pcm.len());
        return Ok(());
    }
    let usable = all_pcm.len() - (all_pcm.len() % 2);
    let samples: Vec<i16> = all_pcm[..usable]
        .chunks_exact(2)
        .map(|c| i16::from_le_bytes([c[0], c[1]]))
        .collect();

    let duration_ms = (samples.len() as f64 / sample_rate as f64 * 1000.0) as u32;
    println!(
        "[TTS] step8: {} samples, {}ms, {}Hz mono i16",
        samples.len(), duration_ms, sample_rate
    );

    // 9. Audio output
    println!("[TTS] step9: opening audio device...");
    let (_stream, handle) = OutputStream::try_default()
        .map_err(|e| {
            let err = format!("Failed to open audio device: {}", e);
            eprintln!("[TTS] ERROR: {}", err);
            err
        })?;
    let sink = Sink::try_new(&handle)
        .map_err(|e| {
            let err = format!("Failed to create audio sink: {}", e);
            eprintln!("[TTS] ERROR: {}", err);
            err
        })?;

    // 10. Cancel token
    let cancel = Arc::new(AtomicBool::new(false));
    {
        let mut guard = CANCEL.lock().map_err(|e| e.to_string())?;
        *guard = Some(Arc::clone(&cancel));
    }

    // 11. Play
    println!("[TTS] step10: starting playback...");
    let source = rodio::buffer::SamplesBuffer::new(1, sample_rate, samples);
    sink.append(source);

    while !sink.empty() {
        if cancel.load(Ordering::Relaxed) {
            drop(sink);
            drop(_stream);
            println!("[TTS] playback CANCELLED");
            if let Ok(mut guard) = CANCEL.lock() { *guard = None; }
            return Ok(());
        }
        std::thread::sleep(Duration::from_millis(30));
    }

    // Natural completion
    let _ = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        sink.sleep_until_end();
    }));
    drop(sink);
    drop(_stream);

    if let Ok(mut guard) = CANCEL.lock() { *guard = None; }
    println!("[TTS] playback DONE ({}ms duration)", duration_ms);
    println!("[TTS] ========================================");
    Ok(())
}

#[tauri::command]
pub fn tts_stop() -> Result<(), String> {
    println!("[TTS] tts_stop called");
    tts_stop_inner();
    Ok(())
}

#[tauri::command]
pub fn tts_get_voices() -> Result<Vec<VoiceInfo>, String> {
    println!("[TTS] tts_get_voices called");
    let voices = list_available_voices();
    println!("[TTS] tts_get_voices: {} voice(s)", voices.len());
    for v in &voices {
        println!("[TTS]   {} | {} | {} | {:.1}MB | {}Hz",
            v.name, v.lang, v.quality, v.size_mb, v.sample_rate);
    }
    Ok(voices)
}

#[tauri::command]
pub fn tts_get_voices_dir() -> Result<String, String> {
    let dir = piper_voices_dir();
    println!("[TTS] tts_get_voices_dir: {}", dir);
    Ok(dir)
}

#[tauri::command]
pub fn tts_open_voices_dir() -> Result<(), String> {
    let dir = piper_voices_dir();
    println!("[TTS] tts_open_voices_dir: {}", dir);
    let _ = std::fs::create_dir_all(&dir);
    std::process::Command::new("explorer")
        .arg(&dir)
        .spawn()
        .map_err(|e| format!("Cannot open directory: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn tts_download_voice(url: String, filename: String) -> Result<String, String> {
    let voices_dir = piper_voices_dir();
    let dest = format!("{}\\{}", voices_dir, filename);
    let dest_path = std::path::Path::new(&dest);

    // Don't re-download if already exists
    if dest_path.exists() {
        return Ok(format!("{} already exists", filename));
    }

    println!("[TTS] download: {} -> {}", url, dest);

    let resp = ureq::get(&url)
        .call()
        .map_err(|e| format!("Download failed: {}", e))?;

    let len: usize = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(0);
    println!("[TTS] download: {} bytes", len);

    let mut reader = resp.into_reader();
    let mut data: Vec<u8> = Vec::with_capacity(len.max(1024));
    reader
        .read_to_end(&mut data)
        .map_err(|e| format!("Read failed: {}", e))?;

    if let Some(parent) = dest_path.parent() {
        std::fs::create_dir_all(parent).ok();
    }
    fs::write(&dest, &data).map_err(|e| format!("Write failed: {}", e))?;

    println!("[TTS] download: saved {} ({} bytes)", filename, data.len());
    Ok(format!("Downloaded {} ({} MB)", filename, data.len() as f64 / 1_048_576.0))
}

#[tauri::command]
pub fn tts_delete_voice(name: String) -> Result<String, String> {
    let voices_dir = piper_voices_dir();
    let onnx_path = format!("{}\\{}.onnx", voices_dir, name);
    let json_path = format!("{}\\{}.onnx.json", voices_dir, name);

    let mut deleted = false;
    if std::path::Path::new(&onnx_path).exists() {
        fs::remove_file(&onnx_path).map_err(|e| format!("Cannot delete onnx: {}", e))?;
        deleted = true;
    }
    if std::path::Path::new(&json_path).exists() {
        fs::remove_file(&json_path).map_err(|e| format!("Cannot delete json: {}", e))?;
        deleted = true;
    }

    if deleted {
        println!("[TTS] deleted voice: {}", name);
        Ok(format!("Deleted {}", name))
    } else {
        Err(format!("Voice not found: {}", name))
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

fn tts_stop_inner() {
    if let Ok(mut guard) = CANCEL.lock() {
        if let Some(ref cancel) = *guard {
            cancel.store(true, Ordering::Relaxed);
            println!("[TTS] tts_stop_inner: cancel flag set");
        }
        *guard = None;
    }
}
