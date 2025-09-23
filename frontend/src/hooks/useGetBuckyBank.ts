import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { apiClient } from "@/lib/api";
import { QueryKey } from "@/constants";
import type { 
    BuckyBankResponse, 
    BuckyBankSingleResponse, 
    BuckyBankQueryParams,
    BuckyBankCreatedEvent 
} from "@/types";

/**
 * Hook to fetch multiple BuckyBank records with optional filtering and pagination
 */
export function useGetBuckyBanks(
    params?: BuckyBankQueryParams,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<BuckyBankResponse, Error> {
    return useQuery({
        queryKey: [QueryKey.GetBuckyBanks, params],
        queryFn: () => apiClient.getBuckyBanks(params),
        enabled: options?.enabled ?? true,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Hook to fetch a single BuckyBank record by ID
 */
export function useGetBuckyBankById(
    id: string,
    options?: {
        enabled?: boolean;
        refetchInterval?: number;
        staleTime?: number;
    }
): UseQueryResult<BuckyBankSingleResponse, Error> {
    return useQuery({
        queryKey: [QueryKey.GetBuckyBankById, id],
        queryFn: () => apiClient.getBuckyBankById(id),
        enabled: (options?.enabled ?? true) && !!id,
        refetchInterval: options?.refetchInterval,
        staleTime: options?.staleTime ?? 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Hook to fetch BuckyBanks by parent address
 */
export function useGetBuckyBanksByParent(
    parentAddress: string,
    options?: {
        enabled?: boolean;
        page?: number;
        limit?: number;
        refetchInterval?: number;
    }
): UseQueryResult<BuckyBankResponse, Error> {
    const params: BuckyBankQueryParams = {
        parent_address: parentAddress,
        page: options?.page,
        limit: options?.limit,
    };

    return useGetBuckyBanks(params, {
        enabled: (options?.enabled ?? true) && !!parentAddress,
        refetchInterval: options?.refetchInterval,
    });
}

/**
 * Hook to fetch BuckyBanks by child address
 */
export function useGetBuckyBanksByChild(
    childAddress: string,
    options?: {
        enabled?: boolean;
        page?: number;
        limit?: number;
        refetchInterval?: number;
    }
): UseQueryResult<BuckyBankResponse, Error> {
    const params: BuckyBankQueryParams = {
        child_address: childAddress,
        page: options?.page,
        limit: options?.limit,
    };

    return useGetBuckyBanks(params, {
        enabled: (options?.enabled ?? true) && !!childAddress,
        refetchInterval: options?.refetchInterval,
    });
}

/**
 * Utility hook to check API health
 */
export function useApiHealth(): UseQueryResult<{ status: string; message: string }, Error> {
    return useQuery({
        queryKey: ["api-health"],
        queryFn: () => apiClient.healthCheck(),
        staleTime: 30 * 1000, // 30 seconds
        refetchInterval: 60 * 1000, // 1 minute
        retry: 1,
    });
}