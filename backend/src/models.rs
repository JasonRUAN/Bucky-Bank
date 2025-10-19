use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct BuckyBankCreatedEvent {
    pub id: Uuid,
    pub bucky_bank_id: String,
    pub name: String,
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
pub struct BuckyBankResponse {
    pub success: bool,
    pub data: Vec<BuckyBankCreatedEvent>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub parent_address: Option<String>,
    pub child_address: Option<String>,
}