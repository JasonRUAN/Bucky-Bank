-- 创建提取请求表
CREATE TABLE withdrawal_requests (
    id SERIAL PRIMARY KEY,
    request_id VARCHAR(66) NOT NULL UNIQUE, -- Sui ID
    bucky_bank_id VARCHAR(66) NOT NULL,     -- Sui ID
    amount BIGINT NOT NULL,
    requester VARCHAR(66) NOT NULL,         -- Sui address
    reason TEXT NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('Pending', 'Approved', 'Rejected', 'Cancelled', 'Withdrawed')),
    approved_by VARCHAR(66),                -- Sui address, nullable
    created_at_ms BIGINT NOT NULL,
    audit_at_ms BIGINT,                     -- 审批时间
    indexed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引
CREATE INDEX idx_withdrawal_request_id ON withdrawal_requests (request_id);
CREATE INDEX idx_withdrawal_bucky_bank_id ON withdrawal_requests (bucky_bank_id);
CREATE INDEX idx_withdrawal_requester ON withdrawal_requests (requester);
CREATE INDEX idx_withdrawal_status ON withdrawal_requests (status);
CREATE INDEX idx_withdrawal_created_at ON withdrawal_requests (created_at_ms);

-- 创建复合索引用于常见查询
CREATE INDEX idx_withdrawal_bank_status ON withdrawal_requests(bucky_bank_id, status);
CREATE INDEX idx_withdrawal_requester_status ON withdrawal_requests(requester, status);