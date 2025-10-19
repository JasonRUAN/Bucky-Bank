/// Module: bucky_bank
/// 一个家长管理的儿童存钱罐智能合约
module bucky_bank::bucky_bank;

use std::string::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::sui::SUI;
use sui::vec_map::{Self, VecMap};

// ==============================================================
// 常量
// ==============================================================
const MAX_NAME_LENGTH: u64 = 100;
const MAX_REASON_LENGTH: u64 = 200;

// ==============================================================
// 错误码
// ==============================================================

const EINVALID_NAME: u64 = 1;
fun err_invalid_name() { abort EINVALID_NAME }

const EINVALID_AMOUNT: u64 = 2;
fun err_invalid_amount() { abort EINVALID_AMOUNT }

const EINVALID_DEADLINE: u64 = 3;
fun err_invalid_deadline() { abort EINVALID_DEADLINE }

const ENOT_PARENT: u64 = 4;
fun err_not_parent() { abort ENOT_PARENT }

const ENOT_CHILD: u64 = 5;
fun err_not_child() { abort ENOT_CHILD }

const EBANK_NOT_ACTIVE: u64 = 6;
fun err_bank_not_active() { abort EBANK_NOT_ACTIVE }

const EINSUFFICIENT_BALANCE: u64 = 7;
fun err_insufficient_balance() { abort EINSUFFICIENT_BALANCE }

const EREQUEST_NOT_FOUND: u64 = 8;
fun err_request_not_found() { abort EREQUEST_NOT_FOUND }

const EINVALID_REQUEST_STATUS: u64 = 9;
fun err_invalid_request_status() { abort EINVALID_REQUEST_STATUS }

const EINVALID_TOTAL_BALANCE: u64 = 10;
fun err_invalid_total_balance() { abort EINVALID_TOTAL_BALANCE }

const EINVALID_REWARD_BALANCE_SHOULD_BE_ZERO: u64 = 11;
fun err_invalid_reward_balance_should_be_zero() { abort EINVALID_REWARD_BALANCE_SHOULD_BE_ZERO }

const ENO_DEPOSIT: u64 = 12;
fun err_no_deposit() { abort ENO_DEPOSIT }

const ENO_REWARD_NO_USER: u64 = 13;
fun err_no_reward_no_user() { abort ENO_REWARD_NO_USER }

const ENO_REWARD_NO_BUCKY_BANK_ID: u64 = 14;
fun err_no_reward_no_bucky_bank_id() { abort ENO_REWARD_NO_BUCKY_BANK_ID }

const EREWARD_TO_LOW: u64 = 15;
fun err_reward_too_low() { abort EREWARD_TO_LOW }

const EBANK_NOT_MATCH: u64 = 16;
fun err_bank_not_match() { abort EBANK_NOT_MATCH }

// ==============================================================
// 枚举值
// ==============================================================
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
    Withdrawed, // 已提取
}

// ==============================================================
// 结构体定义
// ==============================================================
/// 全局统计
public struct GlobalStats has key {
    id: UID,
    total_bucky_banks: u64, // 存钱罐数量
    total_deposits: u64, // 存款数量
    total_withdrawals: u64, // 取款数量
    // platform_fees_collected: Balance<SUI>, // 平台已收取管理费余额
    admin: address, // 平台管理员
    reward_balances: VecMap<address, VecMap<ID, Balance<SUI>>>, // user address -> bucky bank id -> reward SUI balance
    deposit_balances: VecMap<address, VecMap<ID, u64>>, // user address -> bucky bank id -> total deposit USDC balance
}

/// 存钱罐配置
public struct Config has drop, store {
    name: String, // 存钱罐名称
    target_amount: u64, // 目标存款金额
    deadline_ms: u64, // 存款截止时间戳（毫秒）
    child_address: address, // 存钱罐使用方地址
}

/// 存钱罐对象
public struct BuckyBank has key {
    id: UID,
    parent: address, // 存钱罐创建方地址
    config: Config, // 存钱罐配置
    current_balance: u64, // 当前存款余额
    status: Status, // 存钱罐状态
    deposit_count: u64, // 存款次数
    created_at_ms: u64, // 存钱罐创建时间
    last_deposit_ms: u64, // 最近一次存款时间
}

/// 提取请求对象
public struct WithdrawalRequest has key {
    id: UID,
    bucky_bank_id: ID, // 存钱罐ID
    requester: address, // 存款提取请求方地址
    amount: u64, // 存款提取金额
    reason: String, // 存款提取原因
    status: WithdrawalStatus, // 存款提取请求对象状态
    approved_by: address, // 存款提取请求审批对象地址
    created_at_ms: u64, // 存款提取请求创建时间
}

// ==============================================================
// 事件
// ==============================================================
/// 存钱罐创建事件
/// 当新的存钱罐被创建时触发此事件
public struct BuckyBankCreated has copy, drop {
    bucky_bank_id: ID, // 存钱罐ID
    name: String, // 存钱罐名称
    parent: address, // 家长地址（存钱罐创建方）
    child: address, // 孩子地址（存钱罐使用方）
    target_amount: u64, // 目标存款金额（USDC）
    current_balance: u64, // 当前余额（USDC）
    created_at_ms: u64, // 创建时间戳（毫秒）
    deadline_ms: u64, // 截止时间戳（毫秒）
    duration_days: u64, // 存款期限（天数）
}

/// 存款事件
/// 当用户向存钱罐存款时触发此事件
public struct DepositMade has copy, drop {
    bucky_bank_id: ID, // 存钱罐ID
    amount: u64, // 存款金额（USDC）
    depositor: address, // 存款人地址
    created_at_ms: u64, // 存款时间戳（毫秒）
}

/// 存款奖励事件
/// 当计算并分配奖励时触发此事件
public struct EventBankReward has copy, drop {
    bank_id: ID, // 存钱罐ID
    banks_count: u64, // 当前系统中存钱罐总数
    reward_receiver: address, // 奖励接收者地址
    total_reward: u64, // 用户总奖励数量（SUI）
    bank_reward: u64, // 该存钱罐分配奖励数量（SUI）
    total_balance: u64, // 用户总存款余额（USDC）
    bank_balance: u64, // 该存钱罐存款余额（USDC）
}

/// 奖励领取事件
/// 当用户领取奖励时触发此事件
public struct EventClaimReward has copy, drop {
    bank_id: ID, // 存钱罐的唯一标识符
    reward_receiver: address, // 奖励接收者地址
    reward_amount: u64, // 领取的奖励金额（SUI）
    created_at_ms: u64, // 领取时间戳（毫秒）
}

/// 提款请求事件
/// 当用户提交提款请求时触发此事件
public struct EventWithdrawalRequested has copy, drop {
    request_id: ID, // 提款请求的唯一标识符
    bucky_bank_id: ID, // 存钱罐的唯一标识符
    amount: u64, // 请求提款金额（USDC）
    requester: address, // 提款请求者地址
    reason: String, // 提款原因
    status: WithdrawalStatus, // 提款状态
    approved_by: address, // 审批者地址
    created_at_ms: u64, // 请求创建时间戳（毫秒）
}

/// 提款批准事件
/// 当提款请求被批准时触发此事件
public struct EventWithdrawalApproved has copy, drop {
    request_id: ID, // 提款请求的唯一标识符
    bucky_bank_id: ID, // 存钱罐的唯一标识符
    amount: u64, // 批准提款金额（USDC）
    requester: address, // 提款请求者地址
    approved_by: address, // 批准者地址
    reason: String, // 提款原因
    created_at_ms: u64, // 批准时间戳（毫秒）
}

/// 提款拒绝事件
/// 当提款请求被拒绝时触发此事件
public struct EventWithdrawalRejected has copy, drop {
    request_id: ID, // 提款请求的唯一标识符
    bucky_bank_id: ID, // 存钱罐的唯一标识符
    amount: u64, // 拒绝提款金额（USDC）
    requester: address, // 提款请求者地址
    rejected_by: address, // 拒绝者地址
    reason: String, // 提款原因
    created_at_ms: u64, // 拒绝时间戳（毫秒）
}

/// 提款完成事件
/// 当提款操作成功完成时触发此事件
public struct EventWithdrawed has copy, drop {
    request_id: ID, // 提款请求的唯一标识符
    bucky_bank_id: ID, // 存钱罐的唯一标识符
    amount: u64, // 实际提款金额（USDC）
    left_balance: u64, // 提款后剩余余额（USDC）
    withdrawer: address, // 提款者地址
    created_at_ms: u64, // 提款完成时间戳（毫秒）
}

// ==============================================================
// 合约接口
// ==============================================================
/// 初始化全局统计
fun init(ctx: &mut TxContext) {
    let stats = GlobalStats {
        id: object::new(ctx),
        total_bucky_banks: 0,
        total_deposits: 0,
        total_withdrawals: 0,
        // platform_fees_collected: balance::zero<SUI>(),
        admin: ctx.sender(),
        reward_balances: vec_map::empty(),
        deposit_balances: vec_map::empty(),
    };
    transfer::share_object(stats);
}

/// 创建存钱罐
public fun create_bucky_bank(
    stats: &mut GlobalStats,
    name: vector<u8>,
    target_amount: u64, // 目标金额（USDC）
    duration_days: u64,
    child_address: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    // 验证输入
    if(vector::length(&name) > MAX_NAME_LENGTH) err_invalid_name();
    if(target_amount == 0) err_invalid_amount();
    if(duration_days == 0) err_invalid_deadline();

    let current_time_ms = clock::timestamp_ms(clock);
    let deadline_ms = current_time_ms + (duration_days * 24 * 60 * 60 * 1000);

    let name_str = string::utf8(name);

    let config = Config {
        name: name_str,
        target_amount,
        deadline_ms,
        child_address,
    };

    let sender = ctx.sender();

    let bucky_bank = BuckyBank {
        id: object::new(ctx),
        parent: sender,
        config,
        current_balance: 0,
        status: Status::Active,
        deposit_count: 0,
        created_at_ms: current_time_ms,
        last_deposit_ms: current_time_ms,
    };

    stats.total_bucky_banks = stats.total_bucky_banks + 1;

    // 直接创建，肯定是新的
    if (vec_map::contains(&stats.reward_balances, &sender)) {
        let backyBankId2RewardBalance = vec_map::get_mut(&mut stats.reward_balances, &sender);
        vec_map::insert(backyBankId2RewardBalance, object::id(&bucky_bank), balance::zero<SUI>());
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
        current_balance: bucky_bank.current_balance,
    });

    // 将存钱罐设置为共享对象，家长和孩子都能进行操作
    transfer::share_object(bucky_bank);
}

/// 存款功能 - 只有孩子可以存款
entry fun deposit(
    stats: &mut GlobalStats,
    bucky_bank: &mut BuckyBank,
    deposit_balance: u64, // 存款金额（USDC）
    clock: &Clock,
    ctx: &TxContext,
) {
    let sender = ctx.sender();
    let current_time_ms = clock::timestamp_ms(clock);

    // 验证权限和状态
    if(bucky_bank.status != Status::Active) err_bank_not_active();
    if(sender != bucky_bank.config.child_address) err_not_child();
    if(deposit_balance < 100000) err_invalid_amount(); // 存款金额要 >=0.1 USDC

    bucky_bank.current_balance = bucky_bank.current_balance + deposit_balance;

    if (!vec_map::contains(&stats.deposit_balances, &sender)) {
        vec_map::insert(&mut stats.deposit_balances, sender, vec_map::empty());
    };

    let user_deposits = vec_map::get_mut(&mut stats.deposit_balances, &sender);
    if (!vec_map::contains(user_deposits, &object::id(bucky_bank))) {
        vec_map::insert(user_deposits, object::id(bucky_bank), 0);
    };

    let user_deposit = vec_map::get_mut(user_deposits, &object::id(bucky_bank));
    *user_deposit = *user_deposit + deposit_balance;

    // 更新统计
    bucky_bank.deposit_count = bucky_bank.deposit_count + 1;
    bucky_bank.last_deposit_ms = current_time_ms;

    // 检查是否达到目标
    if (bucky_bank.current_balance >= bucky_bank.config.target_amount) {
        bucky_bank.status = Status::Completed;
    };

    // 发送事件
    event::emit(DepositMade {
        bucky_bank_id: object::id(bucky_bank),
        amount: deposit_balance,
        depositor: sender,
        created_at_ms: current_time_ms,
    });
}

/// 检查是否可以提取（达到目标且超过期限）
public fun can_withdraw(bucky_bank: &BuckyBank, clock: &Clock): bool {
    let current_time_ms = clock::timestamp_ms(clock);

    let target_reached = bucky_bank.status == Status::Completed;

    let deadline_reached = current_time_ms >= bucky_bank.config.deadline_ms;

    target_reached && deadline_reached
}

// 根据存钱罐存款比例(USDC)，分配用户当前所有的奖励金(SUI)
public fun split_reward(stats: &mut GlobalStats, reward_coin: Coin<SUI>, ctx: &mut TxContext) {
    let sender = ctx.sender();

    let total_reward = coin::value(&reward_coin);

    // 如果没有奖励分配，直接销毁并返回既可
    if (total_reward == 0) {
        coin::destroy_zero(reward_coin);
        return
    };

    // 地址没有任何存款，不能分配奖励
    if(!vec_map::contains(&stats.deposit_balances, &sender)) err_no_deposit();

    let backyBankId2DepositBalance = vec_map::get(&stats.deposit_balances, &sender);

    let (backyBankIds, depositBalances) = (*backyBankId2DepositBalance).into_keys_values();

    // 1. 计算所有存钱罐的总余额
    let mut total_balance = 0u64;
    let mut i = 0;
    let banks_count = backyBankIds.length();
    while (i < banks_count) {
        let depositBalance = vector::borrow(&depositBalances, i);
        total_balance = total_balance + *depositBalance;
        i = i + 1;
    };

    if(total_balance == 0) err_invalid_total_balance();

    // 2. 按比例分配奖励到每个存钱罐
    let mut reward_balance = coin::into_balance(reward_coin);

    i = 0;
    while (i < banks_count) {
        let bank_id = backyBankIds[i];

        // 计算该存钱罐应得的奖励比例
        let mut proportion;

        if (i == banks_count - 1) {
            // 为了避免精度问题导致分不完，最后一笔就是所有的奖励
            proportion = balance::value(&reward_balance);
        } else {
            proportion = (depositBalances[i] * total_reward) / total_balance;
        };

        if (proportion > 0) {
            let bank_reward = balance::split(&mut reward_balance, proportion);

            // 更新用户的奖励余额
            if (!vec_map::contains(&stats.reward_balances, &sender)) {
                vec_map::insert(&mut stats.reward_balances, sender, vec_map::empty());
            };

            let user_rewards = vec_map::get_mut(&mut stats.reward_balances, &sender);
            if (!vec_map::contains(user_rewards, &bank_id)) {
                vec_map::insert(user_rewards, bank_id, balance::zero<SUI>());
            };

            let bank_balance = vec_map::get_mut(user_rewards, &bank_id);
            balance::join(bank_balance, bank_reward);

            event::emit(EventBankReward {
                bank_id,
                banks_count,
                reward_receiver: sender,
                total_reward,
                bank_reward: proportion,
                total_balance,
                bank_balance: depositBalances[i],
            });
        };

        i = i + 1;
    };

    // 销毁剩余的reward_balance（应该为0）
    if(balance::value(&reward_balance) != 0) err_invalid_reward_balance_should_be_zero();
    balance::destroy_zero(reward_balance);
}

// 按比列提取存款奖励
#[allow(lint(self_transfer))]
public fun claim_reward(
    stats: &mut GlobalStats,
    bucky_bank: &BuckyBank,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();

    // 奖励池中查无用户地址，不能提取奖励
    if(!vec_map::contains(&stats.reward_balances, &sender)) err_no_reward_no_user();
    let user_rewards = vec_map::get_mut(&mut stats.reward_balances, &sender);

    // 用户没有该存钱罐的奖励，不能提取奖励
    let bucky_bank_id = object::id(bucky_bank);
    if(!vec_map::contains(user_rewards, &bucky_bank_id)) err_no_reward_no_bucky_bank_id();

    // 用户当前存钱罐奖励余额小于0.01 SUI，不能提取奖励
    let bank_balance = vec_map::get_mut(user_rewards, &bucky_bank_id);
    let bank_balance_value = balance::value(bank_balance);
    if(bank_balance_value <= 10_000_000) err_reward_too_low();

    let claim_balance = balance::split(bank_balance, bank_balance_value);

    let current_time_ms = clock::timestamp_ms(clock);

    // 提取奖励
    let claim_coin = coin::from_balance(claim_balance, ctx);
    transfer::public_transfer(claim_coin, sender);

    event::emit(EventClaimReward {
        bank_id: bucky_bank_id,
        reward_receiver: sender,
        reward_amount: bank_balance_value,
        created_at_ms: current_time_ms,
    });
}

/// 创建提取请求
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
    if(sender != bucky_bank.config.child_address) err_not_child();
    if(amount == 0 || amount > bucky_bank.current_balance) err_insufficient_balance();
    if(vector::length(&reason) > MAX_REASON_LENGTH) err_invalid_name();

    let reason_str = string::utf8(reason);

    let request = WithdrawalRequest {
        id: object::new(ctx),
        bucky_bank_id: object::id(bucky_bank),
        requester: sender,
        amount,
        reason: reason_str,
        status: WithdrawalStatus::Pending,
        approved_by: bucky_bank.parent,
        created_at_ms: current_time_ms,
    };

    // 发送事件
    // 该事件入库，家长订阅后去审批
    event::emit(EventWithdrawalRequested {
        request_id: object::id(&request),
        bucky_bank_id: object::id(bucky_bank),
        amount,
        requester: sender,
        reason: reason_str,
        status: WithdrawalStatus::Pending,
        approved_by: bucky_bank.parent,
        created_at_ms: current_time_ms,
    });

    // 转移请求给家长审批
    transfer::transfer(request, bucky_bank.parent);
}

/// 家长审批提取请求
public fun approve_withdrawal(
    request: WithdrawalRequest,
    bucky_bank: &mut BuckyBank,
    approve: bool,
    reason: vector<u8>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let current_time_ms = clock::timestamp_ms(clock);

    // 验证权限和状态
    if(sender != bucky_bank.parent) err_not_parent();
    if(request.status != WithdrawalStatus::Pending) err_invalid_request_status();
    if(request.bucky_bank_id != object::id(bucky_bank)) err_request_not_found();

    let request_id = object::id(&request);
    let amount = request.amount;
    let requester = request.requester;

    let mut request_mut = request;

    // 授权了，提取指定资金，未授权则直接删除请求对象
    if (approve) {
        // 检查余额是否足够提取
        if(amount > bucky_bank.current_balance) err_insufficient_balance();

        // 更新状态为已授权
        request_mut.status = WithdrawalStatus::Approved;

        // 发送事件
        event::emit(EventWithdrawalApproved {
            request_id,
            bucky_bank_id: object::id(bucky_bank),
            amount,
            approved_by: sender,
            requester,
            reason: string::utf8(reason),
            created_at_ms: current_time_ms,
        });
    } else {
        request_mut.status = WithdrawalStatus::Rejected;

        event::emit(EventWithdrawalRejected {
            request_id,
            bucky_bank_id: object::id(bucky_bank),
            amount,
            requester,
            rejected_by: sender,
            reason: string::utf8(reason),
            created_at_ms: current_time_ms,
        });
    };

    // 转移审批请求给小孩进行提取（审批通过）
    transfer::transfer(request_mut, bucky_bank.config.child_address);
}

// 小孩提取存款（若审批通过）
public fun withdraw(
    bucky_bank: &mut BuckyBank,
    request: WithdrawalRequest,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let sender = ctx.sender();
    let current_time_ms = clock::timestamp_ms(clock);

    // 验证权限和条件
    if(sender != bucky_bank.config.child_address) err_not_child();
    if(request.bucky_bank_id != object::id(bucky_bank)) err_bank_not_match();
    if(request.approved_by != bucky_bank.parent) err_not_parent();

    if (request.status == WithdrawalStatus::Approved) {
        let amount = request.amount;
        if(amount == 0 || amount > bucky_bank.current_balance) err_insufficient_balance();
        bucky_bank.current_balance = bucky_bank.current_balance - amount;

        event::emit(EventWithdrawed {
            request_id: object::id(&request),
            bucky_bank_id: object::id(bucky_bank),
            amount,
            left_balance: bucky_bank.current_balance,
            withdrawer: sender,
            created_at_ms: current_time_ms,
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
        approved_by: _,
    } = request;

    object::delete(id);
}
