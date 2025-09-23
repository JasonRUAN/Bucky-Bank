import { CONSTANTS } from "@/constants";
import type { 
    BuckyBankResponse, 
    BuckyBankSingleResponse, 
    BuckyBankQueryParams 
} from "@/types";

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(endpoint: string, options?: RequestInit): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        
        try {
            const response = await fetch(url, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options?.headers,
                },
                ...options,
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error(`API request failed for ${endpoint}:`, error);
            throw error;
        }
    }

    async getBuckyBanks(params?: BuckyBankQueryParams): Promise<BuckyBankResponse> {
        const searchParams = new URLSearchParams();
        
        if (params?.page) searchParams.append('page', params.page.toString());
        if (params?.limit) searchParams.append('limit', params.limit.toString());
        if (params?.parent_address) searchParams.append('parent_address', params.parent_address);
        if (params?.child_address) searchParams.append('child_address', params.child_address);

        const queryString = searchParams.toString();
        const endpoint = `/api/bucky-banks${queryString ? `?${queryString}` : ''}`;
        
        return this.request<BuckyBankResponse>(endpoint);
    }

    async getBuckyBankById(id: string): Promise<BuckyBankSingleResponse> {
        return this.request<BuckyBankSingleResponse>(`/api/bucky-banks/${id}`);
    }

    async healthCheck(): Promise<{ status: string; message: string }> {
        return this.request<{ status: string; message: string }>('/health');
    }
}

export const apiClient = new ApiClient(CONSTANTS.API.BASE_URL);