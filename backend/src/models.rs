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
    pub current_balance: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BuckyBankResponse {
    pub success: bool,
    pub data: Vec<BuckyBankCreatedEvent>,
    pub total: i64,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct DepositMadeEvent {
    pub id: Uuid,
    pub bucky_bank_id: String,
    pub amount: i64,
    pub depositor: String,
    pub created_at_ms: i64,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DepositResponse {
    pub success: bool,
    pub data: Vec<DepositMadeEvent>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct QueryParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub parent_address: Option<String>,
    pub child_address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct DepositQueryParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WithdrawalRequest {
    pub id: i32,
    pub request_id: String,
    pub bucky_bank_id: String,
    pub amount: i64,
    pub requester: String,
    pub reason: String,
    pub status: String,
    pub approved_by: Option<String>,
    pub created_at_ms: i64,
    pub audit_at_ms: Option<i64>,
    pub indexed_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WithdrawalRequestResponse {
    pub success: bool,
    pub data: Vec<WithdrawalRequest>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawalRequestQueryParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
    pub status: Option<String>,
    pub requester: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, sqlx::FromRow)]
pub struct WithdrawedEvent {
    pub id: Uuid,
    pub request_id: String,
    pub bucky_bank_id: String,
    pub amount: i64,
    pub left_balance: i64,
    pub withdrawer: String,
    pub created_at_ms: i64,
    pub created_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct WithdrawedEventResponse {
    pub success: bool,
    pub data: Vec<WithdrawedEvent>,
    pub total: i64,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawedEventQueryParams {
    pub page: Option<i64>,
    pub limit: Option<i64>,
}
