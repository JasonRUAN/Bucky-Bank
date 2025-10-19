use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    response::Json,
};
use log::{info, error, warn};
use serde_json::{json, Value};
use std::{sync::Arc, time::Instant};

use crate::database::Database;
use crate::models::{BuckyBankResponse, QueryParams, DepositResponse, DepositQueryParams, WithdrawalRequestResponse, WithdrawalRequestQueryParams, WithdrawedEventResponse, WithdrawedEventQueryParams};

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

pub async fn get_deposits_by_bucky_bank_id(
    State(db): State<Arc<Database>>,
    Path(bucky_bank_id): Path<String>,
    Query(params): Query<DepositQueryParams>,
) -> Result<Json<Value>, StatusCode> {
    let start_time = Instant::now();
    info!("收到获取存款记录请求 - BuckyBank ID: {}, 参数: {:?}", bucky_bank_id, params);
    
    match db.get_deposits_by_bucky_bank_id(&bucky_bank_id, params).await {
        Ok((deposits, total)) => {
            let duration = start_time.elapsed();
            info!("成功获取存款记录 - BuckyBank ID: {}, 数量: {}, 总计: {}, 耗时: {:?}", 
                  bucky_bank_id, deposits.len(), total, duration);
            
            let response = DepositResponse {
                success: true,
                data: deposits,
                total,
            };
            Ok(Json(json!(response)))
        }
        Err(e) => {
            let duration = start_time.elapsed();
            error!("获取存款记录失败 - BuckyBank ID: {}, 错误: {}, 耗时: {:?}", 
                   bucky_bank_id, e, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "Failed to fetch deposits",
                "data": [],
                "total": 0
            })))
        }
    }
}

pub async fn get_withdrawal_requests_by_bucky_bank_id(
    State(db): State<Arc<Database>>,
    Path(bucky_bank_id): Path<String>,
    Query(params): Query<WithdrawalRequestQueryParams>,
) -> Result<Json<Value>, StatusCode> {
    let start_time = Instant::now();
    info!("收到获取取款请求记录请求 - BuckyBank ID: {}, 参数: {:?}", bucky_bank_id, params);
    
    match db.get_withdrawal_requests_by_bucky_bank_id(&bucky_bank_id, params).await {
        Ok((requests, total)) => {
            let duration = start_time.elapsed();
            info!("成功获取取款请求记录 - BuckyBank ID: {}, 数量: {}, 总计: {}, 耗时: {:?}", 
                  bucky_bank_id, requests.len(), total, duration);
            
            let response = WithdrawalRequestResponse {
                success: true,
                data: requests,
                total,
            };
            Ok(Json(json!(response)))
        }
        Err(e) => {
            let duration = start_time.elapsed();
            error!("获取取款请求记录失败 - BuckyBank ID: {}, 错误: {}, 耗时: {:?}", 
                   bucky_bank_id, e, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "Failed to fetch withdrawal requests",
                "data": [],
                "total": 0
            })))
        }
    }
}

pub async fn get_withdrawal_requests_by_requester(
    State(db): State<Arc<Database>>,
    Path(requester): Path<String>,
    Query(params): Query<WithdrawalRequestQueryParams>,
) -> Result<Json<Value>, StatusCode> {
    let start_time = Instant::now();
    info!("收到获取用户取款请求记录请求 - 请求者: {}, 参数: {:?}", requester, params);
    
    match db.get_withdrawal_requests_by_requester(&requester, params).await {
        Ok((requests, total)) => {
            let duration = start_time.elapsed();
            info!("成功获取用户取款请求记录 - 请求者: {}, 数量: {}, 总计: {}, 耗时: {:?}", 
                  requester, requests.len(), total, duration);
            
            let response = WithdrawalRequestResponse {
                success: true,
                data: requests,
                total,
            };
            Ok(Json(json!(response)))
        }
        Err(e) => {
            let duration = start_time.elapsed();
            error!("获取用户取款请求记录失败 - 请求者: {}, 错误: {}, 耗时: {:?}", 
                   requester, e, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "Failed to fetch withdrawal requests",
                "data": [],
                "total": 0
            })))
        }
    }
}

pub async fn get_withdrawals_by_bucky_bank_id(
    State(db): State<Arc<Database>>,
    Path(bucky_bank_id): Path<String>,
    Query(params): Query<WithdrawedEventQueryParams>,
) -> Result<Json<Value>, StatusCode> {
    let start_time = Instant::now();
    info!("收到获取取款记录请求 - BuckyBank ID: {}, 参数: {:?}", bucky_bank_id, params);
    
    match db.get_withdrawals_by_bucky_bank_id(&bucky_bank_id, params).await {
        Ok((withdrawals, total)) => {
            let duration = start_time.elapsed();
            info!("成功获取取款记录 - BuckyBank ID: {}, 数量: {}, 总计: {}, 耗时: {:?}", 
                  bucky_bank_id, withdrawals.len(), total, duration);
            
            let response = WithdrawedEventResponse {
                success: true,
                data: withdrawals,
                total,
            };
            Ok(Json(json!(response)))
        }
        Err(e) => {
            let duration = start_time.elapsed();
            error!("获取取款记录失败 - BuckyBank ID: {}, 错误: {}, 耗时: {:?}", 
                   bucky_bank_id, e, duration);
            
            Ok(Json(json!({
                "success": false,
                "error": "Failed to fetch withdrawals",
                "data": [],
                "total": 0
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