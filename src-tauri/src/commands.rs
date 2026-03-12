use tauri::command;

#[command]
pub async fn init_database() -> Result<String, String> {
    Ok("Database initialized".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_init_database_returns_ok() {
        let result = init_database().await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "Database initialized");
    }
}
