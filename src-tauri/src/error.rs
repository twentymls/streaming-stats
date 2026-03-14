#[derive(Debug, thiserror::Error)]
pub enum DbError {
    #[error("A database error occurred")]
    Sqlx(#[from] sqlx::Error),
}

impl From<DbError> for String {
    fn from(err: DbError) -> String {
        log::error!("Database error: {:?}", err);
        err.to_string()
    }
}
