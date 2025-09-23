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
    current_balance_value: number;
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
