import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryKey } from "@/constants";
import type {
    WithdrawResponse,
    WithdrawQueryParams
} from "@/types";

/**
 * Hook to fetch withdrawals by BuckyBank ID with optional pagination
 */
export function useGetWithdrawByBuckyBankId(
    buckyBankId: string,
    params?: WithdrawQueryParams,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<WithdrawResponse, Error> {
    return useQuery({
        queryKey: [QueryKey.GetWithdrawsByBuckyBankId, buckyBankId, params],
        queryFn: () => apiClient.getWithdrawsByBuckyBankId(buckyBankId, params),
        enabled: (options?.enabled ?? true) && !!buckyBankId,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}