/// Module: bucky_bank
/// 一个家长管理的儿童存钱罐智能合约
module bucky_bank::bucky_bank;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;

/// 存钱罐状态
public enum Status has copy, drop, store {
    Active, // 活跃状态
    Frozen, // 冻结状态
    Completed, // 已完成
    Closed, // 已关闭
}

/// 提取请求状态
public enum WithdrawalStatus has copy, drop, store {
    Pending, // 等待审批
    Approved, // 已批准
    Rejected, // 已拒绝
    Cancelled, // 已取消
}

/// 存钱罐配置
public struct Config has drop, store {
    name: String,
    target_amount: u64,
    deadline_ms: u64,
    child_address: address,
    is_withdrawable_before_deadline: bool,
}

/// 存钱罐对象
public struct BuckyBank has key {
    id: UID,
    parent: address,
    config: Config,
    current_balance: Balance<SUI>,
    status: Status,
    deposit_count: u64,
    created_at_ms: u64,
    last_deposit_ms: u64,
}

/// 提取请求
public struct WithdrawalRequest has key {
    id: UID,
    bucky_bank_id: ID,
    requester: address,
    amount: u64,
    status: WithdrawalStatus,
    created_at_ms: u64,
    reason: String,
}

/// 全局统计
public struct GlobalStats has key {
    id: UID,
    total_bucky_banks: u64, // 存钱罐数量
    total_deposits: u64, // 存款数量
    total_withdrawals: u64, // 取款数量
    platform_fees_collected: Balance<SUI>, // 平台已收取管理费余额
    admin: address, // 平台管理员
}

/// 事件定义
public struct BuckyBankCreated has copy, drop {
    bucky_bank_id: ID,
    name: String,
    parent: address,
    child: address,
    target_amount: u64,
    created_at_ms: u64,
    deadline_ms: u64,
    duration_days: u64,
    current_balance_value: u64,
}

public struct DepositMade has copy, drop {
    bucky_bank_id: ID,
    amount: u64,
    depositor: address,
    timestamp_ms: u64,
}

public struct WithdrawalRequested has copy, drop {
    request_id: ID,
    bucky_bank_id: ID,
    amount: u64,
    requester: address,
}

public struct WithdrawalApproved has copy, drop {
    request_id: ID,
    bucky_bank_id: ID,
    amount: u64,
    approved_by: address,
}

public struct WithdrawalRejected has copy, drop {
    request_id: ID,
    bucky_bank_id: ID,
    amount: u64,
    rejected_by: address,
}

public struct BuckyBankClosed has copy, drop {
    bucky_bank_id: ID,
    closed_by: address,
    remaining_balance: u64,
    platform_fee: u64,
}

public struct PlatformFeesWithdrawn has copy, drop {
    amount: u64,
    withdrawn_by: address,
    timestamp_ms: u64,
}

/// 常量定义
const PARENT_DEPOSIT: u64 = 1000000000; // 1 SUI (1 SUI = 10^9 MIST)
const PLATFORM_FEE: u64 = 100000000; // 0.1 SUI
const MAX_NAME_LENGTH: u64 = 100;
const MAX_REASON_LENGTH: u64 = 200;

/// 错误代码
const EINVALID_NAME: u64 = 1;
const EINVALID_AMOUNT: u64 = 2;
const EINVALID_DEADLINE: u64 = 3;
const EINSUFFICIENT_DEPOSIT: u64 = 4;
const ENOT_PARENT: u64 = 5;
const ENOT_CHILD: u64 = 6;
const EBANK_NOT_ACTIVE: u64 = 7;
const EWITHDRAWAL_NOT_ALLOWED: u64 = 8;
const EINSUFFICIENT_BALANCE: u64 = 9;
const EREQUEST_NOT_FOUND: u64 = 10;
const EINVALID_REQUEST_STATUS: u64 = 11;
const ETARGET_NOT_REACHED: u64 = 12;
const EDEADLINE_NOT_REACHED: u64 = 13;
const EALREADY_COMPLETED: u64 = 14;
const ENOT_ZERO: u64 = 15;
const ENOT_ADMIN: u64 = 16;

/// 初始化全局统计
fun init(ctx: &mut TxContext) {
    let stats = GlobalStats {
        id: object::new(ctx),
        total_bucky_banks: 0,
        total_deposits: 0,
        total_withdrawals: 0,
        platform_fees_collected: balance::zero<SUI>(),
        admin: ctx.sender(),
    };
    transfer::share_object(stats);
}

/// 创建存钱罐
public fun create_bucky_bank(
    name: vector<u8>,
    target_amount: u64,
    duration_days: u64,
    child_address: address,
    is_withdrawable_before_deadline: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // 验证输入
    assert!(vector::length(&name) <= MAX_NAME_LENGTH, EINVALID_NAME);
    assert!(target_amount > 0, EINVALID_AMOUNT);
    assert!(duration_days > 0, EINVALID_DEADLINE);

    let current_time_ms = clock::timestamp_ms(clock);
    let deadline_ms = current_time_ms + (duration_days * 24 * 60 * 60 * 1000);

    let name_str = string::utf8(name);

    let config = Config {
        name: name_str,
        target_amount,
        deadline_ms,
        child_address,
        is_withdrawable_before_deadline,
    };

    let sender = ctx.sender();

    let bucky_bank = BuckyBank {
        id: object::new(ctx),
        parent: sender,
        config,
        current_balance: balance::zero<SUI>(),
        status: Status::Active,
        deposit_count: 0,
        created_at_ms: current_time_ms,
        last_deposit_ms: current_time_ms,
    };

    // 发送事件
    event::emit(BuckyBankCreated {
        bucky_bank_id: object::id(&bucky_bank),
        name: name_str,
        parent: sender,
        child: child_address,
        target_amount,
        created_at_ms: current_time_ms,
        deadline_ms,
        duration_days,
        current_balance_value: balance::value(&bucky_bank.current_balance),
    });

    // 将存钱罐设置为共享对象，家长和孩子都能进行操作
    transfer::share_object(bucky_bank);
}

/// 存款功能 - 只有孩子可以存款
public fun deposit(
    bucky_bank: &mut BuckyBank,
    deposit_coin: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let current_time_ms = clock::timestamp_ms(clock);

    // 验证权限和状态
    assert!(bucky_bank.status == Status::Active, EBANK_NOT_ACTIVE);
    assert!(sender == bucky_bank.config.child_address, ENOT_CHILD);
    assert!(coin::value(&deposit_coin) > 0, EINVALID_AMOUNT);

    let amount = coin::value(&deposit_coin);

    // 存款到余额
    let deposit_balance = coin::into_balance(deposit_coin);
    balance::join(&mut bucky_bank.current_balance, deposit_balance);

    // 更新统计
    bucky_bank.deposit_count = bucky_bank.deposit_count + 1;
    bucky_bank.last_deposit_ms = current_time_ms;

    // 检查是否达到目标
    if (balance::value(&bucky_bank.current_balance) >= bucky_bank.config.target_amount) {
        bucky_bank.status = Status::Completed;
    };

    // 发送事件
    event::emit(DepositMade {
        bucky_bank_id: object::id(bucky_bank),
        amount,
        depositor: sender,
        timestamp_ms: current_time_ms,
    });
}

/// 查询存钱罐详情
public fun get_bucky_bank_info(
    bucky_bank: &BuckyBank,
): (String, u64, u64, address, Status, u64, u64, u64, u64, bool) {
    (
        bucky_bank.config.name,
        bucky_bank.config.target_amount,
        balance::value(&bucky_bank.current_balance),
        bucky_bank.config.child_address,
        bucky_bank.status,
        bucky_bank.deposit_count,
        bucky_bank.created_at_ms,
        bucky_bank.last_deposit_ms,
        bucky_bank.config.deadline_ms,
        bucky_bank.config.is_withdrawable_before_deadline,
    )
}

/// 检查是否可以提取（达到目标且超过期限）
public fun can_withdraw(bucky_bank: &BuckyBank, clock: &Clock): bool {
    let current_time_ms = clock::timestamp_ms(clock);
    let target_reached =
        balance::value(&bucky_bank.current_balance) >= bucky_bank.config.target_amount;
    let deadline_reached = current_time_ms >= bucky_bank.config.deadline_ms;

    target_reached && deadline_reached
}

/// 直接提取（达到目标且超过期限）
public fun withdraw_completed(
    bucky_bank: &mut BuckyBank,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();

    // 验证权限和条件
    assert!(sender == bucky_bank.config.child_address, ENOT_CHILD);
    assert!(bucky_bank.status == Status::Completed, EALREADY_COMPLETED);
    assert!(can_withdraw(bucky_bank, clock), EWITHDRAWAL_NOT_ALLOWED);
    assert!(
        amount > 0 && amount <= balance::value(&bucky_bank.current_balance),
        EINSUFFICIENT_BALANCE,
    );

    // 提取资金
    let withdraw_balance = balance::split(&mut bucky_bank.current_balance, amount);
    let withdraw_coin = coin::from_balance(withdraw_balance, ctx);

    // 转移给孩子
    transfer::public_transfer(withdraw_coin, sender);

    // 如果余额为0，标记为关闭
    if (balance::value(&bucky_bank.current_balance) == 0) {
        bucky_bank.status = Status::Closed;
    }
}

/// 创建提取请求（未达到条件时）
public fun request_withdrawal(
    bucky_bank: &BuckyBank,
    amount: u64,
    reason: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);
    let current_time_ms = clock::timestamp_ms(clock);

    // 验证权限和状态
    assert!(sender == bucky_bank.config.child_address, ENOT_CHILD);
    assert!(bucky_bank.status == Status::Active, EBANK_NOT_ACTIVE);
    assert!(
        amount > 0 && amount <= balance::value(&bucky_bank.current_balance),
        EINSUFFICIENT_BALANCE,
    );
    assert!(vector::length(&reason) <= MAX_REASON_LENGTH, EINVALID_NAME);

    let reason_str = string::utf8(reason);

    let request = WithdrawalRequest {
        id: object::new(ctx),
        bucky_bank_id: object::id(bucky_bank),
        requester: sender,
        amount,
        status: WithdrawalStatus::Pending,
        created_at_ms: current_time_ms,
        reason: reason_str,
    };

    // 发送事件
    event::emit(WithdrawalRequested {
        request_id: object::id(&request),
        bucky_bank_id: object::id(bucky_bank),
        amount,
        requester: sender,
    });

    // 转移请求给家长审批
    transfer::transfer(request, bucky_bank.parent);
}

/// 家长审批提取请求
public fun approve_withdrawal(
    request: WithdrawalRequest,
    bucky_bank: &mut BuckyBank,
    approve: bool,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();

    // 验证权限和状态
    assert!(sender == bucky_bank.parent, ENOT_PARENT);
    assert!(request.status == WithdrawalStatus::Pending, EINVALID_REQUEST_STATUS);
    assert!(request.bucky_bank_id == object::id(bucky_bank), EREQUEST_NOT_FOUND);

    let request_id = object::id(&request);
    let amount = request.amount;
    let requester = request.requester;

    // 授权了，提取指定资金，未授权则直接删除请求对象
    if (approve) {
        // 检查余额是否足够提取
        assert!(amount <= balance::value(&bucky_bank.current_balance), EINSUFFICIENT_BALANCE);

        // 批准提取
        let withdraw_balance = balance::split(&mut bucky_bank.current_balance, amount);
        let withdraw_coin = coin::from_balance(withdraw_balance, ctx);

        // 转移资金给孩子
        transfer::public_transfer(withdraw_coin, requester);

        // 发送事件
        event::emit(WithdrawalApproved {
            request_id,
            bucky_bank_id: object::id(bucky_bank),
            amount,
            approved_by: sender,
        });
    } else {
        event::emit(WithdrawalRejected {
            request_id,
            bucky_bank_id: object::id(bucky_bank),
            amount,
            rejected_by: sender,
        });
    };

    let WithdrawalRequest {
        id,
        bucky_bank_id: _,
        requester: _,
        amount: _,
        status: _,
        created_at_ms: _,
        reason: _,
    } = request;

    object::delete(id);
}

/// 家长关闭存钱罐
public fun close_bucky_bank(stats: &mut GlobalStats, bucky_bank: BuckyBank, ctx: &mut TxContext) {
    let sender = ctx.sender();
    let current_balance = balance::value(&bucky_bank.current_balance);

    let bucky_bank_id = object::id(&bucky_bank);

    // 验证权限
    assert!(sender == bucky_bank.parent, ENOT_PARENT);

    // 计算费用
    let platform_fee = if (current_balance > PLATFORM_FEE) PLATFORM_FEE else current_balance;
    let parent_amount = current_balance - platform_fee;

    let mut bucky_bank_mut = bucky_bank;

    // 收取平台费用
    if (platform_fee > 0) {
        let fee_balance = balance::split(&mut bucky_bank_mut.current_balance, platform_fee);
        balance::join(&mut stats.platform_fees_collected, fee_balance);
    };

    if (parent_amount > 0) {
        let parent_balance = balance::split(&mut bucky_bank_mut.current_balance, parent_amount);
        let parent_coin = coin::from_balance(parent_balance, ctx);
        transfer::public_transfer(parent_coin, sender);
    };
    event::emit(BuckyBankClosed {
        bucky_bank_id,
        closed_by: sender,
        remaining_balance: current_balance,
        platform_fee,
    });

    // 删除存钱罐对象
    let BuckyBank {
        id,
        parent: _,
        config: _,
        current_balance: remaining_balance,
        status: _,
        deposit_count: _,
        created_at_ms: _,
        last_deposit_ms: _,
    } = bucky_bank_mut;

    // 增加判断remaining_balance为0，避免勿删
    assert!(balance::value(&remaining_balance) == 0, ENOT_ZERO);

    // 销毁剩余余额
    balance::destroy_zero(remaining_balance);
    object::delete(id);
}

/// 更新存钱罐目标（达到目标后可以设置新目标）
public fun update_target(
    bucky_bank: &mut BuckyBank,
    new_target_amount: u64,
    new_duration_days: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = tx_context::sender(ctx);

    // 验证权限和状态
    assert!(sender == bucky_bank.config.child_address, ENOT_CHILD);
    assert!(bucky_bank.status == Status::Completed, ETARGET_NOT_REACHED);
    assert!(new_target_amount > 0, EINVALID_AMOUNT);
    assert!(new_duration_days > 0, EINVALID_DEADLINE);

    let current_time_ms = clock::timestamp_ms(clock);
    let new_deadline_ms = current_time_ms + (new_duration_days * 24 * 60 * 60 * 1000);

    // 更新配置
    bucky_bank.config.target_amount = new_target_amount;
    bucky_bank.config.deadline_ms = new_deadline_ms;
    bucky_bank.status = Status::Active;
}

/// 管理员提取平台手续费
public fun withdraw_platform_fees(
    stats: &mut GlobalStats,
    amount: u64,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let current_time_ms = clock::timestamp_ms(clock);

    // 验证权限
    assert!(sender == stats.admin, ENOT_ADMIN);

    // 验证金额
    assert!(amount > 0, EINVALID_AMOUNT);
    assert!(amount <= balance::value(&stats.platform_fees_collected), EINSUFFICIENT_BALANCE);

    // 提取手续费
    let withdraw_balance = balance::split(&mut stats.platform_fees_collected, amount);
    let withdraw_coin = coin::from_balance(withdraw_balance, ctx);

    // 转移给管理员
    transfer::public_transfer(withdraw_coin, sender);

    // 发送事件
    event::emit(PlatformFeesWithdrawn {
        amount,
        withdrawn_by: sender,
        timestamp_ms: current_time_ms,
    });
}

/// 获取存钱罐余额
public fun get_balance(bucky_bank: &BuckyBank): u64 {
    balance::value(&bucky_bank.current_balance)
}

/// 获取存钱罐状态
public fun get_status(bucky_bank: &BuckyBank): Status {
    bucky_bank.status
}

/// 检查是否为家长
public fun is_parent(bucky_bank: &BuckyBank, addr: address): bool {
    bucky_bank.parent == addr
}

/// 检查是否为孩子
public fun is_child(bucky_bank: &BuckyBank, addr: address): bool {
    bucky_bank.config.child_address == addr
}

/// 测试函数 - 返回常量值
public fun get_parent_deposit_value(): u64 {
    PARENT_DEPOSIT
}

/// 测试函数 - 返回平台费用
public fun get_platform_fee_value(): u64 {
    PLATFORM_FEE
}

/// 获取平台手续费余额
public fun get_platform_fees_balance(stats: &GlobalStats): u64 {
    balance::value(&stats.platform_fees_collected)
}

/// 检查是否为管理员
public fun is_admin(stats: &GlobalStats, addr: address): bool {
    stats.admin == addr
}

/// 测试函数
public fun get_balance_test(): u64 {
    0
}
