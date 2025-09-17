use axum::{extract::State, http::StatusCode, response::Json, routing::get, Router};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use crate::database::Database;

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