use std::path::PathBuf;

fn main() {
    tauri_build::build();

    let manifest_dir = PathBuf::from(std::env::var("CARGO_MANIFEST_DIR").unwrap());
    let runtime_dir = manifest_dir.join("..").join("runtime");

    // Re-run build if any file in runtime/ changes
    println!("cargo:rerun-if-changed={}", runtime_dir.display());
}
