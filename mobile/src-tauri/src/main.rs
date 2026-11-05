#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[cfg(target_os = "linux")]
fn configure_gstreamer() {
    use std::env;
    use std::path::Path;
    if env::var_os("GST_PLUGIN_PATH").is_none() {
        for directory in [
            "/usr/lib/gstreamer-1.0",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0",
            "/usr/lib64/gstreamer-1.0",
        ] {
            if Path::new(directory).is_dir() {
                env::set_var("GST_PLUGIN_PATH", directory);
                break;
            }
        }
    }
    if env::var_os("GST_PLUGIN_SCANNER").is_none() {
        for scanner in [
            "/usr/lib/gstreamer-1.0/gst-plugin-scanner",
            "/usr/lib/x86_64-linux-gnu/gstreamer-1.0/gst-plugin-scanner",
            "/usr/lib64/gstreamer-1.0/gst-plugin-scanner",
        ] {
            if Path::new(scanner).is_file() {
                env::set_var("GST_PLUGIN_SCANNER", scanner);
                break;
            }
        }
    }
}

fn main() {
    #[cfg(target_os = "linux")]
    configure_gstreamer();
    zikky_lib::run()
}
