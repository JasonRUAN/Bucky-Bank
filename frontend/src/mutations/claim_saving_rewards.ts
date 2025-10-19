import { CLOCK_OBJECT_ID, CONSTANTS } from "@/constants";
import { useTransactionExecution } from "@/hooks/suihooks/useTransactionExecution";
import { bucketClient } from "@/lib/bucketClient";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useMutation } from "@tanstack/react-query";

export interface ClaimParams {
    buckyBankId: string;
}

export function useClaimSavingRewards({ buckyBankId }: ClaimParams) {
    const account = useCurrentAccount();
    const executeTransaction = useTransactionExecution();

    return useMutation({
        mutationFn: async () => {
            if (!account?.address) {
                throw new Error("You need to connect your wallet first pls!");
            }

            const tx = new Transaction();

            console.log(
                "Step 1: claim all SUI rewards from bucket protocal..."
            );

            const rewardCoins = bucketClient.buildClaimSavingRewardsTransaction(
                tx,
                {
                    lpType: CONSTANTS.TYPE.SUSDB_LP_TYPE,
                }
            );

            if (rewardCoins.length === 0) {
                console.log("No rewards to claim");
                return;
            }

            console.log("Step 2: 按比例分配奖励到每个存钱罐中...");
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::split_reward`,
                arguments: [
                    tx.object(
                        CONSTANTS.BUCKY_BANK_CONTRACT
                            .GLOBAL_STATS_SHARED_OBJECT_ID
                    ),
                    rewardCoins[0], // only sui reward
                ],
            });

            console.log("Step 3: 获取当前存钱罐占比的奖励...");
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::claim_reward`,
                arguments: [
                    tx.object(
                        CONSTANTS.BUCKY_BANK_CONTRACT
                            .GLOBAL_STATS_SHARED_OBJECT_ID
                    ),
                    tx.object(buckyBankId),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            return executeTransaction(tx);
        },
        onError: (error) => {
            console.error("Failed to deposit, ", error);
        },
        onSuccess: (data) => {
            console.log("Successfully deposited, ", data);
        },
    });
}
