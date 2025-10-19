use sqlx::{PgPool, Row};
use anyhow::Result;
use crate::models::{BuckyBankCreatedEvent, QueryParams};

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
}