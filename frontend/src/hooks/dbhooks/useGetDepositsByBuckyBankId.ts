import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryKey } from "@/constants";
import type {
    DepositResponse,
    DepositQueryParams
} from "@/types";

/**
 * Hook to fetch deposits by BuckyBank ID with optional pagination
 */
export function useGetDepositsByBuckyBankId(
    buckyBankId: string,
    params?: DepositQueryParams,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<DepositResponse, Error> {
    return useQuery({
        queryKey: [QueryKey.GetDepositsByBuckyBankId, buckyBankId, params],
        queryFn: () => apiClient.getDepositsByBuckyBankId(buckyBankId, params),
        enabled: (options?.enabled ?? true) && !!buckyBankId,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}