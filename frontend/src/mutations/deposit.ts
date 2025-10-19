import { CLOCK_OBJECT_ID, CONSTANTS } from "@/constants";
import { useMutation } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTransactionExecution } from "@/hooks/suihooks/useTransactionExecution";
import { bucketClient } from "@/lib/bucketClient";

export interface DepositParams {
    buckyBankId: string;
    amount: number;
}

/**
 * 存款 Hook
 * 调用智能合约的 deposit 函数
 */
export function useDeposit() {
    const account = useCurrentAccount();
    const executeTransaction = useTransactionExecution();

    return useMutation({
        mutationFn: async ({ buckyBankId, amount }: DepositParams) => {
            if (!account?.address) {
                throw new Error("You need to connect your wallet first pls!");
            }

            // 验证参数
            const errors = validateDepositParams({ buckyBankId, amount });
            if (errors.length > 0) {
                throw new Error(errors.join(", "));
            }

            const tx = new Transaction();

            // 开始存款
            console.log("Step 3: Converting USDC to USDB...");
            const usdbCoin = await bucketClient.buildPSMSwapInTransaction(tx, {
                coinType: CONSTANTS.TYPE.USDC_COIN_TYPE,
                inputCoinOrAmount: amount,
            });

            console.log("Step 4: Depositing USDB into savings pool...");
            bucketClient.buildDepositToSavingPoolTransaction(tx, {
                lpType: CONSTANTS.TYPE.SUSDB_LP_TYPE,
                depositCoinOrAmount: usdbCoin,
                address: account.address,
            });

            console.log("Step 5: record to bucky bank...");
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::deposit`,
                arguments: [
                    tx.object(CONSTANTS.BUCKY_BANK_CONTRACT.GLOBAL_STATS_SHARED_OBJECT_ID),
                    tx.object(buckyBankId),
                    tx.pure.u64(amount),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            // 存款前先按当前存款比例分配奖励，避免存款后奖励分配不准确
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

            console.log(">>> length rewardCoins: ", rewardCoins.length)

            // 判断奖励数量大于0，才需要进行分配

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

            // tx.transferObjects([rewardCoins[0]], account.address);

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

/**
 * 验证存款参数
 */
export function validateDepositParams(
    params: Partial<DepositParams>
): string[] {
    const errors: string[] = [];

    if (!params.buckyBankId) {
        errors.push("存钱罐ID不能为空");
    }

    if (!params.amount) {
        errors.push("存款金额不能为空");
    } else {
        const amountNum = params.amount;
        if (isNaN(amountNum) || amountNum <= 0) {
            errors.push("存款金额必须大于0");
        }
    }

    return errors;
}

/**
 * 将 SUI 转换为 MIST (1 SUI = 1,000,000,000 MIST)
 */
export function suiToMist(suiAmount: string): string {
    const sui = parseFloat(suiAmount);
    if (isNaN(sui)) {
        throw new Error("无效的SUI金额");
    }
    return (sui * 1_000_000_000).toString();
}

/**
 * 将 MIST 转换为 SUI
 */
export function mistToSui(mistAmount: string): string {
    const mist = parseInt(mistAmount);
    if (isNaN(mist)) {
        throw new Error("无效的MIST金额");
    }
    return (mist / 1_000_000_000).toString();
}

export function amountToUSDC(amount: string): string {
    const usdc = parseFloat(amount);
    if (isNaN(usdc)) {
        throw new Error("无效的USDC金额");
    }
    return (usdc * 1_000_000).toString();
}

export function usdcToAmount(usdcAmount: string): string {
    const amount = parseInt(usdcAmount);
    if (isNaN(amount)) {
        throw new Error("无效的USDC金额");
    }
    return (amount / 1_000_000).toString();
}
