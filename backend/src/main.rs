mod database;
mod handlers;
mod models;

use axum::{
    Router,
    extract::Request,
    middleware::{self, Next},
    response::Response,
    routing::get,
};
use dotenv::dotenv;
use log::info;
use sqlx::PgPool;
use std::{env, sync::Arc, time::Instant};
use tower_http::cors::CorsLayer;

// 日志中间件
async fn logging_middleware(request: Request, next: Next) -> Response {
    let start_time = Instant::now();
    let method = request.method().clone();
    let uri = request.uri().clone();
    let user_agent = request
        .headers()
        .get("user-agent")
        .and_then(|h| h.to_str().ok())
        .unwrap_or("Unknown");

    info!("收到请求 - {} {} - User-Agent: {}", method, uri, user_agent);

    let response = next.run(request).await;
    let duration = start_time.elapsed();
    let status = response.status();

    info!(
        "请求完成 - {} {} - 状态: {} - 耗时: {:?}",
        method, uri, status, duration
    );

    response
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // 初始化日志系统
    env_logger::init();

    // 加载环境变量
    dotenv().ok();

    println!(">>> Starting BuckyBank backend server...");
    info!("Starting BuckyBank backend server...");

    // 获取配置
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgresql://postgres:password@localhost:5432/bucky_bank".to_string());
    let port = env::var("SERVER_PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse::<u16>()
        .unwrap_or(3001);

    info!(">>> Config: database_url={}, port={}", database_url, port);

    // 连接数据库
    info!("Connecting to database: {}", database_url);
    let pool = PgPool::connect(&database_url).await?;
    info!("Database connection established successfully");

    // 运行数据库迁移（可选）
    info!("Running database migrations...");
    sqlx::migrate!("./migrations").run(&pool).await.ok();
    info!("Database migrations completed");

    let db = Arc::new(database::Database::new(pool));

    // 创建路由
    let app = Router::new()
        .route("/health", get(handlers::health_check))
        .route("/api/bucky-banks", get(handlers::get_bucky_banks))
        .route("/api/bucky-banks/:id", get(handlers::get_bucky_bank_by_id))
        .route(
            "/api/bucky-banks/:id/deposits",
            get(handlers::get_deposits_by_bucky_bank_id),
        )
        .route(
            "/api/bucky-banks/:id/withdrawals",
            get(handlers::get_withdrawals_by_bucky_bank_id),
        )
        .route(
            "/api/bucky-banks/:id/withdrawal-requests",
            get(handlers::get_withdrawal_requests_by_bucky_bank_id),
        )
        .route(
            "/api/withdrawal-requests/requester/:requester",
            get(handlers::get_withdrawal_requests_by_requester),
        )
        .layer(middleware::from_fn(logging_middleware))
        .layer(CorsLayer::permissive())
        .with_state(db);

    // 启动服务器
    let listener = tokio::net::TcpListener::bind(format!("0.0.0.0:{}", port)).await?;
    info!("Server running on http://0.0.0.0:{}", port);

    axum::serve(listener, app).await?;

    Ok(())
}
