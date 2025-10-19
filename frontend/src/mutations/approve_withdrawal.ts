import { CLOCK_OBJECT_ID, CONSTANTS } from "@/constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKey } from "@/constants";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTransactionExecution } from "@/hooks/suihooks/useTransactionExecution";
import { toast } from "sonner";

export interface ApproveWithdrawalParams {
    requestId: string;
    buckyBankId: string;
    approve: boolean;
    reason: string;
}

/**
 * 审批提现申请 Hook
 * 调用智能合约的 approve_withdrawal 函数
 */
export function useApproveWithdrawal() {
    const account = useCurrentAccount();
    const executeTransaction = useTransactionExecution();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, buckyBankId, approve, reason }: ApproveWithdrawalParams) => {
            if (!account?.address) {
                throw new Error("You need to connect your wallet first pls!");
            }

            // 验证参数
            const errors = validateApproveWithdrawalParams({ requestId, buckyBankId, approve, reason });
            if (errors.length > 0) {
                throw new Error(errors.join(", "));
            }

            const tx = new Transaction();

            console.log(`${approve ? 'Approving' : 'Rejecting'} withdrawal request...`);
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::approve_withdrawal`,
                arguments: [
                    tx.object(requestId),
                    tx.object(buckyBankId),
                    tx.pure.bool(approve),
                    tx.pure.string(reason),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            return executeTransaction(tx);
        },
        onError: (error) => {
            console.error("Failed to process withdrawal approval: ", error);
            toast.error(`审批失败: ${error instanceof Error ? error.message : '未知错误'}`);
        },
        onSuccess: (data, variables) => {
            console.log("Successfully processed withdrawal approval: ", data);
            const action = variables.approve ? '批准' : '拒绝';
            toast.success(`提现申请${action}成功`);
            
            // 刷新相关查询
            queryClient.invalidateQueries({ 
                queryKey: [QueryKey.GetWithdrawalRequestsByBuckyBankId, variables.buckyBankId] 
            });
            queryClient.invalidateQueries({ 
                queryKey: [QueryKey.GetParentPendingRequests] 
            });
        },
    });
}

/**
 * 验证审批提现参数
 */
export function validateApproveWithdrawalParams(
    params: Partial<ApproveWithdrawalParams>
): string[] {
    const errors: string[] = [];

    if (!params.requestId) {
        errors.push("提现申请ID不能为空");
    }

    if (!params.buckyBankId) {
        errors.push("存钱罐ID不能为空");
    }

    if (params.approve === undefined || params.approve === null) {
        errors.push("审批结果不能为空");
    }

    if (!params.reason) {
        errors.push("审批理由不能为空");
    } else if (params.reason.trim().length === 0) {
        errors.push("审批理由不能为空");
    }

    return errors;
}