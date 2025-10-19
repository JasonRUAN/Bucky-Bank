export type DynamicFields = {
    type: string;
    fields: {
        id: {
            id: string;
        };
        size: string;
    };
};

// 定义存款数据结构类型
interface DepositBalanceEntry {
    type: string;
    fields: {
        key: string;
        value: string;
    };
}

interface DepositBalanceUserEntry {
    type: string;
    fields: {
        key: string;
        value: {
            type: string;
            fields: {
                contents: DepositBalanceEntry[];
            };
        };
    };
}

interface GlobalStatsDepositBalances {
    type: string;
    fields: {
        contents: DepositBalanceUserEntry[];
    };
}

// RewardBalances
interface RewardBalanceEntry {
    type: string;
    fields: {
        key: string;
        value: string;
    };
}

interface RewardBalanceUserEntry {
    type: string;
    fields: {
        key: string;
        value: {
            type: string;
            fields: {
                contents: RewardBalanceEntry[];
            };
        };
    };
}

interface GlobalStatsRewardBalances {
    type: string;
    fields: {
        contents: RewardBalanceUserEntry[];
    };
}

export type GlobalStatsData = {
    admin: string;
    deposit_balances?: GlobalStatsDepositBalances;
    id: {
        id: string;
    };
    platform_fees_collected: string;
    reward_balances?: GlobalStatsRewardBalances;
    total_bucky_banks: string;
    total_deposits: string;
    total_withdrawals: string;
};

// 提取请求数据结构
export type WithdrawalRequest = {
    amount: string;
    approved_by: string;
    bucky_bank_id: string;
    created_at_ms: string;
    id: {
        id: string;
    };
    reason: string;
    requester: string;
};
