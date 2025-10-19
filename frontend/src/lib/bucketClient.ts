import { suiClient } from "@/providers/NetworkConfig";
import { BucketClient } from "@bucket-protocol/sdk";

export const bucketClient = new BucketClient({
    network: "mainnet",
    suiClient: suiClient,
});
