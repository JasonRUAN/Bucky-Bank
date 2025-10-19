import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryKey } from "@/constants";
import type { WithdrawalRequest, WithdrawalRequestResponse } from "@/types";

/**
 * Hook to get all pending withdrawal requests for banks created by a parent
 * This aggregates pending requests from all the parent's created banks
 */
export function useGetParentPendingRequests(
    parentAddress: string,
    buckyBankIds: string[],
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<WithdrawalRequest[], Error> {
    return useQuery({
        queryKey: [QueryKey.GetWithdrawalRequestsByBuckyBankId, 'parent-pending', parentAddress, buckyBankIds],
        queryFn: async () => {
            if (!buckyBankIds.length) {
                return [];
            }

            // 并行获取所有存钱罐的待审批请求
            const requests = await Promise.all(
                buckyBankIds.map(bankId => 
                    apiClient.getWithdrawalRequestsByBuckyBankId(bankId, { 
                        status: 'Pending',
                        limit: 100 // 获取所有待审批请求
                    })
                )
            );

            // 合并所有请求并按时间排序
            const allRequests: WithdrawalRequest[] = [];
            requests.forEach(response => {
                if (response.success && response.data) {
                    allRequests.push(...response.data);
                }
            });

            // 按创建时间降序排序（最新的在前）
            return allRequests.sort((a, b) => b.created_at_ms - a.created_at_ms);
        },
        enabled: (options?.enabled ?? true) && !!parentAddress && buckyBankIds.length > 0,
        refetchInterval: options?.refetchInterval ?? 30 * 1000, // 每30秒检查一次
        staleTime: options?.staleTime ?? 10 * 1000, // 10秒
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}