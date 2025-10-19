use crate::database::{
    Database,
    models::{NewBuckyBankCreatedEvent, NewDepositMadeEvent, NewWithdrawalRequestEvent, NewEventWithdrawedEvent, NewCursor, WithdrawalStatus},
};
use anyhow::Result;
use std::sync::Arc;
use sui_sdk::SuiClient;
use sui_sdk::rpc_types::{EventFilter, SuiEvent};
use sui_sdk::types::Identifier;
use sui_sdk::types::base_types::ObjectID;
use sui_sdk::types::event::EventID;
use tracing::{debug, error, info};

#[derive(Debug)]
pub struct EventProcessingResult {
    pub total_processed: usize,
    pub has_next_page: bool,
}

#[derive(Debug, Clone)]
pub enum EventType {
    BuckyBankCreated,
    DepositMade,
    WithdrawalRequested,
    WithdrawalApproved,
    WithdrawalRejected,
    EventWithdrawed,
}

impl EventType {
    pub fn name(&self) -> &'static str {
        match self {
            EventType::BuckyBankCreated => "BuckyBankCreated",
            EventType::DepositMade => "DepositMade",
            EventType::WithdrawalRequested => "EventWithdrawalRequested",
            EventType::WithdrawalApproved => "EventWithdrawalApproved",
            EventType::WithdrawalRejected => "EventWithdrawalRejected",
            EventType::EventWithdrawed => "EventWithdrawed",
        }
    }

    pub fn full_type(&self, package_id: &str, module_name: &str) -> String {
        format!("{}::{}::{}", package_id, module_name, self.name())
    }

    pub fn all_event_types() -> Vec<EventType> {
        vec![
            EventType::BuckyBankCreated, 
            EventType::DepositMade, 
            EventType::WithdrawalRequested,
            EventType::WithdrawalApproved,
            EventType::WithdrawalRejected,
            EventType::EventWithdrawed,
        ]
    }
}

pub struct BuckyBankIndexer {
    client: Arc<SuiClient>,
    package_id: String,
    module_name: String,
    db: Arc<Database>,
}

impl BuckyBankIndexer {
    pub fn new(
        client: Arc<SuiClient>,
        package_id: String,
        module_name: String,
        db: Arc<Database>,
    ) -> Self {
        Self {
            client,
            package_id,
            module_name,
            db,
        }
    }

    pub async fn query_and_process_events(&self) -> Result<EventProcessingResult> {
        info!("Querying all BuckyBank events...");

        let mut total_processed = 0;
        let mut has_next_page = false;

        for event_type in EventType::all_event_types() {
            info!("Processing {} events...", event_type.name());

            match self.query_and_process_events_for_type(&event_type).await {
                Ok((count, next_page)) => {
                    total_processed += count;
                    has_next_page = has_next_page || next_page;
                    info!("Processed {} {} events", count, event_type.name());
                }
                Err(e) => {
                    error!("Failed to process {} events: {}", event_type.name(), e);
                }
            }
        }

        Ok(EventProcessingResult {
            total_processed,
            has_next_page,
        })
    }

    pub async fn query_and_process_events_for_type(&self, event_type: &EventType) -> Result<(usize, bool)> {
        let full_event_type = event_type.full_type(&self.package_id, &self.module_name);

        info!(">>> Querying {} events with cursor...", event_type.name());

        // 获取最新的游标
        let cursor_data = self.get_latest_cursor(&full_event_type).await?;

        let package_id: ObjectID = self.package_id.parse()?;
        let module = Identifier::new(&*self.module_name)?;

        // 使用游标查询事件，如果没有游标则从头开始
        let result = if let Some((tx_digest, event_seq)) = cursor_data {
            info!(
                "Using cursor for {}: tx_digest={}, event_seq={}",
                event_type.name(), tx_digest, event_seq
            );
            let event_id = EventID {
                tx_digest: tx_digest.parse()?,
                event_seq: event_seq.parse()?,
            };
            self.client
                .event_api()
                .query_events(
                    EventFilter::MoveModule {
                        package: package_id,
                        module: module.clone(),
                    },
                    Some(event_id),
                    None,
                    false, // 按升序排列
                )
                .await?
        } else {
            info!("No cursor found for {}, starting from beginning", event_type.name());
            self.client
                .event_api()
                .query_events(
                    EventFilter::MoveModule {
                        package: package_id,
                        module,
                    },
                    None,
                    None,
                    false, // 按升序排列
                )
                .await?
        };

        info!("Found {} events for {}", result.data.len(), event_type.name());
        info!("Has next page for {}: {}", event_type.name(), result.has_next_page);

        let mut processed_count = 0;
        let mut latest_tx_digest = None;
        let mut latest_event_seq = None;

        for event in result.data {
            debug!("Processing event: {:?}", event.id);

            // 检查事件类型并处理
            if self.matches_event_type(&event, event_type) {
                match self.process_event(&event, event_type).await {
                    Ok(_) => {
                        processed_count += 1;
                        latest_tx_digest = Some(event.id.tx_digest.to_string());
                        latest_event_seq = Some(event.id.event_seq.to_string());
                        info!(
                            "Successfully processed {} event: {:?}",
                            event_type.name(), event.id
                        );
                    }
                    Err(e) => {
                        error!(
                            "Failed to process {} event {:?}: {}",
                            event_type.name(), event.id, e
                        );
                    }
                }
            }
        }

        // 更新游标
        if let (Some(tx_digest), Some(event_seq)) = (latest_tx_digest, latest_event_seq) {
            if processed_count > 0 {
                self.update_cursor(&full_event_type, &tx_digest, &event_seq)
                    .await?;
                info!(
                    "Updated cursor for {} to tx_digest={}, event_seq={} after processing {} events",
                    event_type.name(), tx_digest, event_seq, processed_count
                );
            }
        }

        info!("Processed {} {} events", processed_count, event_type.name());
        Ok((processed_count, result.has_next_page))
    }

    pub async fn run_continuous_polling(&self) -> Result<()> {
        loop {
            info!("next loop...");

            // 创建一个 pinned 的 ctrl_c future
            let ctrl_c = tokio::signal::ctrl_c();
            tokio::pin!(ctrl_c);

            // 使用 select! 同时监听轮询和关闭信号
            tokio::select! {
                // 轮询事件
                poll_result = self.query_and_process_events() => {
                    match poll_result {
                        Ok(result) => {
                            if result.has_next_page {
                                // 如果有下一页，立即继续处理
                                info!("Has more pages, continuing immediately...");
                                continue;
                            } else if result.total_processed > 0 {
                                // 如果处理了事件但没有了下一页，短暂等待后继续
                                info!("Processed events but no more pages, waiting 1 second...");
                                tokio::time::sleep(tokio::time::Duration::from_secs(1)).await;
                            } else {
                                // 如果没有处理任何事件，按照配置的间隔轮询
                                info!("No new events, waiting for next poll cycle...");
                                tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                                info!("wake up...");
                            }
                        }
                        Err(e) => {
                            error!("Error during polling: {}", e);
                            // 发生错误时短暂等待后重试
                            tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                        }
                    }
                }

                // 监听 Ctrl+C 信号
                _ = &mut ctrl_c => {
                    info!("Received shutdown signal, stopping polling");
                    break;
                }
            }

            info!("finish...");
        }
        Ok(())
    }

    async fn get_latest_cursor(&self, event_type: &str) -> Result<Option<(String, String)>> {
        match self.db.get_cursor(event_type).await? {
            Some(cursor) => Ok(Some((cursor.tx_digest, cursor.event_seq))),
            None => Ok(None),
        }
    }

    async fn update_cursor(
        &self,
        event_type: &str,
        tx_digest: &str,
        event_seq: &str,
    ) -> Result<()> {
        let cursor = NewCursor {
            id: event_type.to_string(),
            event_seq: event_seq.to_string(),
            tx_digest: tx_digest.to_string(),
        };

        self.db.save_cursor(&cursor).await?;
        Ok(())
    }

    fn matches_event_type(&self, event: &SuiEvent, event_type: &EventType) -> bool {
        // 检查事件类型
        let type_name = &event.type_.name;
        match event_type {
            EventType::BuckyBankCreated => type_name.as_str() == "BuckyBankCreated",
            EventType::DepositMade => type_name.as_str() == "DepositMade", 
            EventType::WithdrawalRequested => type_name.as_str() == "EventWithdrawalRequested",
            EventType::WithdrawalApproved => type_name.as_str() == "EventWithdrawalApproved",
            EventType::WithdrawalRejected => type_name.as_str() == "EventWithdrawalRejected",
            EventType::EventWithdrawed => type_name.as_str() == "EventWithdrawed",
        }
    }

    async fn process_event(&self, event: &SuiEvent, event_type: &EventType) -> Result<()> {
        match event_type {
            EventType::BuckyBankCreated => self.process_bucky_bank_created_event(event).await,
            EventType::DepositMade => self.process_deposit_made_event(event).await,
            EventType::WithdrawalRequested => self.process_withdrawal_requested_event(event).await,
            EventType::WithdrawalApproved => self.process_withdrawal_approved_event(event).await,
            EventType::WithdrawalRejected => self.process_withdrawal_rejected_event(event).await,
            EventType::EventWithdrawed => self.process_event_withdrawed_event(event).await,
        }
    }

    async fn process_bucky_bank_created_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing BuckyBankCreated event: {:?}", event.id);

        let parsed_data = &event.parsed_json;

        tracing::info!("Parsed data: {:?}", parsed_data);

        let bucky_bank_id = parsed_data
            .get("bucky_bank_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing bucky_bank_id"))?;

        let name = parsed_data
            .get("name")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing bucky bank name"))?;

        let parent_address = parsed_data
            .get("parent")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing parent_address"))?;

        let child_address = parsed_data
            .get("child")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing child_address"))?;

        let target_amount = parsed_data
            .get("target_amount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid target_amount"))?;

        let created_at_ms = parsed_data
            .get("created_at_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid created_at_ms"))?;

        let deadline_ms = parsed_data
            .get("deadline_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid deadline_ms"))?;

        let duration_days = parsed_data
            .get("duration_days")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid duration_days"))?;

        let current_balance = parsed_data
            .get("current_balance")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid current_balance"))?;

        let new_event = NewBuckyBankCreatedEvent {
            bucky_bank_id: bucky_bank_id.to_string(),
            name: name.to_string(),
            parent_address: parent_address.to_string(),
            child_address: child_address.to_string(),
            target_amount: target_amount as i64,
            created_at_ms: created_at_ms as i64,
            deadline_ms: deadline_ms as i64,
            duration_days: duration_days as i64,
            current_balance: current_balance as i64,
        };

        match self.db.save_bucky_bank_created_event(&new_event).await {
            Ok(saved_event) => {
                info!("Saved BuckyBankCreated event: {}", saved_event.id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save BuckyBankCreated event: {}", e);
                Err(e)
            }
        }
    }

    async fn process_deposit_made_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing DepositMade event: {:?}", event.id);

        let parsed_data = &event.parsed_json;

        tracing::info!("Parsed data: {:?}", parsed_data);

        let bucky_bank_id = parsed_data
            .get("bucky_bank_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing bucky_bank_id"))?;

        let amount = parsed_data
            .get("amount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid amount"))?;

        let depositor = parsed_data
            .get("depositor")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing depositor"))?;

        let created_at_ms = parsed_data
            .get("created_at_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid created_at_ms"))?;

        let new_event = NewDepositMadeEvent {
            bucky_bank_id: bucky_bank_id.to_string(),
            amount: amount as i64,
            depositor: depositor.to_string(),
            created_at_ms: created_at_ms as i64,
        };

        match self.db.save_deposit_made_event(&new_event).await {
            Ok(saved_event) => {
                info!("Saved DepositMade event: {}", saved_event.id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save DepositMade event: {}", e);
                Err(e)
            }
        }
    }

    async fn process_withdrawal_requested_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing EventWithdrawalRequested event: {:?}", event.id);

        let parsed_data = &event.parsed_json;

        tracing::info!("Parsed data: {:?}", parsed_data);

        let request_id = parsed_data
            .get("request_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing request_id"))?;

        let bucky_bank_id = parsed_data
            .get("bucky_bank_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing bucky_bank_id"))?;

        let amount = parsed_data
            .get("amount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid amount"))?;

        let requester = parsed_data
            .get("requester")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing requester"))?;

        let reason = parsed_data
            .get("reason")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing reason"))?;

        //  INFO  Parsed data: Object {"amount": String("3000000"), "approved_by": String("0x27b2306354b0537a9ac9eddb26e10f327d6ef660333902e313b1bcb4353c5d3f"), "bucky_bank_id": String("0xd7dd42e481af321a09533e727dd53c0ee58ef2257333e3471358254363c3c3de"), "created_at_ms": String("1760166241636"), "reason": String("I need it"), "request_id": String("0x8048af51a7c16e4a0bd8555c8147e5e2e7a0b6ca59499d8ede96aea24db44b8d"), "requester": String("0x27b2306354b0537a9ac9eddb26e10f327d6ef660333902e313b1bcb4353c5d3f"), "status": Object {"variant": String("Pending"), "fields": Object {}}}

        // 处理枚举类型的status字段
        let status = if let Some(status_obj) = parsed_data.get("status") {
            if let Some(variant) = status_obj.get("variant").and_then(|v| v.as_str()) {
                match variant {
                    "Pending" => WithdrawalStatus::Pending,
                    "Approved" => WithdrawalStatus::Approved,
                    "Rejected" => WithdrawalStatus::Rejected,
                    "Cancelled" => WithdrawalStatus::Cancelled,
                    "Withdrawed" => WithdrawalStatus::Withdrawed,
                    _ => return Err(anyhow::anyhow!("Unknown status variant: {}", variant)),
                }
            } else if let Some(status_str) = status_obj.as_str() {
                // 兼容简单字符串格式
                match status_str {
                    "Pending" => WithdrawalStatus::Pending,
                    "Approved" => WithdrawalStatus::Approved,
                    "Rejected" => WithdrawalStatus::Rejected,
                    "Cancelled" => WithdrawalStatus::Cancelled,
                    "Withdrawed" => WithdrawalStatus::Withdrawed,
                    _ => return Err(anyhow::anyhow!("Unknown status: {}", status_str)),
                }
            } else {
                return Err(anyhow::anyhow!("Invalid status format"));
            }
        } else {
            return Err(anyhow::anyhow!("Missing status"));
        };

        let approved_by = parsed_data
            .get("approved_by")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());

        let created_at_ms = parsed_data
            .get("created_at_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid created_at_ms"))?;

        let new_event = NewWithdrawalRequestEvent {
            request_id: request_id.to_string(),
            bucky_bank_id: bucky_bank_id.to_string(),
            amount: amount as i64,
            requester: requester.to_string(),
            reason: reason.to_string(),
            status: status.to_string(), // 转换为字符串
            approved_by: approved_by.unwrap_or_default(), // 使用unwrap_or_default处理Option
            created_at_ms: created_at_ms as i64,
            audit_at_ms: None, // 初始化为None，审批事件会更新这个字段
            tx_digest: event.id.tx_digest.to_string(),
            event_seq: event.id.event_seq as i64,
            timestamp_ms: event.timestamp_ms.unwrap_or(0) as i64,
        };

        match self.db.save_withdrawal_request_event(&new_event).await {
            Ok(saved_event) => {
                info!("Saved EventWithdrawalRequested event: {}", saved_event.id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save EventWithdrawalRequested event: {}", e);
                Err(e)
            }
        }
    }

    async fn process_withdrawal_approved_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing EventWithdrawalApproved event: {:?}", event.id);

        let parsed_data = &event.parsed_json;
        tracing::info!("Parsed data: {:?}", parsed_data);

        let request_id = parsed_data
            .get("request_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing request_id"))?;

        let approved_by = parsed_data
            .get("approved_by")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing approved_by"))?;

        let created_at_ms = parsed_data
            .get("created_at_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid created_at_ms"))?;

        // 更新提取请求状态为Approved
        match self.db.update_withdrawal_request_status(
            request_id,
            &WithdrawalStatus::Approved,
            Some(approved_by),
            Some(created_at_ms as i64),
        ).await {
            Ok(true) => {
                info!("Successfully approved withdrawal request: {}", request_id);
                Ok(())
            }
            Ok(false) => {
                error!("Withdrawal request not found: {}", request_id);
                Err(anyhow::anyhow!("Withdrawal request not found: {}", request_id))
            }
            Err(e) => {
                error!("Failed to approve withdrawal request: {}", e);
                Err(e)
            }
        }
    }

    async fn process_withdrawal_rejected_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing EventWithdrawalRejected event: {:?}", event.id);

        let parsed_data = &event.parsed_json;
        tracing::info!("Parsed data: {:?}", parsed_data);

        let request_id = parsed_data
            .get("request_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing request_id"))?;

        let rejected_by = parsed_data
            .get("rejected_by")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing rejected_by"))?;

        let created_at_ms = parsed_data
            .get("created_at_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid created_at_ms"))?;

        // 更新提取请求状态为Rejected
        match self.db.update_withdrawal_request_status(
            request_id,
            &WithdrawalStatus::Rejected,
            Some(rejected_by),
            Some(created_at_ms as i64),
        ).await {
            Ok(true) => {
                info!("Successfully rejected withdrawal request: {}", request_id);
                Ok(())
            }
            Ok(false) => {
                error!("Withdrawal request not found: {}", request_id);
                Err(anyhow::anyhow!("Withdrawal request not found: {}", request_id))
            }
            Err(e) => {
                error!("Failed to reject withdrawal request: {}", e);
                Err(e)
            }
        }
    }

    async fn process_event_withdrawed_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing EventWithdrawed event: {:?}", event.id);

        let parsed_data = &event.parsed_json;
        tracing::info!("Parsed data: {:?}", parsed_data);

        let request_id = parsed_data
            .get("request_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing request_id"))?;

        let bucky_bank_id = parsed_data
            .get("bucky_bank_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing bucky_bank_id"))?;

        let amount = parsed_data
            .get("amount")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid amount"))?;

        let left_balance = parsed_data
            .get("left_balance")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid left_balance"))?;

        let withdrawer = parsed_data
            .get("withdrawer")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing withdrawer"))?;

        let created_at_ms = parsed_data
            .get("created_at_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid created_at_ms"))?;

        let new_event = NewEventWithdrawedEvent {
            request_id: request_id.to_string(),
            bucky_bank_id: bucky_bank_id.to_string(),
            amount: amount as i64,
            left_balance: left_balance as i64,
            withdrawer: withdrawer.to_string(),
            created_at_ms: created_at_ms as i64,
        };

        match self.db.save_event_withdrawed_event(&new_event).await {
            Ok(saved_event) => {
                info!("Saved EventWithdrawed event: {}", saved_event.id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to save EventWithdrawed event: {}", e);
                Err(e)
            }
        }
    }
}
