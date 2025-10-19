import { useCurrentAccount } from "@mysten/dapp-kit";
import { useGetGlobalStats } from "./useGetGlobalStats";

export interface UserRewardBalances {
    bankId: string;
    rewardAmount: number;
}

export interface UseGetUserRewardBalancesResult {
    data: Array<UserRewardBalances>;
    isLoading: boolean;
    error: string | null;
}

export function useGetUserRewardBalances(): UseGetUserRewardBalancesResult {
    const account = useCurrentAccount();
    const globalStatsHook = useGetGlobalStats();
    const globalStats = globalStatsHook.data;

    // 如果没有连接钱包或没有账户，返回空数据
    if (!account?.address) {
        return {
            data: [],
            isLoading: false,
            error: "未连接钱包",
        };
    }

    // 如果全局统计数据仍在加载
    if (!globalStatsHook.data && globalStatsHook.isLoading) {
        return {
            data: [],
            isLoading: true,
            error: null,
        };
    }

    // 如果获取全局数据出错
    if (!globalStats) {
        return {
            data: [],
            isLoading: false,
            error: globalStatsHook.error || "获取全局数据失败",
        };
    }

    // 检查是否有奖励余额数据
    if (
        !globalStats.reward_balances ||
        !globalStats.reward_balances.fields.contents
    ) {
        return {
            data: [],
            isLoading: false,
            error: null,
        };
    }

    // 从 reward_balances 中查找当前用户的奖励数据
    const userRewardData = globalStats.reward_balances.fields.contents.find(
        (entry) => entry.fields.key === account.address
    );

    // 如果没有找到用户的奖励数据
    if (!userRewardData) {
        return {
            data: [],
            isLoading: false,
            error: null,
        };
    }

    // 转换数据格式
    const rewardBalances = userRewardData.fields.value.fields.contents.map(
        (bankEntry) => ({
            bankId: bankEntry.fields.key,
            rewardAmount: parseInt(bankEntry.fields.value, 10),
        })
    );

    return {
        data: rewardBalances,
        isLoading: false,
        error: null,
    };
}