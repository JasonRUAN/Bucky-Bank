-- 新增 EventWithdrawed 事件表

-- 继承之前的 UUID 扩展（如果已经存在则跳过）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- EventWithdrawed 事件表
CREATE TABLE IF NOT EXISTS withdrawed_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id VARCHAR(66) NOT NULL,
    bucky_bank_id VARCHAR(66) NOT NULL,
    amount BIGINT NOT NULL,
    left_balance BIGINT NOT NULL,
    withdrawer VARCHAR(66) NOT NULL,
    created_at_ms BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- 外键约束，确保request_id引用已存在的提取请求
    FOREIGN KEY (request_id) REFERENCES withdrawal_requests(request_id),
    -- 外键约束，确保bucky_bank_id引用已存在的BuckyBank
    FOREIGN KEY (bucky_bank_id) REFERENCES bucky_bank_created_events(bucky_bank_id)
);

-- 添加索引以提高查询性能
CREATE INDEX idx_event_withdrawed_request_id ON withdrawed_events (request_id);
CREATE INDEX idx_event_withdrawed_bucky_bank_id ON withdrawed_events (bucky_bank_id);
CREATE INDEX idx_event_withdrawed_withdrawer ON withdrawed_events (withdrawer);
CREATE INDEX idx_event_withdrawed_timestamp ON withdrawed_events (created_at_ms);
CREATE INDEX idx_event_withdrawed_created_at ON withdrawed_events (created_at);

-- 复合索引，用于常见查询场景
CREATE INDEX idx_event_withdrawed_bank_withdrawer ON withdrawed_events (bucky_bank_id, withdrawer);
CREATE INDEX idx_event_withdrawed_bank_timestamp ON withdrawed_events (bucky_bank_id, created_at_ms);

-- 添加注释
COMMENT ON TABLE withdrawed_events IS 'BuckyBank提取完成事件记录表';

COMMENT ON COLUMN withdrawed_events.request_id IS '关联的提取请求标识符';
COMMENT ON COLUMN withdrawed_events.bucky_bank_id IS '关联的BuckyBank标识符';
COMMENT ON COLUMN withdrawed_events.amount IS '提取金额';
COMMENT ON COLUMN withdrawed_events.left_balance IS '提取后剩余余额';
COMMENT ON COLUMN withdrawed_events.withdrawer IS '提取人地址';
COMMENT ON COLUMN withdrawed_events.created_at_ms IS '提取时间戳(毫秒)';
COMMENT ON COLUMN withdrawed_events.created_at IS '数据库记录创建时间';

-- 可选：添加一个视图来方便查询提取统计
CREATE OR REPLACE VIEW withdrawed_summary AS
SELECT
    w.bucky_bank_id,
    b.name as bucky_bank_name,
    COUNT(w.id) as total_withdrawals,
    SUM(w.amount) as total_withdrawn_amount,
    b.target_amount,
    b.current_balance
FROM
    withdrawed_events w
    JOIN bucky_bank_created_events b ON w.bucky_bank_id = b.bucky_bank_id
GROUP BY
    w.bucky_bank_id,
    b.name,
    b.target_amount,
    b.current_balance;

COMMENT ON VIEW withdrawed_summary IS 'BuckyBank提取统计视图';