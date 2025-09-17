use crate::database::{
    Database,
    models::{NewBuckyBankCreatedEvent, NewCursor},
};
use anyhow::Result;
use std::sync::Arc;
use sui_sdk::SuiClient;
use sui_sdk::rpc_types::{EventFilter, SuiEvent};
use sui_sdk::types::Identifier;
use sui_sdk::types::base_types::ObjectID;
use sui_sdk::types::event::EventID;
use tracing::{debug, error, info};

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

    pub async fn query_and_process_events(&self) -> Result<(usize, bool)> {
        info!("Querying BuckyBank events with cursor...");

        let event_type = format!(
            "{}::{}::BuckyBankCreated",
            self.package_id, self.module_name
        );

        // 获取最新的游标
        let cursor_data = self.get_latest_cursor(&event_type).await?;

        let package_id: ObjectID = self.package_id.parse()?;
        let module = Identifier::new(&*self.module_name)?;

        // 使用游标查询事件，如果没有游标则从头开始
        let result = if let Some((tx_digest, event_seq)) = cursor_data {
            info!(
                "Using cursor: tx_digest={}, event_seq={}",
                tx_digest, event_seq
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
                        module,
                    },
                    Some(event_id),
                    None,
                    false, // 按升序排列
                )
                .await?
        } else {
            info!("No cursor found, starting from beginning");
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

        info!("Found {} events", result.data.len());
        info!("Has next page: {}", result.has_next_page);

        let mut processed_count = 0;
        let mut latest_tx_digest = None;
        let mut latest_event_seq = None;

        for event in result.data {
            debug!("Processing event: {:?}", event.id);

            // 检查是否是BuckyBankCreated事件
            if self.is_bucky_bank_created_event(&event) {
                match self.process_bucky_bank_created_event(&event).await {
                    Ok(_) => {
                        processed_count += 1;
                        latest_tx_digest = Some(event.id.tx_digest.to_string());
                        latest_event_seq = Some(event.id.event_seq.to_string());
                        info!(
                            "Successfully processed BuckyBankCreated event: {:?}",
                            event.id
                        );
                    }
                    Err(e) => {
                        error!(
                            "Failed to process BuckyBankCreated event {:?}: {}",
                            event.id, e
                        );
                    }
                }
            }
        }

        // 更新游标
        if let (Some(tx_digest), Some(event_seq)) = (latest_tx_digest, latest_event_seq) {
            if processed_count > 0 {
                self.update_cursor(&event_type, &tx_digest, &event_seq)
                    .await?;
                info!(
                    "Updated cursor to tx_digest={}, event_seq={} after processing {} events",
                    tx_digest, event_seq, processed_count
                );
            }
        }

        info!("Processed {} BuckyBankCreated events", processed_count);
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
                        Ok((processed_count, has_next_page)) => {
                            if has_next_page {
                                // 如果有下一页，立即继续处理
                                info!("Has more pages, continuing immediately...");
                                continue;
                            } else if processed_count > 0 {
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

    fn is_bucky_bank_created_event(&self, event: &SuiEvent) -> bool {
        // 检查事件类型
        let type_name = &event.type_.name;
        type_name.as_str() == "BuckyBankCreated"
    }

    async fn process_bucky_bank_created_event(&self, event: &SuiEvent) -> Result<()> {
        debug!("Processing BuckyBankCreated event: {:?}", event.id);

        let parsed_data = &event.parsed_json;

        tracing::info!("Parsed data: {:?}", parsed_data);

        let bucky_bank_id = parsed_data
            .get("bucky_bank_id")
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("Missing bucky_bank_id"))?;

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

        let deadline_ms = parsed_data
            .get("deadline_ms")
            .and_then(|v| v.as_str())
            .and_then(|s| s.parse::<u64>().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing or invalid deadline_ms"))?;

        let new_event = NewBuckyBankCreatedEvent {
            bucky_bank_id: bucky_bank_id.to_string(),
            parent_address: parent_address.to_string(),
            child_address: child_address.to_string(),
            target_amount: target_amount as i64,
            deadline_ms: deadline_ms as i64,
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
}
