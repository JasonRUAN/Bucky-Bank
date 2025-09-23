use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use sqlx::Row;
use std::time::Duration;
use crate::config::DatabaseConfig;

pub mod models {
    use serde::{Deserialize, Serialize};
    use sqlx::FromRow;
    use chrono::{DateTime, Utc};
    use uuid::Uuid;

    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct BuckyBankCreatedEvent {
        pub id: Uuid,
        pub bucky_bank_id: String,
        pub parent_address: String,
        pub child_address: String,
        pub target_amount: i64,
        pub created_at_ms: i64,
        pub deadline_ms: i64,
        pub duration_days: i64,
        pub current_balance_value: i64,
        pub created_at: DateTime<Utc>,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct NewBuckyBankCreatedEvent {
        pub bucky_bank_id: String,
        pub name: String,
        pub parent_address: String,
        pub child_address: String,
        pub target_amount: i64,
        pub created_at_ms: i64,
        pub deadline_ms: i64,
        pub duration_days: i64,
        pub current_balance_value: i64,
    }

    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct Cursor {
        pub id: String,
        pub event_seq: String,
        pub tx_digest: String,
        pub created_at: DateTime<Utc>,
        pub updated_at: DateTime<Utc>,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct NewCursor {
        pub id: String,
        pub event_seq: String,
        pub tx_digest: String,
    }
}

pub struct Database {
    pool: PgPool,
}

impl Database {
    pub async fn new(config: &DatabaseConfig) -> Result<Self> {
        let pool = PgPoolOptions::new()
            .max_connections(config.max_connections)
            .min_connections(config.min_connections)
            .acquire_timeout(Duration::from_secs(config.connection_timeout_seconds))
            .connect(&config.url)
            .await?;

        // 验证数据库连接
        sqlx::query("SELECT 1").fetch_one(&pool).await?;

        Ok(Self { pool })
    }

    pub async fn save_bucky_bank_created_event(
        &self,
        event: &models::NewBuckyBankCreatedEvent,
    ) -> Result<models::BuckyBankCreatedEvent> {
        let result = sqlx::query_as::<_, models::BuckyBankCreatedEvent>(
            r#"
            INSERT INTO bucky_bank_created_events (
                bucky_bank_id, name, parent_address, child_address,
                target_amount, created_at_ms, deadline_ms, duration_days, current_balance_value
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(&event.bucky_bank_id)
        .bind(&event.name)
        .bind(&event.parent_address)
        .bind(&event.child_address)
        .bind(event.target_amount)
        .bind(event.created_at_ms)
        .bind(event.deadline_ms)
        .bind(event.duration_days)
        .bind(event.current_balance_value)
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn save_bucky_bank_created_events_batch(
        &self,
        events: &[models::NewBuckyBankCreatedEvent],
    ) -> Result<u64> {
        let mut transaction = self.pool.begin().await?;

        let mut count = 0;
        for event in events {
            sqlx::query(
                r#"
                INSERT INTO bucky_bank_created_events (
                    bucky_bank_id, parent_address, child_address,
                    target_amount, deadline_ms
                ) VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (bucky_bank_id) DO NOTHING
                "#,
            )
            .bind(&event.bucky_bank_id)
            .bind(&event.parent_address)
            .bind(&event.child_address)
            .bind(event.target_amount)
            .bind(event.deadline_ms)
            .execute(&mut *transaction)
            .await?;

            count += 1;
        }

        transaction.commit().await?;
        Ok(count)
    }

    pub async fn get_latest_event_timestamp(&self) -> Result<Option<i64>> {
        let result = sqlx::query(
            "SELECT EXTRACT(EPOCH FROM created_at) * 1000 as timestamp_ms
             FROM bucky_bank_created_events
             ORDER BY created_at DESC
             LIMIT 1"
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|row| row.get::<i64, _>("timestamp_ms")))
    }

    pub async fn health_check(&self) -> Result<()> {
        sqlx::query("SELECT 1").fetch_one(&self.pool).await?;
        Ok(())
    }

    pub fn get_pool(&self) -> &PgPool {
        &self.pool
    }

    // 游标相关操作方法
    pub async fn get_cursor(&self, id: &str) -> Result<Option<models::Cursor>> {
        let result = sqlx::query_as::<_, models::Cursor>(
            "SELECT * FROM cursors WHERE id = $1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn save_cursor(&self, cursor: &models::NewCursor) -> Result<models::Cursor> {
        let result = sqlx::query_as::<_, models::Cursor>(
            r#"
            INSERT INTO cursors (id, event_seq, tx_digest)
            VALUES ($1, $2, $3)
            ON CONFLICT (id) DO UPDATE SET
                event_seq = EXCLUDED.event_seq,
                tx_digest = EXCLUDED.tx_digest,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
            "#,
        )
        .bind(&cursor.id)
        .bind(&cursor.event_seq)
        .bind(&cursor.tx_digest)
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn update_cursor(&self, id: &str, event_seq: &str, tx_digest: &str) -> Result<Option<models::Cursor>> {
        let result = sqlx::query_as::<_, models::Cursor>(
            r#"
            UPDATE cursors SET
                event_seq = $2,
                tx_digest = $3,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = $1
            RETURNING *
            "#,
        )
        .bind(id)
        .bind(event_seq)
        .bind(tx_digest)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn delete_cursor(&self, id: &str) -> Result<bool> {
        let result = sqlx::query("DELETE FROM cursors WHERE id = $1")
            .bind(id)
            .execute(&self.pool)
            .await?;

        Ok(result.rows_affected() > 0)
    }

    pub async fn list_cursors(&self, limit: Option<i64>) -> Result<Vec<models::Cursor>> {
        let query = if let Some(limit) = limit {
            "SELECT * FROM cursors ORDER BY updated_at DESC LIMIT $1"
        } else {
            "SELECT * FROM cursors ORDER BY updated_at DESC"
        };

        let mut query_builder = sqlx::query_as::<_, models::Cursor>(query);

        if let Some(limit) = limit {
            query_builder = query_builder.bind(limit);
        }

        let result = query_builder.fetch_all(&self.pool).await?;
        Ok(result)
    }
}