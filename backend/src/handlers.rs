use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use log::{info, error, warn};
use serde_json::{json, Value};
use std::{sync::Arc, time::Instant};

use crate::database::Database;
use crate::models::{BuckyBankResponse, QueryParams};

pub async fn get_bucky_banks(
    State(db): State<Arc<Database>>,
    Query(params): Query<QueryParams>,
) -> Result<Json<Value>, StatusCode> {
    let start_time = Instant::now();
    info!("收到获取BuckyBanks列表请求 - 参数: {:?}", params);
    
    match db.get_bucky_banks(params).await {
        Ok((events, total)) => {
            let duration = start_time.elapsed();
            info!("成功获取BuckyBanks列表 - 数量: {}, 总计: {}, 耗时: {:?}", 
                  events.len(), total, duration);
            
            let response = BuckyBankResponse {
                success: true,
                data: events,
                total,
            };
            Ok(Json(json!(response)))
        }
        Err(e) => {
            let duration = start_time.elapsed();
            error!("获取BuckyBanks列表失败 - 错误: {}, 耗时: {:?}", e, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "Failed to fetch bucky banks",
                "data": [],
                "total": 0
            })))
        }
    }
}

pub async fn get_bucky_bank_by_id(
    State(db): State<Arc<Database>>,
    Path(bucky_bank_id): Path<String>,
) -> Result<Json<Value>, StatusCode> {
    let start_time = Instant::now();
    info!("收到获取单个BuckyBank请求 - ID: {}", bucky_bank_id);
    
    match db.get_bucky_bank_by_id(&bucky_bank_id).await {
        Ok(Some(event)) => {
            let duration = start_time.elapsed();
            info!("成功获取BuckyBank - ID: {}, 耗时: {:?}", bucky_bank_id, duration);
            
            Ok(Json(json!({
                "success": true,
                "data": event
            })))
        }
        Ok(None) => {
            let duration = start_time.elapsed();
            warn!("BuckyBank未找到 - ID: {}, 耗时: {:?}", bucky_bank_id, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "BuckyBank not found",
                "data": null
            })))
        }
        Err(e) => {
            let duration = start_time.elapsed();
            error!("获取BuckyBank失败 - ID: {}, 错误: {}, 耗时: {:?}", 
                   bucky_bank_id, e, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "Failed to fetch bucky bank",
                "data": null
            })))
        }
    }
}

pub async fn health_check() -> Json<Value> {
    info!("收到健康检查请求");
    
    Json(json!({
        "status": "ok",
        "message": "BuckyBank API is running"
    }))
}