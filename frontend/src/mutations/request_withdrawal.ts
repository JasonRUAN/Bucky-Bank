import { CLOCK_OBJECT_ID, CONSTANTS } from "@/constants";
import { useMutation } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTransactionExecution } from "@/hooks/suihooks/useTransactionExecution";

export interface RequestWithdrawalParams {
    buckyBankId: string;
    amount: number;
    reason: string;
}

/**
 * 申请提现 Hook
 * 调用智能合约的 request_withdrawal 函数
 */
export function useRequestWithdrawal() {
    const account = useCurrentAccount();
    const executeTransaction = useTransactionExecution();

    return useMutation({
        mutationFn: async ({ buckyBankId, amount, reason }: RequestWithdrawalParams) => {
            if (!account?.address) {
                throw new Error("You need to connect your wallet first pls!");
            }

            // 验证参数
            const errors = validateRequestWithdrawalParams({ buckyBankId, amount, reason });
            if (errors.length > 0) {
                throw new Error(errors.join(", "));
            }

            const tx = new Transaction();

            console.log("Submitting withdrawal request...");
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::request_withdrawal`,
                arguments: [
                    tx.object(buckyBankId),
                    tx.pure.u64(amount),
                    tx.pure.string(reason),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            return executeTransaction(tx);
        },
        onError: (error) => {
            console.error("Failed to submit withdrawal request: ", error);
        },
        onSuccess: (data) => {
            console.log("Successfully submitted withdrawal request: ", data);
        },
    });
}

/**
 * 验证申请提现参数
 */
export function validateRequestWithdrawalParams(
    params: Partial<RequestWithdrawalParams>
): string[] {
    const errors: string[] = [];

    if (!params.buckyBankId) {
        errors.push("存钱罐ID不能为空");
    }

    if (!params.amount) {
        errors.push("提现金额不能为空");
    } else {
        const amountNum = params.amount;
        if (isNaN(amountNum) || amountNum <= 0) {
            errors.push("提现金额必须大于0");
        }
    }

    if (!params.reason) {
        errors.push("提现理由不能为空");
    } else if (params.reason.trim().length === 0) {
        errors.push("提现理由不能为空");
    }

    return errors;
}