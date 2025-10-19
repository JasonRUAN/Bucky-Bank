export interface BuckyBankInfo {
    name: string;
    target_amount: number;
    duration_days: number;
    child_address: string;
}

// API 相关类型定义
export interface BuckyBankCreatedEvent {
    id: string;
    bucky_bank_id: string;
    name: string;
    parent_address: string;
    child_address: string;
    target_amount: number;
    created_at_ms: number;
    deadline_ms: number;
    duration_days: number;
    current_balance: number;
    created_at: string;
}

export interface BuckyBankResponse {
    success: boolean;
    data: BuckyBankCreatedEvent[];
    total: number;
}

export interface BuckyBankSingleResponse {
    success: boolean;
    data: BuckyBankCreatedEvent | null;
    error?: string;
}

export interface BuckyBankQueryParams {
    page?: number;
    limit?: number;
    parent_address?: string;
    child_address?: string;
}

// 用户储蓄相关类型定义
export interface UserSavingsRewards {
    [coinType: string]: bigint;
}

export interface UserSavingsData {
    lpType: string;
    usdbBalance: bigint;
    lpBalance: bigint;
    rewards: UserSavingsRewards;
}

export interface UserSavings {
    [lpType: string]: UserSavingsData;
}

// 存款相关类型定义
export interface DepositMadeEvent {
    id: string;
    bucky_bank_id: string;
    amount: number;
    depositor: string;
    created_at_ms: number;
    created_at: string;
}

export interface DepositResponse {
    success: boolean;
    data: DepositMadeEvent[];
    total: number;
}

export interface DepositQueryParams {
    page?: number;
    limit?: number;
}

// 取款请求相关类型定义
export interface WithdrawalRequest {
    id: number;
    request_id: string;
    bucky_bank_id: string;
    amount: number;
    requester: string;
    reason: string;
    status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled' | 'Withdrawed';
    approved_by?: string;
    created_at_ms: number;
    audit_at_ms?: number;
    indexed_at: string;
}

export interface WithdrawalRequestResponse {
    success: boolean;
    data: WithdrawalRequest[];
    total: number;
}

export interface WithdrawalRequestQueryParams {
    page?: number;
    limit?: number;
    status?: string;
    requester?: string;
}

// 取款相关类型定义
export interface EventWithdrawed {
    id: string;
    request_id: string;
    bucky_bank_id: string;
    amount: number;
    left_balance: number;
    withdrawer: string;
    created_at_ms: number;
    created_at: string;
}

export interface WithdrawResponse {
    success: boolean;
    data: EventWithdrawed[];
    total: number;
}

export interface WithdrawQueryParams {
    page?: number;
    limit?: number;
}
