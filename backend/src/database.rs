use sqlx::{PgPool, Row};
use anyhow::Result;
use crate::models::{BuckyBankCreatedEvent, QueryParams, DepositMadeEvent, DepositQueryParams, WithdrawalRequest, WithdrawalRequestQueryParams, WithdrawedEvent, WithdrawedEventQueryParams};

pub struct Database {
    pool: PgPool,
}

impl Database {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn get_bucky_banks(&self, params: QueryParams) -> Result<(Vec<BuckyBankCreatedEvent>, i64)> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(10);
        let offset = (page - 1) * limit;

        // 构建基础查询
        let mut query = "SELECT * FROM bucky_bank_created_events".to_string();
        let mut count_query = "SELECT COUNT(*) FROM bucky_bank_created_events".to_string();
        let mut conditions = Vec::new();
        let mut bind_values = Vec::new();
        let mut param_index = 1;

        // 添加过滤条件
        if let Some(parent_addr) = &params.parent_address {
            conditions.push(format!("parent_address = ${}", param_index));
            bind_values.push(parent_addr.clone());
            param_index += 1;
        }

        if let Some(child_addr) = &params.child_address {
            conditions.push(format!("child_address = ${}", param_index));
            bind_values.push(child_addr.clone());
            param_index += 1;
        }

        // 如果有条件，添加 WHERE 子句
        if !conditions.is_empty() {
            let where_clause = format!(" WHERE {}", conditions.join(" AND "));
            query.push_str(&where_clause);
            count_query.push_str(&where_clause);
        }

        // 添加排序和分页
        query.push_str(&format!(" ORDER BY created_at DESC LIMIT ${} OFFSET ${}", param_index, param_index + 1));

        // 执行计数查询
        let mut count_query_builder = sqlx::query(&count_query);
        for value in &bind_values {
            count_query_builder = count_query_builder.bind(value);
        }
        
        let total: i64 = count_query_builder
            .fetch_one(&self.pool)
            .await?
            .get(0);

        // 执行数据查询
        let mut data_query_builder = sqlx::query_as::<_, BuckyBankCreatedEvent>(&query);
        for value in &bind_values {
            data_query_builder = data_query_builder.bind(value);
        }
        data_query_builder = data_query_builder.bind(limit).bind(offset);

        let events = data_query_builder.fetch_all(&self.pool).await?;

        Ok((events, total))
    }

    pub async fn get_bucky_bank_by_id(&self, bucky_bank_id: &str) -> Result<Option<BuckyBankCreatedEvent>> {
        let event = sqlx::query_as::<_, BuckyBankCreatedEvent>(
            "SELECT * FROM bucky_bank_created_events WHERE bucky_bank_id = $1"
        )
        .bind(bucky_bank_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(event)
    }

    pub async fn get_deposits_by_bucky_bank_id(&self, bucky_bank_id: &str, params: DepositQueryParams) -> Result<(Vec<DepositMadeEvent>, i64)> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(10);
        let offset = (page - 1) * limit;

        // 执行计数查询
        let total: i64 = sqlx::query(
            "SELECT COUNT(*) FROM deposit_made_events WHERE bucky_bank_id = $1"
        )
        .bind(bucky_bank_id)
        .fetch_one(&self.pool)
        .await?
        .get(0);

        // 执行数据查询，按存款时间倒序排列
        let deposits = sqlx::query_as::<_, DepositMadeEvent>(
            "SELECT * FROM deposit_made_events WHERE bucky_bank_id = $1 ORDER BY created_at_ms DESC LIMIT $2 OFFSET $3"
        )
        .bind(bucky_bank_id)
        .bind(limit)
        .bind(offset)
        .fetch_all(&self.pool)
        .await?;

        Ok((deposits, total))
    }

    pub async fn get_withdrawal_requests_by_bucky_bank_id(&self, bucky_bank_id: &str, params: WithdrawalRequestQueryParams) -> Result<(Vec<WithdrawalRequest>, i64)> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(10);
        let offset = (page - 1) * limit;

        // 构建基础查询
        let mut query = "SELECT * FROM withdrawal_requests WHERE bucky_bank_id = $1".to_string();
        let mut count_query = "SELECT COUNT(*) FROM withdrawal_requests WHERE bucky_bank_id = $1".to_string();
        let mut conditions = Vec::new();
        let mut bind_values = vec![bucky_bank_id.to_string()];
        let mut param_index = 2;

        // 添加过滤条件
        if let Some(status) = &params.status {
            conditions.push(format!("status = ${}", param_index));
            bind_values.push(status.clone());
            param_index += 1;
        }

        if let Some(requester) = &params.requester {
            conditions.push(format!("requester = ${}", param_index));
            bind_values.push(requester.clone());
            param_index += 1;
        }

        // 如果有额外条件，添加到查询中
        if !conditions.is_empty() {
            let additional_conditions = format!(" AND {}", conditions.join(" AND "));
            query.push_str(&additional_conditions);
            count_query.push_str(&additional_conditions);
        }

        // 添加排序和分页
        query.push_str(&format!(" ORDER BY created_at_ms DESC LIMIT ${} OFFSET ${}", param_index, param_index + 1));

        // 执行计数查询
        let mut count_query_builder = sqlx::query(&count_query);
        for value in &bind_values {
            count_query_builder = count_query_builder.bind(value);
        }
        
        let total: i64 = count_query_builder
            .fetch_one(&self.pool)
            .await?
            .get(0);

        // 执行数据查询
        let mut data_query_builder = sqlx::query_as::<_, WithdrawalRequest>(&query);
        for value in &bind_values {
            data_query_builder = data_query_builder.bind(value);
        }
        data_query_builder = data_query_builder.bind(limit).bind(offset);

        let requests = data_query_builder.fetch_all(&self.pool).await?;

        Ok((requests, total))
    }

    pub async fn get_withdrawal_requests_by_requester(&self, requester: &str, params: WithdrawalRequestQueryParams) -> Result<(Vec<WithdrawalRequest>, i64)> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(10);
        let offset = (page - 1) * limit;

        // 构建基础查询
        let mut query = "SELECT * FROM withdrawal_requests WHERE requester = $1".to_string();
        let mut count_query = "SELECT COUNT(*) FROM withdrawal_requests WHERE requester = $1".to_string();
        let mut conditions = Vec::new();
        let mut bind_values = vec![requester.to_string()];
        let mut param_index = 2;

        // 添加过滤条件
        if let Some(status) = &params.status {
            conditions.push(format!("status = ${}", param_index));
            bind_values.push(status.clone());
            param_index += 1;
        }

        // 如果有额外条件，添加到查询中
        if !conditions.is_empty() {
            let additional_conditions = format!(" AND {}", conditions.join(" AND "));
            query.push_str(&additional_conditions);
            count_query.push_str(&additional_conditions);
        }

        // 添加排序和分页
        query.push_str(&format!(" ORDER BY created_at_ms DESC LIMIT ${} OFFSET ${}", param_index, param_index + 1));

        // 执行计数查询
        let mut count_query_builder = sqlx::query(&count_query);
        for value in &bind_values {
            count_query_builder = count_query_builder.bind(value);
        }
        
        let total: i64 = count_query_builder
            .fetch_one(&self.pool)
            .await?
            .get(0);

        // 执行数据查询
        let mut data_query_builder = sqlx::query_as::<_, WithdrawalRequest>(&query);
        for value in &bind_values {
            data_query_builder = data_query_builder.bind(value);
        }
        data_query_builder = data_query_builder.bind(limit).bind(offset);

        let requests = data_query_builder.fetch_all(&self.pool).await?;

        Ok((requests, total))
    }

    pub async fn get_withdrawals_by_bucky_bank_id(&self, bucky_bank_id: &str, params: WithdrawedEventQueryParams) -> Result<(Vec<WithdrawedEvent>, i64)> {
        let page = params.page.unwrap_or(1);
        let limit = params.limit.unwrap_or(10);
        let offset = (page - 1) * limit;

        // 获取总数
        let total: i64 = sqlx::query_scalar!(
            "SELECT COUNT(*) FROM withdrawed_events WHERE bucky_bank_id = $1",
            bucky_bank_id
        )
        .fetch_one(&self.pool)
        .await?
        .unwrap_or(0);

        // 获取分页数据
        let withdrawals = sqlx::query_as!(
            WithdrawedEvent,
            "SELECT * FROM withdrawed_events WHERE bucky_bank_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3",
            bucky_bank_id,
            limit,
            offset
        )
        .fetch_all(&self.pool)
        .await?;

        Ok((withdrawals, total))
    }
}