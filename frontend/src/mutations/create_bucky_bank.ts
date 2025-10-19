import { CLOCK_OBJECT_ID } from "@/constants";
import { useMutation } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { CONSTANTS } from "../constants";
import type { BuckyBankInfo } from "@/types";
import { useTransactionExecution } from "@/hooks/suihooks/useTransactionExecution";

export function useCreateBuckyBank() {
    const account = useCurrentAccount();
    const executeTransaction = useTransactionExecution();

    return useMutation({
        mutationFn: async (infos: BuckyBankInfo[]) => {
            if (!account?.address) {
                throw new Error("You need to connect your wallet first pls!");
            }

            const tx = new Transaction();

            for (const info of infos) {
                tx.moveCall({
                    target: CONSTANTS.BUCKY_BANK_CONTRACT
                        .TARGET_CREATE_BUCKY_BANK,
                    arguments: [
                        tx.object(CONSTANTS.BUCKY_BANK_CONTRACT.GLOBAL_STATS_SHARED_OBJECT_ID),
                        tx.pure.string(info.name),
                        tx.pure.u64(info.target_amount),
                        tx.pure.u64(info.duration_days),
                        tx.pure.address(info.child_address),
                        tx.object(CLOCK_OBJECT_ID),
                    ],
                });
            }

            return executeTransaction(tx);
        },
        onError: (error) => {
            console.error("Failed to create bucky bank, ", error);
        },
        onSuccess: (data) => {
            console.log("Successfully created bucky bank, ", data);
        },
    });
}
