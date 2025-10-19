use anyhow::Result;
use clap::{Parser, Subcommand};
use std::sync::Arc;
use sui_sdk::SuiClientBuilder;
use tokio::signal;
use tracing::{Instrument, error, info, info_span};

mod config;
mod database;
mod handlers;
mod health;
mod indexer;
mod logging;

use config::Config;
use database::Database;
use health::{HealthState, health_routes};
use indexer::BuckyBankIndexer;
use logging::init_logging;

#[derive(Parser)]
#[command(author, version, about, long_about = None)]
struct Cli {
    #[command(subcommand)]
    command: Option<Commands>,

    /// 配置文件路径
    #[arg(short, long)]
    config: Option<String>,

    /// 运行模式
    #[arg(short, long, default_value = "index")]
    mode: String,
}

#[derive(Subcommand)]
enum Commands {
    /// 运行索引器
    Index,
    /// 运行健康检查服务器
    Server,
    /// 运行索引器和健康检查服务器
    Run,
    /// 初始化数据库
    InitDb,
}

#[tokio::main]
async fn main() -> Result<()> {
    // 初始化日志系统
    init_logging()?;

    let cli = Cli::parse();

    // 加载配置
    let config = if let Some(config_path) = cli.config {
        info!("Loading configuration from {}", config_path);
        Config::load(Some(config_path))?
    } else {
        info!("Loading development configuration");
        Config::development()
    };

    info!("Configuration loaded, db: {}", config.database.url);

    match cli.command.unwrap_or(Commands::Run) {
        Commands::Index => {
            info!("Starting indexer mode");
            run_indexer(&config).await?;
        }
        Commands::Server => {
            info!("Starting server mode");
            run_server(&config).await?;
        }
        Commands::Run => {
            info!("Starting indexer and server mode");
            run_both(config).await?;
        }
        Commands::InitDb => {
            info!("Initializing database");
            init_database(&config).await?;
        }
    }

    Ok(())
}

async fn run_indexer(config: &Config) -> Result<()> {
    // 初始化数据库连接
    let db = Arc::new(Database::new(&config.database).await?);

    // 初始化SUI客户端
    let sui_client = Arc::new(
        SuiClientBuilder::default()
            .build(&config.sui.rpc_url)
            .await?,
    );

    // 创建事件索引器
    let event_indexer = BuckyBankIndexer::new(
        sui_client,
        config.sui.package_id.clone(),
        config.sui.module_name.clone(),
        db,
    );

    // 启动持续轮询
    let span = info_span!("continuous_polling");
    tokio::select! {
        result = event_indexer.run_continuous_polling().instrument(span) => {
            match result {
                Ok(_) => {
                    info!("Polling completed normally");
                    Ok(())
                }
                Err(e) => {
                    error!("Polling failed: {}", e);
                    Err(e)
                }
            }
        }
        _ = tokio::signal::ctrl_c() => {
            info!("Received Ctrl+C, shutting down gracefully");
            Ok(())
        }
    }
}

async fn run_server(config: &Config) -> Result<()> {
    let db = Arc::new(Database::new(&config.database).await?);

    let health_state = HealthState {
        db: db.clone(),
        start_time: std::time::Instant::now(),
    };

    let app = health_routes(health_state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!("Health check server listening on {}", addr);

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn run_both(config: Config) -> Result<()> {
    let config = Arc::new(config);
    let db = Arc::new(Database::new(&config.database).await?);

    // 启动健康检查服务器
    let health_state = HealthState {
        db: db.clone(),
        start_time: std::time::Instant::now(),
    };

    let app = health_routes(health_state);

    let addr = format!("{}:{}", config.server.host, config.server.port);
    let listener = tokio::net::TcpListener::bind(&addr).await?;

    info!("Health check server listening on {}", addr);

    let server_handle = tokio::spawn(async move {
        axum::serve(listener, app)
            .with_graceful_shutdown(shutdown_signal())
            .await
    });

    // 启动索引器
    let config_clone = config.clone();
    let indexer_handle = tokio::spawn(async move { run_indexer(&config_clone).await });

    // 等待其中一个任务完成
    tokio::select! {
        result = server_handle => {
            if let Err(e) = result {
                error!("Server task failed: {}", e);
            }
        }
        result = indexer_handle => {
            if let Err(e) = result {
                error!("Indexer task failed: {}", e);
            }
        }
    }

    Ok(())
}

async fn init_database(config: &Config) -> Result<()> {
    let db = Database::new(&config.database).await?;
    info!("Database connection successful");

    // 测试基本查询
    let _ = db.get_latest_event_timestamp().await?;
    info!("Database tables are accessible");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("Failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("Failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {
            info!("Received Ctrl+C, shutting down");
        }
        _ = terminate => {
            info!("Received terminate signal, shutting down");
        }
    }
}
