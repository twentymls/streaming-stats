use tauri::Manager;
#[cfg(desktop)]
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
};

mod commands;
mod db;
mod error;
mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::default().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Build tray menu (desktop only)
            #[cfg(desktop)]
            {
                let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
                let open = MenuItem::with_id(app, "open", "Open Dashboard", true, None::<&str>)?;
                let menu = Menu::with_items(app, &[&open, &quit])?;

                TrayIconBuilder::new()
                    .icon(app.default_window_icon().unwrap().clone())
                    .menu(&menu)
                    .on_menu_event(|app, event| match event.id.as_ref() {
                        "open" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    })
                    .build(app)?;
            }

            // Initialize SQLite database pool
            let app_data_dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&app_data_dir)?;
            let db_path = app_data_dir.join("streaming_stats.db");
            let pool = tauri::async_runtime::block_on(db::create_pool(&db_path))
                .map_err(|e| e.to_string())?;
            app.manage(tokio::sync::Mutex::new(pool));

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
            commands::get_latest_stats,
            commands::get_stats_range,
            commands::get_monthly_api_count,
            commands::get_last_fetch_date,
            commands::get_latest_top_tracks,
            commands::get_latest_top_curators,
            commands::get_top_track_deltas,
            commands::get_all_cached_top_tracks,
            commands::get_all_cached_top_curators,
            commands::save_daily_stat,
            commands::log_api_call,
            commands::save_top_tracks,
            commands::save_top_curators,
            commands::save_track_stats,
            commands::get_latest_track_stats,
            commands::get_track_stats_last_fetch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
