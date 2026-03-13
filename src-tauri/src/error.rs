#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("Database error: {0}")]
    Sqlx(#[from] sqlx::Error),
}

impl From<DbError> for String {
    fn from(err: DbError) -> String {
        err.to_string()
    }
}
