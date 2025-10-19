use crate::config::DatabaseConfig;
use anyhow::Result;
use sqlx::PgPool;
use sqlx::Row;
use sqlx::postgres::PgPoolOptions;
use std::time::Duration;

pub mod models {
    use chrono::{DateTime, Utc};
    use serde::{Deserialize, Serialize};
    use sqlx::FromRow;
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
        pub current_balance: i64,
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
        pub current_balance: i64,
    }

    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct DepositMadeEvent {
        pub id: Uuid,
        pub bucky_bank_id: String,
        pub amount: i64,
        pub depositor: String,
        pub created_at_ms: i64,
        pub created_at: DateTime<Utc>,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct NewDepositMadeEvent {
        pub bucky_bank_id: String,
        pub amount: i64,
        pub depositor: String,
        pub created_at_ms: i64,
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

    #[derive(Debug, Serialize, Deserialize, Clone)]
    pub enum WithdrawalStatus {
        Pending,    // 等待审批
        Approved,   // 已批准
        Rejected,   // 已拒绝
        Cancelled,  // 已取消
        Withdrawed, // 已提取
    }

    impl std::fmt::Display for WithdrawalStatus {
        fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
            match self {
                WithdrawalStatus::Pending => write!(f, "Pending"),
                WithdrawalStatus::Approved => write!(f, "Approved"),
                WithdrawalStatus::Rejected => write!(f, "Rejected"),
                WithdrawalStatus::Cancelled => write!(f, "Cancelled"),
                WithdrawalStatus::Withdrawed => write!(f, "Withdrawed"),
            }
        }
    }

    impl std::str::FromStr for WithdrawalStatus {
        type Err = String;

        fn from_str(s: &str) -> Result<Self, Self::Err> {
            match s {
                "Pending" => Ok(WithdrawalStatus::Pending),
                "Approved" => Ok(WithdrawalStatus::Approved),
                "Rejected" => Ok(WithdrawalStatus::Rejected),
                "Cancelled" => Ok(WithdrawalStatus::Cancelled),
                "Withdrawed" => Ok(WithdrawalStatus::Withdrawed),
                _ => Err(format!("Invalid withdrawal status: {}", s)),
            }
        }
    }

    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct WithdrawalRequestEvent {
        pub id: i32,
        pub request_id: String,
        pub bucky_bank_id: String,
        pub amount: i64,
        pub requester: String,
        pub reason: String,
        pub status: String, // 存储为字符串，查询时转换为枚举
        pub approved_by: Option<String>,
        pub created_at_ms: i64,
        pub audit_at_ms: Option<i64>,        // 审批时间
        pub indexed_at: Option<DateTime<Utc>>,
    }

    impl WithdrawalRequestEvent {
        pub fn get_status(&self) -> Result<WithdrawalStatus, String> {
            self.status.parse()
        }
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct NewWithdrawalRequestEvent {
        pub request_id: String,
        pub bucky_bank_id: String,
        pub amount: i64,
        pub requester: String,
        pub reason: String,
        pub status: String, // 改为字符串类型
        pub approved_by: String,
        pub created_at_ms: i64,
        pub audit_at_ms: Option<i64>,        // 审批时间
        pub tx_digest: String,
        pub event_seq: i64,
        pub timestamp_ms: i64,
    }

    // EventWithdrawed 事件相关结构体
    #[derive(Debug, FromRow, Serialize, Deserialize)]
    pub struct EventWithdrawedEvent {
        pub id: Uuid,
        pub request_id: String,
        pub bucky_bank_id: String,
        pub amount: i64,
        pub left_balance: i64,
        pub withdrawer: String,
        pub created_at_ms: i64,
        pub created_at: DateTime<Utc>,
    }

    #[derive(Debug, Serialize, Deserialize)]
    pub struct NewEventWithdrawedEvent {
        pub request_id: String,
        pub bucky_bank_id: String,
        pub amount: i64,
        pub left_balance: i64,
        pub withdrawer: String,
        pub created_at_ms: i64,
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
                target_amount, created_at_ms, deadline_ms, duration_days, current_balance
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
        .bind(event.current_balance)
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn save_deposit_made_event(
        &self,
        event: &models::NewDepositMadeEvent,
    ) -> Result<models::DepositMadeEvent> {
        let mut transaction = self.pool.begin().await?;

        // 1. 插入存款事件
        let deposit_result = sqlx::query_as::<_, models::DepositMadeEvent>(
            r#"
            INSERT INTO deposit_made_events (
                bucky_bank_id, amount, depositor, created_at_ms
            ) VALUES ($1, $2, $3, $4)
            RETURNING *
            "#,
        )
        .bind(&event.bucky_bank_id)
        .bind(event.amount)
        .bind(&event.depositor)
        .bind(event.created_at_ms)
        .fetch_one(&mut *transaction)
        .await?;

        // 2. 同步更新bucky_bank的当前余额
        let update_result = sqlx::query(
            r#"
            UPDATE bucky_bank_created_events
            SET current_balance = current_balance + $1
            WHERE bucky_bank_id = $2
            "#,
        )
        .bind(event.amount)
        .bind(&event.bucky_bank_id)
        .execute(&mut *transaction)
        .await?;

        // 检查是否成功更新了余额
        if update_result.rows_affected() == 0 {
            return Err(anyhow::anyhow!(
                "BuckyBank with id {} not found",
                event.bucky_bank_id
            ));
        }

        transaction.commit().await?;
        Ok(deposit_result)
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

    pub async fn save_deposit_made_events_batch(
        &self,
        events: &[models::NewDepositMadeEvent],
    ) -> Result<u64> {
        let mut transaction = self.pool.begin().await?;

        let mut count = 0;
        for event in events {
            // 1. 插入存款事件
            sqlx::query(
                r#"
                INSERT INTO deposit_made_events (
                    bucky_bank_id, amount, depositor, created_at_ms
                ) VALUES ($1, $2, $3, $4)
                "#,
            )
            .bind(&event.bucky_bank_id)
            .bind(event.amount)
            .bind(&event.depositor)
            .bind(event.created_at_ms)
            .execute(&mut *transaction)
            .await?;

            // 2. 同步更新对应BuckyBank的余额
            let update_result = sqlx::query(
                r#"
                UPDATE bucky_bank_created_events
                SET current_balance = current_balance + $1
                WHERE bucky_bank_id = $2
                "#,
            )
            .bind(event.amount)
            .bind(&event.bucky_bank_id)
            .execute(&mut *transaction)
            .await?;

            if update_result.rows_affected() == 0 {
                return Err(anyhow::anyhow!(
                    "BuckyBank with id {} not found",
                    event.bucky_bank_id
                ));
            }

            count += 1;
        }

        transaction.commit().await?;
        Ok(count)
    }

    pub async fn get_latest_event_timestamp(&self) -> Result<Option<i64>> {
        let result = sqlx::query(
            "SELECT EXTRACT(EPOCH FROM created_at) * 1000 as created_at_ms
             FROM bucky_bank_created_events
             ORDER BY created_at DESC
             LIMIT 1",
        )
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|row| row.get::<i64, _>("created_at_ms")))
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
        let result = sqlx::query_as::<_, models::Cursor>("SELECT * FROM cursors WHERE id = $1")
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

    pub async fn update_cursor(
        &self,
        id: &str,
        event_seq: &str,
        tx_digest: &str,
    ) -> Result<Option<models::Cursor>> {
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

    // 查询BuckyBank的当前余额
    pub async fn get_bucky_bank_balance(&self, bucky_bank_id: &str) -> Result<Option<i64>> {
        let result = sqlx::query(
            "SELECT current_balance FROM bucky_bank_created_events WHERE bucky_bank_id = $1",
        )
        .bind(bucky_bank_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result.map(|row| row.get::<i64, _>("current_balance")))
    }

    // 直接更新BuckyBank余额
    pub async fn update_bucky_bank_balance(
        &self,
        bucky_bank_id: &str,
        new_balance: i64,
    ) -> Result<bool> {
        let result = sqlx::query(
            "UPDATE bucky_bank_created_events SET current_balance = $1 WHERE bucky_bank_id = $2",
        )
        .bind(new_balance)
        .bind(bucky_bank_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // 通过存款事件重新计算并更新余额（用于数据一致性修复）
    pub async fn recalculate_bucky_bank_balance(&self, bucky_bank_id: &str) -> Result<bool> {
        // 重新计算总存款金额
        let total_deposits: Option<i64> = sqlx::query(
            "SELECT COALESCE(SUM(amount), 0) as total_amount FROM deposit_made_events WHERE bucky_bank_id = $1"
        )
        .bind(bucky_bank_id)
        .fetch_optional(&self.pool)
        .await?
        .map(|row| row.get::<i64, _>("total_amount"));

        if let Some(total_amount) = total_deposits {
            // 更新余额
            let result = sqlx::query(
                "UPDATE bucky_bank_created_events SET current_balance = $1 WHERE bucky_bank_id = $2"
            )
            .bind(total_amount)
            .bind(bucky_bank_id)
            .execute(&self.pool)
            .await?;

            Ok(result.rows_affected() > 0)
        } else {
            // 如果没有存款记录，将余额设置为0
            let result = sqlx::query(
                "UPDATE bucky_bank_created_events SET current_balance = 0 WHERE bucky_bank_id = $1",
            )
            .bind(bucky_bank_id)
            .execute(&self.pool)
            .await?;

            Ok(result.rows_affected() > 0)
        }
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

    // WithdrawalRequest 相关方法
    pub async fn save_withdrawal_request_event(
        &self,
        event: &models::NewWithdrawalRequestEvent,
    ) -> Result<models::WithdrawalRequestEvent> {
        let result = sqlx::query_as::<_, models::WithdrawalRequestEvent>(
            r#"
            INSERT INTO withdrawal_requests (
                request_id, bucky_bank_id, amount, requester, reason,
                status, approved_by, created_at_ms, audit_at_ms
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING *
            "#,
        )
        .bind(&event.request_id)
        .bind(&event.bucky_bank_id)
        .bind(event.amount)
        .bind(&event.requester)
        .bind(&event.reason)
        .bind(event.status.to_string())
        .bind(&event.approved_by)
        .bind(event.created_at_ms)
        .bind(event.audit_at_ms) // 添加audit_at_ms字段
        .fetch_one(&self.pool)
        .await?;

        Ok(result)
    }

    pub async fn save_withdrawal_request_events_batch(
        &self,
        events: &[models::NewWithdrawalRequestEvent],
    ) -> Result<u64> {
        let mut transaction = self.pool.begin().await?;

        let mut count = 0;
        for event in events {
            sqlx::query(
                r#"
                INSERT INTO withdrawal_requests (
                    request_id, bucky_bank_id, amount, requester, reason,
                    status, approved_by, created_at_ms
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (request_id) DO NOTHING
                "#,
            )
            .bind(&event.request_id)
            .bind(&event.bucky_bank_id)
            .bind(event.amount)
            .bind(&event.requester)
            .bind(&event.reason)
            .bind(event.status.to_string())
            .bind(&event.approved_by)
            .bind(event.created_at_ms)
            .execute(&mut *transaction)
            .await?;

            count += 1;
        }

        transaction.commit().await?;
        Ok(count)
    }

    // 根据request_id查询提取请求
    pub async fn get_withdrawal_request_by_id(
        &self,
        request_id: &str,
    ) -> Result<Option<models::WithdrawalRequestEvent>> {
        let result = sqlx::query_as::<_, models::WithdrawalRequestEvent>(
            "SELECT * FROM withdrawal_requests WHERE request_id = $1"
        )
        .bind(request_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    // 根据bucky_bank_id查询提取请求列表
    pub async fn get_withdrawal_requests_by_bank_id(
        &self,
        bucky_bank_id: &str,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<models::WithdrawalRequestEvent>> {
        let query = r#"
            SELECT * FROM withdrawal_requests 
            WHERE bucky_bank_id = $1 
            ORDER BY created_at_ms DESC 
            LIMIT $2 OFFSET $3
        "#;

        let result = sqlx::query_as::<_, models::WithdrawalRequestEvent>(query)
            .bind(bucky_bank_id)
            .bind(limit.unwrap_or(50))
            .bind(offset.unwrap_or(0))
            .fetch_all(&self.pool)
            .await?;

        Ok(result)
    }

    // 根据requester查询提取请求列表
    pub async fn get_withdrawal_requests_by_requester(
        &self,
        requester: &str,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<models::WithdrawalRequestEvent>> {
        let query = r#"
            SELECT * FROM withdrawal_requests 
            WHERE requester = $1 
            ORDER BY created_at_ms DESC 
            LIMIT $2 OFFSET $3
        "#;

        let result = sqlx::query_as::<_, models::WithdrawalRequestEvent>(query)
            .bind(requester)
            .bind(limit.unwrap_or(50))
            .bind(offset.unwrap_or(0))
            .fetch_all(&self.pool)
            .await?;

        Ok(result)
    }

    // 根据状态查询提取请求列表
    pub async fn get_withdrawal_requests_by_status(
        &self,
        status: &models::WithdrawalStatus,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<models::WithdrawalRequestEvent>> {
        let query = r#"
            SELECT * FROM withdrawal_requests 
            WHERE status = $1 
            ORDER BY created_at_ms DESC 
            LIMIT $2 OFFSET $3
        "#;

        let result = sqlx::query_as::<_, models::WithdrawalRequestEvent>(query)
            .bind(status.to_string())
            .bind(limit.unwrap_or(50))
            .bind(offset.unwrap_or(0))
            .fetch_all(&self.pool)
            .await?;

        Ok(result)
    }

    // 更新提取请求状态
    pub async fn update_withdrawal_request_status(
        &self,
        request_id: &str,
        status: &models::WithdrawalStatus,
        approved_by: Option<&str>,
        audit_at_ms: Option<i64>,
    ) -> Result<bool> {
        let result = sqlx::query(
            r#"
            UPDATE withdrawal_requests 
            SET status = $1, approved_by = $2, audit_at_ms = $3
            WHERE request_id = $4
            "#,
        )
        .bind(status.to_string())
        .bind(approved_by)
        .bind(audit_at_ms)
        .bind(request_id)
        .execute(&self.pool)
        .await?;

        Ok(result.rows_affected() > 0)
    }

    // 获取提取请求统计信息
    pub async fn get_withdrawal_requests_stats(
        &self,
        bucky_bank_id: Option<&str>,
    ) -> Result<serde_json::Value> {
        let query = if bucky_bank_id.is_some() {
            r#"
            SELECT 
                status,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM withdrawal_requests 
            WHERE bucky_bank_id = $1
            GROUP BY status
            "#
        } else {
            r#"
            SELECT 
                status,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount
            FROM withdrawal_requests 
            GROUP BY status
            "#
        };

        let mut query_builder = sqlx::query(query);
        if let Some(bank_id) = bucky_bank_id {
            query_builder = query_builder.bind(bank_id);
        }

        let rows = query_builder.fetch_all(&self.pool).await?;

        let mut stats = serde_json::Map::new();
        for row in rows {
            let status: String = row.get("status");
            let count: i64 = row.get("count");
            let total_amount: i64 = row.get("total_amount");
            
            stats.insert(status, serde_json::json!({
                "count": count,
                "total_amount": total_amount
            }));
        }

        Ok(serde_json::Value::Object(stats))
    }

    // EventWithdrawed 事件相关方法
    pub async fn save_event_withdrawed_event(
        &self,
        event: &models::NewEventWithdrawedEvent,
    ) -> Result<models::EventWithdrawedEvent> {
        let mut transaction = self.pool.begin().await?;

        // 1. 插入提取完成事件
        let withdrawed_result = sqlx::query_as::<_, models::EventWithdrawedEvent>(
            r#"
            INSERT INTO withdrawed_events (
                request_id, bucky_bank_id, amount, left_balance, withdrawer, created_at_ms
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
            "#,
        )
        .bind(&event.request_id)
        .bind(&event.bucky_bank_id)
        .bind(event.amount)
        .bind(event.left_balance)
        .bind(&event.withdrawer)
        .bind(event.created_at_ms)
        .fetch_one(&mut *transaction)
        .await?;

        // 2. 同步更新对应提取请求的状态为Withdrawed
        let update_result = sqlx::query(
            r#"
            UPDATE withdrawal_requests 
            SET status = 'Withdrawed', audit_at_ms = $1
            WHERE request_id = $2 AND status = 'Approved'
            "#,
        )
        .bind(event.created_at_ms)
        .bind(&event.request_id)
        .execute(&mut *transaction)
        .await?;

        // 3. 同步更新BuckyBank的当前余额
        let balance_update_result = sqlx::query(
            r#"
            UPDATE bucky_bank_created_events
            SET current_balance = $1
            WHERE bucky_bank_id = $2
            "#,
        )
        .bind(event.left_balance)
        .bind(&event.bucky_bank_id)
        .execute(&mut *transaction)
        .await?;

        // 检查是否成功更新了提取请求状态
        if update_result.rows_affected() == 0 {
            return Err(anyhow::anyhow!(
                "Withdrawal request with id {} not found or not in Approved status",
                event.request_id
            ));
        }

        // 检查是否成功更新了余额
        if balance_update_result.rows_affected() == 0 {
            return Err(anyhow::anyhow!(
                "BuckyBank with id {} not found",
                event.bucky_bank_id
            ));
        }

        transaction.commit().await?;
        Ok(withdrawed_result)
    }

    pub async fn save_withdrawed_events_batch(
        &self,
        events: &[models::NewEventWithdrawedEvent],
    ) -> Result<u64> {
        let mut transaction = self.pool.begin().await?;

        let mut count = 0;
        for event in events {
            // 1. 插入提取完成事件
            sqlx::query(
                r#"
                INSERT INTO withdrawed_events (
                    request_id, bucky_bank_id, amount, left_balance, withdrawer, created_at_ms
                ) VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT DO NOTHING
                "#,
            )
            .bind(&event.request_id)
            .bind(&event.bucky_bank_id)
            .bind(event.amount)
            .bind(event.left_balance)
            .bind(&event.withdrawer)
            .bind(event.created_at_ms)
            .execute(&mut *transaction)
            .await?;

            // 2. 更新提取请求状态
            sqlx::query(
                r#"
                UPDATE withdrawal_requests 
                SET status = 'Withdrawed', audit_at_ms = $1
                WHERE request_id = $2 AND status = 'Approved'
                "#,
            )
            .bind(event.created_at_ms)
            .bind(&event.request_id)
            .execute(&mut *transaction)
            .await?;

            // 3. 更新BuckyBank余额
            let balance_update_result = sqlx::query(
                r#"
                UPDATE bucky_bank_created_events
                SET current_balance = $1
                WHERE bucky_bank_id = $2
                "#,
            )
            .bind(event.left_balance)
            .bind(&event.bucky_bank_id)
            .execute(&mut *transaction)
            .await?;

            if balance_update_result.rows_affected() == 0 {
                return Err(anyhow::anyhow!(
                    "BuckyBank with id {} not found",
                    event.bucky_bank_id
                ));
            }

            count += 1;
        }

        transaction.commit().await?;
        Ok(count)
    }

    // 根据request_id查询提取完成事件
    pub async fn get_event_withdrawed_by_request_id(
        &self,
        request_id: &str,
    ) -> Result<Option<models::EventWithdrawedEvent>> {
        let result = sqlx::query_as::<_, models::EventWithdrawedEvent>(
            "SELECT * FROM withdrawed_events WHERE request_id = $1"
        )
        .bind(request_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(result)
    }

    // 根据bucky_bank_id查询提取完成事件列表
    pub async fn get_event_withdrawed_by_bank_id(
        &self,
        bucky_bank_id: &str,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<models::EventWithdrawedEvent>> {
        let query = r#"
            SELECT * FROM withdrawed_events 
            WHERE bucky_bank_id = $1 
            ORDER BY created_at_ms DESC 
            LIMIT $2 OFFSET $3
        "#;

        let result = sqlx::query_as::<_, models::EventWithdrawedEvent>(query)
            .bind(bucky_bank_id)
            .bind(limit.unwrap_or(50))
            .bind(offset.unwrap_or(0))
            .fetch_all(&self.pool)
            .await?;

        Ok(result)
    }

    // 根据withdrawer查询提取完成事件列表
    pub async fn get_event_withdrawed_by_withdrawer(
        &self,
        withdrawer: &str,
        limit: Option<i64>,
        offset: Option<i64>,
    ) -> Result<Vec<models::EventWithdrawedEvent>> {
        let query = r#"
            SELECT * FROM withdrawed_events 
            WHERE withdrawer = $1 
            ORDER BY created_at_ms DESC 
            LIMIT $2 OFFSET $3
        "#;

        let result = sqlx::query_as::<_, models::EventWithdrawedEvent>(query)
            .bind(withdrawer)
            .bind(limit.unwrap_or(50))
            .bind(offset.unwrap_or(0))
            .fetch_all(&self.pool)
            .await?;

        Ok(result)
    }

    // 获取提取完成事件统计信息
    pub async fn get_event_withdrawed_stats(
        &self,
        bucky_bank_id: Option<&str>,
    ) -> Result<serde_json::Value> {
        let query = if bucky_bank_id.is_some() {
            r#"
            SELECT 
                COUNT(*) as total_count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(amount), 0) as average_amount
            FROM withdrawed_events 
            WHERE bucky_bank_id = $1
            "#
        } else {
            r#"
            SELECT 
                COUNT(*) as total_count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(AVG(amount), 0) as average_amount
            FROM withdrawed_events
            "#
        };

        let mut query_builder = sqlx::query(query);
        if let Some(bank_id) = bucky_bank_id {
            query_builder = query_builder.bind(bank_id);
        }

        let row = query_builder.fetch_one(&self.pool).await?;

        let stats = serde_json::json!({
            "total_count": row.get::<i64, _>("total_count"),
            "total_amount": row.get::<i64, _>("total_amount"),
            "average_amount": row.get::<f64, _>("average_amount")
        });

        Ok(stats)
    }
}
