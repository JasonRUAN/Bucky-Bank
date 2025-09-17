# BuckyBank 索引器

高性能的 SUI 区块链事件索引器，用于监听 BuckyBank 智能合约事件并存储到 PostgreSQL 数据库。

## 功能特性

- 🚀 **高性能**: 使用异步 Rust 和连接池优化
- 🔄 **容错性**: 内置重试机制和错误处理
- 📊 **监控**: 内置健康检查和监控端点
- 🛡️ **可靠性**: 支持断点续传和批量处理
- 🔧 **可扩展**: 模块化设计，易于添加新事件类型

## 已实现事件

目前支持以下事件类型：

- `BuckyBankCreated`: 存钱罐创建事件

## 快速开始

### 1. 环境要求

- Rust 1.70+
- PostgreSQL 12+
- SUI 区块链 RPC 节点

### 2. 安装依赖

```bash
cargo build --release
```

### 3. 配置方式

索引器支持多种配置方式：

#### 方式 1: 使用配置文件（推荐）

复制配置文件示例：

```bash
# TOML 格式
cp config.example.toml config.toml
# 或 JSON 格式
cp config.example.json config.json
```

编辑配置文件，填入你的配置：

```toml
# config.toml 示例
[database]
url = "postgresql://postgres:password@localhost:5432/bucky_bank"
max_connections = 10
min_connections = 2
connection_timeout_seconds = 30

[sui]
rpc_url = "https://fullnode.mainnet.sui.io:443"
package_id = "your_package_id_here"  # 必须配置
module_name = "bucky_bank"
query_limit = 50

[server]
host = "127.0.0.1"
port = 8080

[indexing]
poll_interval_seconds = 30
batch_size = 100
max_retries = 3
```

#### 方式 2: 使用环境变量

复制环境变量示例文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
# 数据库配置
DATABASE_URL=postgresql://postgres:password@localhost:5432/bucky_bank
DB_MAX_CONNECTIONS=10
DB_MIN_CONNECTIONS=2
DB_CONNECTION_TIMEOUT=30

# SUI 区块链配置
SUI_RPC_URL=https://fullnode.mainnet.sui.io:443
SUI_PACKAGE_ID=your_package_id_here
SUI_MODULE_NAME=bucky_bank
SUI_QUERY_LIMIT=50

# 服务器配置
SERVER_HOST=127.0.0.1
SERVER_PORT=8080

# 索引器配置
INDEXING_POLL_INTERVAL=30
INDEXING_BATCH_SIZE=100
```

**注意**: 配置文件和环境变量可以同时使用，环境变量的优先级更高，可以覆盖配置文件中的设置。

支持的配置文件格式：
- **TOML** (`.toml`): 推荐格式，易于阅读和编辑
- **JSON** (`.json`): 结构化数据格式
- **YAML** (`.yaml` 或 `.yml`): 人类可读的数据格式

### 4. 数据库设置

确保已经创建了数据库表，使用提供的迁移文件：

```bash
psql -d bucky_bank -f ../migrations/20250917014345_tables.sql
```

### 5. 运行索引器

#### 使用配置文件运行（推荐）

```bash
# 使用 TOML 配置文件
cargo run -- --config config.toml run

# 使用 JSON 配置文件
cargo run -- --config config.json run

# 或使用短参数
cargo run -- -c config.toml run
```

#### 使用环境变量运行

```bash
# 不指定配置文件，使用环境变量或默认配置
cargo run -- run
```

#### 各种运行模式

#### 仅运行索引器
```bash
cargo run -- --config config.toml index
```

#### 仅运行健康检查服务器
```bash
cargo run -- --config config.toml server
```

#### 同时运行索引器和服务器（推荐）
```bash
cargo run -- --config config.toml run
```

#### 初始化数据库连接测试
```bash
cargo run -- --config config.toml init-db
```

## API 端点

### 健康检查

- `GET /health`: 完整健康检查（包括数据库）
- `GET /ready`: 就绪性检查
- `GET /live`: 存活性检查

示例响应：
```json
{
  "status": "healthy",
  "database": "connected",
  "timestamp": "2024-01-01T00:00:00Z",
  "uptime_seconds": 120
}
```

## 项目结构

```
indexer/
├── src/
│   ├── main.rs          # 主程序入口
│   ├── config.rs        # 配置管理
│   ├── database.rs      # 数据库连接和模型
│   ├── events.rs        # 事件订阅和处理
│   └── health.rs        # 健康检查
├── Cargo.toml           # 项目依赖
├── .env.example         # 环境变量示例
└── README.md           # 项目文档
```

## 开发指南

### 添加新事件类型

1. 在 `events.rs` 中添加新的事件处理器
2. 在 `database.rs` 中添加对应的数据模型
3. 在 `EventIndexer` 中注册新的事件处理器

示例：

```rust
// 在 events.rs 中添加
pub async fn handle_new_event(&self, event: &SuiEvent) -> Result<()> {
    // 处理逻辑
}
```

### 性能优化

- 调整 `INDEXING_BATCH_SIZE` 控制每次查询的事件数量
- 调整 `INDEXING_POLL_INTERVAL` 控制轮询频率
- 调整 `DB_MAX_CONNECTIONS` 控制数据库连接池大小

### 监控和日志

- 使用 `RUST_LOG` 环境变量控制日志级别
- 健康检查端点可用于容器编排系统的探针
- 监控 `/health` 端点的响应时间和状态

## 生产环境部署

### Docker 部署

```dockerfile
FROM rust:1.70-slim as builder
WORKDIR /app
COPY . .
RUN cargo build --release

FROM debian:bullseye-slim
RUN apt-get update && apt-get install -y ca-certificates
COPY --from=builder /app/target/release/bucky_bank_indexer /usr/local/bin/
CMD ["bucky_bank_indexer", "run"]
```

### 环境变量

生产环境建议设置：

```env
RUST_LOG=warn
INDEXING_POLL_INTERVAL=60
INDEXING_BATCH_SIZE=200
DB_MAX_CONNECTIONS=20
```

### 监控

- 配置 Prometheus 或类似系统监控 `/health` 端点
- 设置适当的告警规则
- 监控数据库连接池使用情况

## 故障排除

### 常见问题

1. **数据库连接失败**
   - 检查 `DATABASE_URL` 配置
   - 确认 PostgreSQL 服务正在运行
   - 检查网络连接

2. **SUI RPC 连接失败**
   - 检查 `SUI_RPC_URL` 配置
   - 确认 RPC 节点可访问
   - 检查 API 限制

3. **事件处理失败**
   - 检查 `SUI_PACKAGE_ID` 是否正确
   - 确认合约已部署且事件格式正确
   - 查看详细日志了解错误原因

### 调试模式

启用详细日志：

```bash
RUST_LOG=debug cargo run -- run
```

## 许可证

MIT License