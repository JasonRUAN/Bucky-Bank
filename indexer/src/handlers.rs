use crate::database::{Database, models::{WithdrawalRequestEvent, EventWithdrawedEvent, WithdrawalStatus}};
use crate::health::HealthState;
use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

#[derive(Debug, Deserialize)]
pub struct PaginationParams {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawalStatusQuery {
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub data: Option<T>,
    pub message: Option<String>,
}

impl<T> ApiResponse<T> {
    pub fn success(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            message: None,
        }
    }

    pub fn error(message: String) -> Self {
        Self {
            success: false,
            data: None,
            message: Some(message),
        }
    }
}

#[derive(Debug, Serialize)]
pub struct WithdrawalRequestResponse {
    pub id: i32,
    pub request_id: String,
    pub bucky_bank_id: String,
    pub amount: i64,
    pub requester: String,
    pub reason: String,
    pub status: String,
    pub approved_by: Option<String>,
    pub created_at_ms: i64,
    pub audit_at_ms: Option<i64>,        // 审批时间
    pub indexed_at: Option<chrono::DateTime<chrono::Utc>>,
}

impl From<WithdrawalRequestEvent> for WithdrawalRequestResponse {
    fn from(event: WithdrawalRequestEvent) -> Self {
        Self {
            id: event.id,
            request_id: event.request_id,
            bucky_bank_id: event.bucky_bank_id,
            amount: event.amount,
            requester: event.requester,
            reason: event.reason,
            status: event.status,
            approved_by: event.approved_by,
            created_at_ms: event.created_at_ms,
            audit_at_ms: event.audit_at_ms, // 添加审批时间
            indexed_at: event.indexed_at,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct EventWithdrawedResponse {
    pub id: uuid::Uuid,
    pub request_id: String,
    pub bucky_bank_id: String,
    pub amount: i64,
    pub left_balance: i64,
    pub withdrawer: String,
    pub created_at_ms: i64,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<EventWithdrawedEvent> for EventWithdrawedResponse {
    fn from(event: EventWithdrawedEvent) -> Self {
        Self {
            id: event.id,
            request_id: event.request_id,
            bucky_bank_id: event.bucky_bank_id,
            amount: event.amount,
            left_balance: event.left_balance,
            withdrawer: event.withdrawer,
            created_at_ms: event.created_at_ms,
            created_at: event.created_at,
        }
    }
}

// 根据request_id获取单个提取请求
pub async fn get_withdrawal_request_by_id(
    State(state): State<HealthState>,
    Path(request_id): Path<String>,
) -> Result<Json<ApiResponse<WithdrawalRequestResponse>>, StatusCode> {
    let db = &state.db;
    match db.get_withdrawal_request_by_id(&request_id).await {
        Ok(Some(request)) => {
            let response = WithdrawalRequestResponse::from(request);
            Ok(Json(ApiResponse::success(response)))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get withdrawal request: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 根据bucky_bank_id获取提取请求列表
pub async fn get_withdrawal_requests_by_bank_id(
    State(state): State<HealthState>,
    Path(bucky_bank_id): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ApiResponse<Vec<WithdrawalRequestResponse>>>, StatusCode> {
    let db = &state.db;
    match db
        .get_withdrawal_requests_by_bank_id(&bucky_bank_id, params.limit, params.offset)
        .await
    {
        Ok(requests) => {
            let responses: Vec<WithdrawalRequestResponse> = requests
                .into_iter()
                .map(WithdrawalRequestResponse::from)
                .collect();
            Ok(Json(ApiResponse::success(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to get withdrawal requests by bank id: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 根据requester获取提取请求列表
pub async fn get_withdrawal_requests_by_requester(
    State(state): State<HealthState>,
    Path(requester): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ApiResponse<Vec<WithdrawalRequestResponse>>>, StatusCode> {
    let db = &state.db;
    match db
        .get_withdrawal_requests_by_requester(&requester, params.limit, params.offset)
        .await
    {
        Ok(requests) => {
            let responses: Vec<WithdrawalRequestResponse> = requests
                .into_iter()
                .map(WithdrawalRequestResponse::from)
                .collect();
            Ok(Json(ApiResponse::success(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to get withdrawal requests by requester: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 根据状态获取提取请求列表
pub async fn get_withdrawal_requests_by_status(
    State(state): State<HealthState>,
    Query(status_query): Query<WithdrawalStatusQuery>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ApiResponse<Vec<WithdrawalRequestResponse>>>, StatusCode> {
    let db = &state.db;
    let status_str = status_query.status.unwrap_or_else(|| "Pending".to_string());
    
    let status = match status_str.parse::<WithdrawalStatus>() {
        Ok(s) => s,
        Err(_) => {
            return Ok(Json(ApiResponse::error(format!(
                "Invalid status: {}. Valid values are: Pending, Approved, Rejected, Cancelled, Withdrawed",
                status_str
            ))));
        }
    };

    match db
        .get_withdrawal_requests_by_status(&status, params.limit, params.offset)
        .await
    {
        Ok(requests) => {
            let responses: Vec<WithdrawalRequestResponse> = requests
                .into_iter()
                .map(WithdrawalRequestResponse::from)
                .collect();
            Ok(Json(ApiResponse::success(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to get withdrawal requests by status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取提取请求统计信息
pub async fn get_withdrawal_requests_stats(
    State(state): State<HealthState>,
    Query(bank_id): Query<Option<String>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    let db = &state.db;
    let bucky_bank_id = bank_id.as_deref();
    
    match db.get_withdrawal_requests_stats(bucky_bank_id).await {
        Ok(stats) => Ok(Json(ApiResponse::success(stats))),
        Err(e) => {
            tracing::error!("Failed to get withdrawal requests stats: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct UpdateStatusRequest {
    pub status: String,
    pub approved_by: Option<String>,
}

// 更新提取请求状态
pub async fn update_withdrawal_request_status(
    State(state): State<HealthState>,
    Path(request_id): Path<String>,
    Json(payload): Json<UpdateStatusRequest>,
) -> Result<Json<ApiResponse<String>>, StatusCode> {
    let db = &state.db;
    let status = match payload.status.parse::<WithdrawalStatus>() {
        Ok(s) => s,
        Err(_) => {
            return Ok(Json(ApiResponse::error(format!(
                "Invalid status: {}. Valid values are: Pending, Approved, Rejected, Cancelled, Withdrawed",
                payload.status
            ))));
        }
    };

    match db
        .update_withdrawal_request_status(&request_id, &status, payload.approved_by.as_deref(), None)
        .await
    {
        Ok(true) => Ok(Json(ApiResponse::success("Status updated successfully".to_string()))),
        Ok(false) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to update withdrawal request status: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// EventWithdrawed 事件相关API

// 根据request_id获取单个提取完成事件
pub async fn get_event_withdrawed_by_request_id(
    State(state): State<HealthState>,
    Path(request_id): Path<String>,
) -> Result<Json<ApiResponse<EventWithdrawedResponse>>, StatusCode> {
    let db = &state.db;
    match db.get_event_withdrawed_by_request_id(&request_id).await {
        Ok(Some(event)) => {
            let response = EventWithdrawedResponse::from(event);
            Ok(Json(ApiResponse::success(response)))
        }
        Ok(None) => Err(StatusCode::NOT_FOUND),
        Err(e) => {
            tracing::error!("Failed to get event withdrawed: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 根据bucky_bank_id获取提取完成事件列表
pub async fn get_event_withdrawed_by_bank_id(
    State(state): State<HealthState>,
    Path(bucky_bank_id): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ApiResponse<Vec<EventWithdrawedResponse>>>, StatusCode> {
    let db = &state.db;
    match db
        .get_event_withdrawed_by_bank_id(&bucky_bank_id, params.limit, params.offset)
        .await
    {
        Ok(events) => {
            let responses: Vec<EventWithdrawedResponse> = events
                .into_iter()
                .map(EventWithdrawedResponse::from)
                .collect();
            Ok(Json(ApiResponse::success(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to get event withdrawed by bank id: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 根据withdrawer获取提取完成事件列表
pub async fn get_event_withdrawed_by_withdrawer(
    State(state): State<HealthState>,
    Path(withdrawer): Path<String>,
    Query(params): Query<PaginationParams>,
) -> Result<Json<ApiResponse<Vec<EventWithdrawedResponse>>>, StatusCode> {
    let db = &state.db;
    match db
        .get_event_withdrawed_by_withdrawer(&withdrawer, params.limit, params.offset)
        .await
    {
        Ok(events) => {
            let responses: Vec<EventWithdrawedResponse> = events
                .into_iter()
                .map(EventWithdrawedResponse::from)
                .collect();
            Ok(Json(ApiResponse::success(responses)))
        }
        Err(e) => {
            tracing::error!("Failed to get event withdrawed by withdrawer: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

// 获取提取完成事件统计信息
pub async fn get_event_withdrawed_stats(
    State(state): State<HealthState>,
    Query(bank_id): Query<Option<String>>,
) -> Result<Json<ApiResponse<serde_json::Value>>, StatusCode> {
    let db = &state.db;
    let bucky_bank_id = bank_id.as_deref();
    
    match db.get_event_withdrawed_stats(bucky_bank_id).await {
        Ok(stats) => Ok(Json(ApiResponse::success(stats))),
        Err(e) => {
            tracing::error!("Failed to get event withdrawed stats: {}", e);
            Err(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}