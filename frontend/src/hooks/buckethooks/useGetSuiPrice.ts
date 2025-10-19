import { useQuery, UseQueryResult } from "@tanstack/react-query";
import { QueryKey, SUI_COIN_TYPE } from "@/constants";
import { bucketClient } from "@/lib/bucketClient";

/**
 * Hook to fetch current SUI price using Bucket Protocol oracle
 */
export function useGetSuiPrice(): UseQueryResult<number | null, Error> {
    return useQuery({
        queryKey: [QueryKey.GetBuckyBanks, "sui-price"],
        queryFn: async (): Promise<number | null> => {
            try {
                const prices = await bucketClient.getOraclePrices({
                    coinTypes: [SUI_COIN_TYPE],
                });

                const suiPrice = prices[SUI_COIN_TYPE];

                if (!suiPrice || isNaN(suiPrice)) {
                    throw new Error("Invalid SUI price received from oracle");
                }

                return suiPrice;
            } catch (error) {
                console.error("Error fetching SUI price:", error);
                throw error;
            }
        },
        enabled: true,
        refetchInterval: 60 * 1000,
        staleTime: 5 * 60 * 1000, // 5 minutes
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    });
}

/**
 * Utility hook to format SUI price for display
 */
export function useRewardSuiPrice(rewardAmount: number) {
    const { data: suiPrice, ...queryInfo } = useGetSuiPrice();

    if (!suiPrice) {
        return {
            ...queryInfo,
            rewardAmount: rewardAmount,
            usdValue: null,
            formattedValue: null,
        };
    }

    // Convert MIST (9 decimals) to SUI and then to USD
    const usdValue = (Number(rewardAmount) / 1_000_000_000) * suiPrice;

    return {
        ...queryInfo,
        rewardAmount,
        usdValue,
        formattedValue: `$${usdValue.toFixed(2)}`,
    };
}
