import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryKey } from "@/constants";
import type {
    WithdrawalRequestResponse,
    WithdrawalRequestQueryParams
} from "@/types";

/**
 * Hook to fetch withdrawal requests by BuckyBank ID with optional filtering and pagination
 */
export function useGetWithdrawalRequestsByBuckyBankId(
    buckyBankId: string,
    params?: WithdrawalRequestQueryParams,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<WithdrawalRequestResponse, Error> {
    return useQuery({
        queryKey: [QueryKey.GetWithdrawalRequestsByBuckyBankId, buckyBankId, params],
        queryFn: () => apiClient.getWithdrawalRequestsByBuckyBankId(buckyBankId, params),
        enabled: (options?.enabled ?? true) && !!buckyBankId,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Hook to fetch withdrawal requests by requester address with optional filtering and pagination
 */
export function useGetWithdrawalRequestsByRequester(
    requester: string,
    params?: WithdrawalRequestQueryParams,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<WithdrawalRequestResponse, Error> {
    return useQuery({
        queryKey: [QueryKey.GetWithdrawalRequestsByRequester, requester, params],
        queryFn: () => apiClient.getWithdrawalRequestsByRequester(requester, params),
        enabled: (options?.enabled ?? true) && !!requester,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Hook to check if there are pending withdrawal requests for a specific requester
 * This can be used to determine if the withdrawal button should be disabled
 */
export function useHasPendingWithdrawalRequests(
    requester: string,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
    }
) {
    const query = useQuery({
        queryKey: [QueryKey.GetWithdrawalRequestsByRequester, requester, { status: 'Pending' }],
        queryFn: () => apiClient.getWithdrawalRequestsByRequester(requester, { 
            status: 'Pending',
            limit: 100 // Get all pending requests to calculate total amount
        }),
        enabled: (options?.enabled ?? true) && !!requester,
        refetchInterval: options?.refetchInterval ?? 30 * 1000, // Check every 30 seconds
        staleTime: 10 * 1000, // 10 seconds
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });

    // 计算派生状态
    const hasPending = query.data?.success && query.data.data.length > 0;
    const pendingAmount = query.data?.success ? query.data.data.reduce((sum, req) => sum + req.amount, 0) : 0;
    const pendingRequests = query.data?.success ? query.data.data.length : 0;

    return {
        ...query,
        data: hasPending ?? false,
        pendingAmount,
        pendingRequests,
    };
}

/**
 * Hook to get withdrawal requests for a specific BuckyBank with pending status filter
 * Useful for parents to see pending withdrawal requests from their children
 */
export function useGetPendingWithdrawalRequestsByBuckyBankId(
    buckyBankId: string,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<WithdrawalRequestResponse, Error> {
    return useGetWithdrawalRequestsByBuckyBankId(
        buckyBankId,
        { status: 'Pending' },
        {
            enabled: options?.enabled,
            refetchInterval: options?.refetchInterval ?? 30 * 1000, // Check every 30 seconds for pending requests
            staleTime: options?.staleTime ?? 10 * 1000, // 10 seconds
        }
    );
}