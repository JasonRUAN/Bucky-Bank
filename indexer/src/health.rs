use axum::{extract::State, http::StatusCode, response::Json, routing::{get, put}, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::Database;
use crate::handlers;

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub database: String,
    pub timestamp: String,
    pub uptime_seconds: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ErrorResponse {
    pub error: String,
    pub message: String,
}

#[derive(Clone)]
pub struct HealthState {
    pub db: Arc<Database>,
    pub start_time: std::time::Instant,
}

pub fn health_routes(state: HealthState) -> Router {
    Router::new()
        .route("/health", get(health_check))
        .route("/ready", get(readiness_check))
        .route("/live", get(liveness_check))
        // 提取请求相关API
        .route("/api/withdrawal-requests/:request_id", get(handlers::get_withdrawal_request_by_id))
        .route("/api/withdrawal-requests/bank/:bucky_bank_id", get(handlers::get_withdrawal_requests_by_bank_id))
        .route("/api/withdrawal-requests/requester/:requester", get(handlers::get_withdrawal_requests_by_requester))
        .route("/api/withdrawal-requests/status", get(handlers::get_withdrawal_requests_by_status))
        .route("/api/withdrawal-requests/stats", get(handlers::get_withdrawal_requests_stats))
        .route("/api/withdrawal-requests/:request_id/status", put(handlers::update_withdrawal_request_status))
        // EventWithdrawed 事件相关API
        .route("/api/event-withdrawed/:request_id", get(handlers::get_event_withdrawed_by_request_id))
        .route("/api/event-withdrawed/bank/:bucky_bank_id", get(handlers::get_event_withdrawed_by_bank_id))
        .route("/api/event-withdrawed/withdrawer/:withdrawer", get(handlers::get_event_withdrawed_by_withdrawer))
        .route("/api/event-withdrawed/stats", get(handlers::get_event_withdrawed_stats))
        .with_state(state)
}

pub async fn health_check(
    State(state): State<HealthState>,
) -> Result<Json<HealthResponse>, (StatusCode, Json<ErrorResponse>)> {
    // 检查数据库连接
    match state.db.health_check().await {
        Ok(_) => {
            let response = HealthResponse {
                status: "healthy".to_string(),
                database: "connected".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
                uptime_seconds: state.start_time.elapsed().as_secs(),
            };
            Ok(Json(response))
        }
        Err(e) => {
            let error_response = ErrorResponse {
                error: "Database connection failed".to_string(),
                message: e.to_string(),
            };
            Err((StatusCode::SERVICE_UNAVAILABLE, Json(error_response)))
        }
    }
}

pub async fn readiness_check(
    State(state): State<HealthState>,
) -> Result<Json<serde_json::Value>, (StatusCode, Json<ErrorResponse>)> {
    // 就绪性检查 - 服务是否准备好接收请求
    match state.db.health_check().await {
        Ok(_) => {
            let response = serde_json::json!({
                "ready": true,
                "timestamp": chrono::Utc::now().to_rfc3339(),
                "checks": {
                    "database": "ready"
                }
            });
            Ok(Json(response))
        }
        Err(e) => {
            let error_response = ErrorResponse {
                error: "Service not ready".to_string(),
                message: e.to_string(),
            };
            Err((StatusCode::SERVICE_UNAVAILABLE, Json(error_response)))
        }
    }
}

pub async fn liveness_check() -> Json<serde_json::Value> {
    // 存活性检查 - 服务是否正在运行
    let response = serde_json::json!({
        "alive": true,
        "timestamp": chrono::Utc::now().to_rfc3339()
    });
    Json(response)
}