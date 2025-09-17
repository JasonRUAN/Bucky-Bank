use serde::Deserialize;
use std::env;
use std::path::Path;

#[derive(Debug, Deserialize)]
pub struct Config {
    pub database: DatabaseConfig,
    pub sui: SuiConfig,
    pub server: ServerConfig,
    pub indexing: IndexingConfig,
}

#[derive(Debug, Deserialize)]
pub struct DatabaseConfig {
    pub url: String,
    pub max_connections: u32,
    pub min_connections: u32,
    pub connection_timeout_seconds: u64,
}

#[derive(Debug, Deserialize)]
pub struct SuiConfig {
    pub rpc_url: String,
    pub package_id: String,
    pub module_name: String,
    pub query_limit: usize,
}

#[derive(Debug, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Deserialize)]
pub struct IndexingConfig {
    pub poll_interval_seconds: u64,
    pub batch_size: usize,
    pub max_retries: u32,
}

impl Config {
    /// 从环境变量加载配置
    pub fn from_env() -> anyhow::Result<Self> {
        dotenvy::dotenv().ok();

        let config = config::Config::builder()
            .add_source(config::Environment::default().separator("__"))
            .build()?;

        let config: Config = config.try_deserialize()?;

        // 验证必要配置
        if config.sui.package_id.is_empty() {
            return Err(anyhow::anyhow!(
                "SUI_PACKAGE_ID environment variable is required"
            ));
        }

        Ok(config)
    }

    /// 从配置文件加载配置，支持 TOML、JSON、YAML 格式
    pub fn from_file<P: AsRef<Path>>(path: P) -> anyhow::Result<Self> {
        let path = path.as_ref();

        if !path.exists() {
            return Err(anyhow::anyhow!("配置文件不存在: {}", path.display()));
        }

        // 加载 .env 文件（如果存在）
        dotenvy::dotenv().ok();

        let mut builder = config::Config::builder();

        // 根据文件扩展名选择配置格式
        match path.extension().and_then(|ext| ext.to_str()) {
            Some("toml") => {
                builder = builder.add_source(
                    config::File::with_name(path.to_str().unwrap())
                        .format(config::FileFormat::Toml),
                );
            }
            Some("json") => {
                builder = builder.add_source(
                    config::File::with_name(path.to_str().unwrap())
                        .format(config::FileFormat::Json),
                );
            }
            Some("yaml") | Some("yml") => {
                builder = builder.add_source(
                    config::File::with_name(path.to_str().unwrap())
                        .format(config::FileFormat::Yaml),
                );
            }
            _ => {
                // 默认尝试 TOML 格式
                builder = builder.add_source(
                    config::File::with_name(path.to_str().unwrap())
                        .format(config::FileFormat::Toml),
                );
            }
        }

        // 环境变量优先级更高，可以覆盖文件中的配置
        builder = builder.add_source(config::Environment::default().separator("__"));

        let config = builder.build()?;
        let config: Config = config.try_deserialize()?;

        // 验证必要配置
        if config.sui.package_id.is_empty() {
            return Err(anyhow::anyhow!("package_id 配置项是必需的"));
        }

        Ok(config)
    }

    /// 从文件或环境变量加载配置
    pub fn load(config_file: Option<String>) -> anyhow::Result<Self> {
        match config_file {
            Some(path) => Self::from_file(path),
            None => Self::from_env(),
        }
    }

    pub fn development() -> Self {
        Self {
            database: DatabaseConfig {
                url: env::var("DATABASE_URL").unwrap_or_else(|_| {
                    "postgresql://postgres:password@localhost:5432/bucky_bank".to_string()
                }),
                max_connections: env::var("DB_MAX_CONNECTIONS")
                    .unwrap_or_else(|_| "10".to_string())
                    .parse()
                    .unwrap_or(10),
                min_connections: env::var("DB_MIN_CONNECTIONS")
                    .unwrap_or_else(|_| "2".to_string())
                    .parse()
                    .unwrap_or(2),
                connection_timeout_seconds: env::var("DB_CONNECTION_TIMEOUT")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()
                    .unwrap_or(30),
            },
            sui: SuiConfig {
                rpc_url: env::var("SUI_RPC_URL")
                    .unwrap_or_else(|_| "https://fullnode.mainnet.sui.io:443".to_string()),
                package_id: env::var("SUI_PACKAGE_ID").unwrap_or_else(|_| "".to_string()),
                module_name: env::var("SUI_MODULE_NAME")
                    .unwrap_or_else(|_| "bucky_bank".to_string()),
                query_limit: env::var("SUI_QUERY_LIMIT")
                    .unwrap_or_else(|_| "50".to_string())
                    .parse()
                    .unwrap_or(50),
            },
            server: ServerConfig {
                host: env::var("SERVER_HOST").unwrap_or_else(|_| "127.0.0.1".to_string()),
                port: env::var("SERVER_PORT")
                    .unwrap_or_else(|_| "8080".to_string())
                    .parse()
                    .unwrap_or(8080),
            },
            indexing: IndexingConfig {
                poll_interval_seconds: env::var("INDEXING_POLL_INTERVAL")
                    .unwrap_or_else(|_| "30".to_string())
                    .parse()
                    .unwrap_or(30),
                batch_size: env::var("INDEXING_BATCH_SIZE")
                    .unwrap_or_else(|_| "100".to_string())
                    .parse()
                    .unwrap_or(100),
                max_retries: env::var("INDEXING_MAX_RETRIES")
                    .unwrap_or_else(|_| "3".to_string())
                    .parse()
                    .unwrap_or(3),
            },
        }
    }
}
