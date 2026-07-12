//! Tauri command layer.
//!
//! Thin `#[tauri::command]` wrappers around the shared [`easyvpn_core`] engine.
//! All real logic lives in the core crate, which the CLI shares. Privileged
//! operations use [`Elevation::GuiPrompt`] so the desktop app shows a native
//! macOS password dialog.

use easyvpn_core::{self as core, Elevation};
pub use easyvpn_core::{Guest, GuestLinks, PortForwardInfo, ServerState, SystemInfo};

#[tauri::command]
pub fn check_system() -> SystemInfo {
    core::check_system()
}

#[tauri::command]
pub fn install_singbox() -> Result<String, String> {
    core::install_singbox()
}

#[tauri::command]
pub fn create_server(sni: Option<String>) -> Result<ServerState, String> {
    core::create_server(sni)
}

#[tauri::command]
pub fn add_guest(name: String) -> Result<Guest, String> {
    core::add_guest(&name)
}

#[tauri::command]
pub fn remove_guest(name: String) -> Result<(), String> {
    core::remove_guest(&name)
}

#[tauri::command]
pub fn list_guest_links() -> Result<Vec<GuestLinks>, String> {
    core::list_guest_links()
}

#[tauri::command]
pub fn port_forward_info() -> PortForwardInfo {
    core::port_forward_info()
}

#[tauri::command]
pub fn apply_and_start() -> Result<String, String> {
    core::apply_and_start(Elevation::GuiPrompt)
}

#[tauri::command]
pub fn stop_server() -> Result<String, String> {
    core::stop_server(Elevation::GuiPrompt)
}
