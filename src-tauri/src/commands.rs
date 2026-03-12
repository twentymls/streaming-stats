use tauri::command;

#[command]
pub async fn init_database() -> Result<String, String> {
    Ok("Database initialized".to_string())
}
