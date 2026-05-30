use tauri::Manager;

const FALLBACK_APP_URL: &str = "https://careguide-ai-three.vercel.app";

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            let configured_url = std::env::var("CAREGUIDE_APP_URL")
                .ok()
                .map(|value| value.trim().to_owned())
                .filter(|value| !value.is_empty())
                .unwrap_or_else(|| FALLBACK_APP_URL.to_owned());

            if let Some(window) = app.get_webview_window("main") {
                if let Ok(url) = tauri::Url::parse(&configured_url) {
                    let _ = window.navigate(url);
                }
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("failed to run CareGuide AI desktop shell");
}
