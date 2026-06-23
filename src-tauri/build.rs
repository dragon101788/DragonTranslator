use std::path::PathBuf;

fn main() {
    tauri_build::build();

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let user_dir = manifest_dir.join("..").join("user");

    // Re-run build if any file in user/ changes
    println!("cargo:rerun-if-changed={}", user_dir.display());
}
