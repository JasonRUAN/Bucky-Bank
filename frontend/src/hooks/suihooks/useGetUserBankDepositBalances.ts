import { useCurrentAccount } from "@mysten/dapp-kit";
import { useGetGlobalStats } from "./useGetGlobalStats";

export interface UserDepositBalance {
    bankId: string;
    depositAmount: number;
}

export interface UseGetUserBankDepositBalancesResult {
    data: Array<UserDepositBalance>;
    isLoading: boolean;
    error: string | null;
}

export function useGetUserBankDepositBalances(): UseGetUserBankDepositBalancesResult {
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

    // 检查是否有存款余额数据
    if (
        !globalStats.deposit_balances ||
        !globalStats.deposit_balances.fields.contents
    ) {
        return {
            data: [],
            isLoading: false,
            error: null,
        };
    }

    // 从 deposit_balances 中查找当前用户的存款数据
    const userDepositData = globalStats.deposit_balances.fields.contents.find(
        (entry) => entry.fields.key === account.address
    );

    // 如果没有找到用户的存款数据
    if (!userDepositData) {
        return {
            data: [],
            isLoading: false,
            error: null,
        };
    }

    // 转换数据格式
    const depositBalances = userDepositData.fields.value.fields.contents.map(
        (bankEntry) => ({
            bankId: bankEntry.fields.key,
            depositAmount: parseInt(bankEntry.fields.value, 10),
        })
    );

    return {
        data: depositBalances,
        isLoading: false,
        error: null,
    };
}
