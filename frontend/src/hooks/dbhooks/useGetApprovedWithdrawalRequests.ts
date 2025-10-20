import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryKey } from "@/constants";
import type { WithdrawalRequestResponse } from "@/types";

/**
 * Hook to get approved withdrawal requests for a specific requester
 * 获取指定申请人的已批准取款请求
 */
export function useGetApprovedWithdrawalRequests(
    requester: string,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<WithdrawalRequestResponse, Error> {
    return useQuery({
        queryKey: [
            QueryKey.GetWithdrawalRequestsByRequester,
            requester,
            { status: "Approved" },
        ],
        queryFn: () =>
            apiClient.getWithdrawalRequestsByRequester(requester, {
                status: "Approved",
                limit: 100, // Get all approved requests
            }),
        enabled: (options?.enabled ?? true) && !!requester,
        refetchInterval: options?.refetchInterval ?? 30 * 1000, // Check every 30 seconds
        staleTime: options?.staleTime ?? 10 * 1000, // 10 seconds
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Hook to check if there are approved withdrawal requests for a specific requester
 * 检查指定申请人是否有已批准的取款请求
 */
export function useHasApprovedWithdrawalRequests(
    requester: string,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
    }
) {
    const query = useGetApprovedWithdrawalRequests(requester, options);

    // 计算派生状态
    const hasApproved = query.data?.success && query.data.data.length > 0;
    const approvedAmount = query.data?.success
        ? query.data.data.reduce((sum, req) => sum + req.amount, 0)
        : 0;
    const approvedRequests = query.data?.success ? query.data.data.length : 0;
    const approvedRequestsList = query.data?.success ? query.data.data : [];

    return {
        ...query,
        data: hasApproved ?? false,
        approvedAmount,
        approvedRequests,
        approvedRequestsList,
    };
}
