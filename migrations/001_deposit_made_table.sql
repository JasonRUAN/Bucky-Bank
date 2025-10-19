-- 新增 DepositMade 事件表

-- 继承之前的 UUID 扩展（如果已经存在则跳过）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- DepositMade 事件表
CREATE TABLE IF NOT EXISTS deposit_made_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bucky_bank_id VARCHAR(255) NOT NULL,
    amount BIGINT NOT NULL,
    depositor VARCHAR(255) NOT NULL,
    created_at_ms BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

-- 外键约束，确保bucky_bank_id引用已存在的BuckyBank
FOREIGN KEY (bucky_bank_id) REFERENCES bucky_bank_created_events(bucky_bank_id)
);

-- 添加索引以提高查询性能
CREATE INDEX idx_deposit_made_bucky_bank_id ON deposit_made_events (bucky_bank_id);

CREATE INDEX idx_deposit_made_depositor ON deposit_made_events (depositor);

CREATE INDEX idx_deposit_made_timestamp ON deposit_made_events (created_at_ms);

CREATE INDEX idx_deposit_made_created_at ON deposit_made_events (created_at);

-- 复合索引，用于常见查询场景
CREATE INDEX idx_deposit_made_bank_depositor ON deposit_made_events (bucky_bank_id, depositor);

CREATE INDEX idx_deposit_made_bank_timestamp ON deposit_made_events (bucky_bank_id, created_at_ms);

-- 添加注释
COMMENT ON TABLE deposit_made_events IS 'BuckyBank存款事件记录表';

COMMENT ON COLUMN deposit_made_events.bucky_bank_id IS '关联的BuckyBank标识符';

COMMENT ON COLUMN deposit_made_events.amount IS '存款金额';

COMMENT ON COLUMN deposit_made_events.depositor IS '存款人地址';

COMMENT ON COLUMN deposit_made_events.created_at_ms IS '存款时间戳(毫秒)';

COMMENT ON COLUMN deposit_made_events.created_at IS '数据库记录创建时间';

-- 可选：添加一个视图来方便查询存款统计
CREATE OR REPLACE VIEW deposit_summary AS
SELECT
    d.bucky_bank_id,
    b.name as bucky_bank_name,
    COUNT(d.id) as total_deposits,
    SUM(d.amount) as total_deposited_amount,
    b.target_amount,
    b.current_balance
FROM
    deposit_made_events d
    JOIN bucky_bank_created_events b ON d.bucky_bank_id = b.bucky_bank_id
GROUP BY
    d.bucky_bank_id,
    b.name,
    b.target_amount,
    b.current_balance;

COMMENT ON VIEW deposit_summary IS 'BuckyBank存款统计视图';