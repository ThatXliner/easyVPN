mod server;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            server::check_system,
            server::install_singbox,
            server::create_server,
            server::add_guest,
            server::remove_guest,
            server::list_guest_links,
            server::port_forward_info,
            server::apply_and_start,
            server::stop_server,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
