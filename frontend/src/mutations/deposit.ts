import { CLOCK_OBJECT_ID, CONSTANTS } from "@/constants";
import { useMutation } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTransactionExecution } from "@/hooks/useTransactionExecution";

export interface DepositParams {
  buckyBankId: string;
  amount: string; // Amount in MIST (1 SUI = 1,000,000,000 MIST)
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
                throw new Error(errors.join(', '));
            }

            const tx = new Transaction();

            // 分割 SUI 币用于存款
            const [depositCoin] = tx.splitCoins(tx.gas, [amount]);

            // 调用 deposit 函数
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::deposit`,
                arguments: [
                    tx.object(buckyBankId), // bucky_bank: &mut BuckyBank
                    depositCoin, // deposit_coin: Coin<SUI>
                    tx.object(CLOCK_OBJECT_ID), // clock: &Clock
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

/**
 * 验证存款参数
 */
export function validateDepositParams(params: Partial<DepositParams>): string[] {
  const errors: string[] = [];

  if (!params.buckyBankId) {
    errors.push('存钱罐ID不能为空');
  }

  if (!params.amount) {
    errors.push('存款金额不能为空');
  } else {
    const amountNum = parseInt(params.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      errors.push('存款金额必须大于0');
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
    throw new Error('无效的SUI金额');
  }
  return (sui * 1_000_000_000).toString();
}

/**
 * 将 MIST 转换为 SUI
 */
export function mistToSui(mistAmount: string): string {
  const mist = parseInt(mistAmount);
  if (isNaN(mist)) {
    throw new Error('无效的MIST金额');
  }
  return (mist / 1_000_000_000).toString();
}