use keyring::{Entry, Error as KeyringError};

const SERVICE: &str = "app.zikky.music";
const ACCOUNT: &str = "server-connection";
const MAX_CONNECTION_BYTES: usize = 64 * 1024;

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|error| error.to_string())
}

/// The connection JSON contains the server password, so it only ever lives in
/// the operating system's secret store.
#[tauri::command]
fn save_connection(value: String) -> Result<(), String> {
    if value.len() > MAX_CONNECTION_BYTES {
        return Err("Saved connection is too large.".into());
    }
    entry()?
        .set_password(&value)
        .map_err(|error| format!("Secure storage is unavailable: {error}"))
}

#[tauri::command]
fn load_connection() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(value) => Ok(Some(value)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(error) => Err(format!("Secure storage is unavailable: {error}")),
    }
}

#[tauri::command]
fn clear_connection() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(KeyringError::NoEntry) => Ok(()),
        Err(error) => Err(format!("Secure storage is unavailable: {error}")),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            // Playback often starts after an async server check, so the
            // webview must not lose the original click as a user gesture.
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager;
                use webkit2gtk::{SettingsExt, WebViewExt};
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.with_webview(|webview| {
                        if let Some(settings) = webview.inner().settings() {
                            settings.set_media_playback_requires_user_gesture(false);
                        }
                    });
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            save_connection,
            load_connection,
            clear_connection
        ])
        .run(tauri::generate_context!())
        .expect("error while running Zikky");
}
