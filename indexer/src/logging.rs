use anyhow::Result;
use std::path::Path;
use tracing_appender::{non_blocking, rolling};
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

pub fn init_logging() -> Result<()> {
    // 创建日志目录
    let log_dir = Path::new("logs");
    if !log_dir.exists() {
        std::fs::create_dir_all(log_dir)?;
    }

    // 设置日志级别过滤
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    // 创建文件日志写入器（按天滚动）
    let file_appender = rolling::daily(log_dir, "bucky_bank_indexer.log");
    let (non_blocking_file, _guard) = non_blocking(file_appender);

    // 创建控制台日志层
    let stdout_layer = fmt::layer()
        .pretty()
        .with_ansi(true)
        .with_target(false)
        .with_thread_ids(true)
        .with_thread_names(true);

    // 创建文件日志层（JSON格式，适合后续分析）
    let file_layer = fmt::layer()
        .json()
        .with_current_span(true)
        .with_span_list(true)
        .with_writer(non_blocking_file);

    // 初始化全局订阅器
    tracing_subscriber::registry()
        .with(env_filter)
        .with(stdout_layer)
        .with(file_layer)
        .init();

    tracing::info!("日志系统初始化完成 - 日志将同时输出到控制台和文件");

    Ok(())
}