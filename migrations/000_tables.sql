-- BuckyBankCreated Event Database Schema

-- Ensure the UUID extension is available for UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- BuckyBankCreated 事件表
CREATE TABLE IF NOT EXISTS bucky_bank_created_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4 (),
    bucky_bank_id VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    parent_address VARCHAR(255) NOT NULL,
    child_address VARCHAR(255) NOT NULL,
    target_amount BIGINT NOT NULL,
    created_at_ms BIGINT NOT NULL,
    deadline_ms BIGINT NOT NULL,
    duration_days BIGINT NOT NULL,
    current_balance BIGINT NOT NULL,
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 游标表，用于记录事件索引器的处理进度
CREATE TABLE IF NOT EXISTS cursors (
    id VARCHAR(255) PRIMARY KEY, -- 事件类型或跟踪器ID
    event_seq VARCHAR(255) NOT NULL CHECK (
        event_seq IS NOT NULL
        AND event_seq <> ''
    ), -- 事件序列号
    tx_digest VARCHAR(255) NOT NULL CHECK (
        tx_digest IS NOT NULL
        AND tx_digest <> ''
    ), -- 交易摘要
    created_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP
    WITH
        TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 添加索引以提高查询性能
CREATE INDEX idx_bucky_bank_id ON bucky_bank_created_events (bucky_bank_id);

CREATE INDEX idx_created_at ON bucky_bank_created_events (created_at);

CREATE INDEX idx_cursor_created_at ON cursors (created_at);

CREATE INDEX idx_cursor_updated_at ON cursors (updated_at);

CREATE INDEX idx_cursor_id ON cursors (id);

CREATE INDEX idx_cursor_event_seq ON cursors (event_seq);

-- 添加注释
COMMENT ON TABLE bucky_bank_created_events IS 'BuckyBank创建事件记录表';

COMMENT ON COLUMN bucky_bank_created_events.bucky_bank_id IS 'BuckyBank唯一标识符';

COMMENT ON COLUMN bucky_bank_created_events.name IS '存钱罐名称';

COMMENT ON COLUMN bucky_bank_created_events.parent_address IS '父账户地址';

COMMENT ON COLUMN bucky_bank_created_events.child_address IS '子账户地址';

COMMENT ON COLUMN bucky_bank_created_events.target_amount IS '目标金额';

COMMENT ON COLUMN bucky_bank_created_events.deadline_ms IS '截止时间戳(毫秒)';

COMMENT ON TABLE cursors IS '事件索引器游标进度表';

COMMENT ON COLUMN cursors.id IS '事件类型标识符，格式: package::module::event_name';

COMMENT ON COLUMN cursors.event_seq IS '事件序列号';

COMMENT ON COLUMN cursors.tx_digest IS '交易摘要哈希';

COMMENT ON COLUMN cursors.created_at IS '记录创建时间';

COMMENT ON COLUMN cursors.updated_at IS '记录更新时间';