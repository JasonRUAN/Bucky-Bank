import { CONSTANTS } from "@/constants";
import { useGetObject } from "./useGetObject";
import { GlobalStatsData } from "@/types/move";

export function useGetGlobalStats() {
    const objectsData = useGetObject({
        objectId: CONSTANTS.BUCKY_BANK_CONTRACT.GLOBAL_STATS_SHARED_OBJECT_ID,
    });

    if (!objectsData) {
        return {
            data: null,
            isLoading: false,
            error: "global stats not found",
        };
    }

    let stats: GlobalStatsData | null = null;

    if (objectsData.data?.content && "fields" in objectsData.data.content) {
        stats = objectsData.data.content.fields as GlobalStatsData;
    }

    return {
        data: stats || null,
        isLoading: !stats,
        error: null,
    };
}
