"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { bucketClient } from "@/lib/bucketClient";
import { CONSTANTS, SUI_COIN_TYPE } from "@/constants";
import { UserSavings, UserSavingsData } from "@/types";

/**
 * 获取用户储蓄数据的 hook
 */
export function useGetUserSavings(userAddress?: string) {
    return useQuery<UserSavings>({
        queryKey: ["userSavings", userAddress],
        queryFn: async () => {
            if (!userAddress) throw new Error("User address is required");

            const userSavings = await bucketClient.getUserSavings({
                address: userAddress,
            });

            console.log("User savings:", userSavings);
            return userSavings;
        },
        enabled: !!userAddress,
        staleTime: 30000, // 30秒内数据被认为是新鲜的
        refetchInterval: 60000, // 每分钟自动刷新
    });
}

/**
 * 专门获取 SUSDB LP 的 SUI 收益的 hook
 */
export function useGetSUSDBSuiRewards(userAddress?: string) {
    const { data: userSavings, ...rest } = useGetUserSavings(userAddress);

    const susdbData = useMemo((): UserSavingsData | null => {
        if (!userSavings) return null;
        return userSavings[CONSTANTS.TYPE.SUSDB_LP_TYPE] || null;
    }, [userSavings]);

    const suiRewards = useMemo((): bigint => {
        if (!susdbData) return BigInt(0);
        return susdbData.rewards[SUI_COIN_TYPE] || BigInt(0);
    }, [susdbData]);

    // 格式化 SUI 收益为可读的数字（SUI 有 9 位小数）
    const formattedSuiRewards = useMemo((): string => {
        if (suiRewards === BigInt(0)) return "0";
        return (Number(suiRewards) / 1_000_000_000).toFixed(2);
    }, [suiRewards]);

    return {
        susdbData,
        suiRewards,
        formattedSuiRewards,
        hasSUSDBSavings: !!susdbData,
        ...rest,
    };
}

/**
 * 获取所有 LP 类型的总收益概览
 */
export function useGetTotalRewards(userAddress?: string) {
    const { data: userSavings, ...rest } = useGetUserSavings(userAddress);

    const totalRewards = useMemo(() => {
        if (!userSavings) return {};

        const allRewards: { [coinType: string]: bigint } = {};

        Object.values(userSavings).forEach((savingsData) => {
            Object.entries(savingsData.rewards).forEach(
                ([coinType, amount]) => {
                    allRewards[coinType] =
                        (allRewards[coinType] || BigInt(0)) + amount;
                }
            );
        });

        return allRewards;
    }, [userSavings]);

    const totalSuiRewards = useMemo((): bigint => {
        return totalRewards[SUI_COIN_TYPE] || BigInt(0);
    }, [totalRewards]);

    const formattedTotalSuiRewards = useMemo((): string => {
        if (totalSuiRewards === BigInt(0)) return "0";
        return (Number(totalSuiRewards) / 1_000_000_000).toFixed(4);
    }, [totalSuiRewards]);

    return {
        totalRewards,
        totalSuiRewards,
        formattedTotalSuiRewards,
        ...rest,
    };
}
