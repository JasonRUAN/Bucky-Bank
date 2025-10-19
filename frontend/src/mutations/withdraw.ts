import { CLOCK_OBJECT_ID, CONSTANTS } from "@/constants";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { QueryKey } from "@/constants";
import { Transaction } from "@mysten/sui/transactions";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useTransactionExecution } from "@/hooks/suihooks/useTransactionExecution";
import { toast } from "sonner";
import { bucketClient } from "@/lib/bucketClient";
import { suiClient } from "@/providers/NetworkConfig";
import { useGetObject } from "@/hooks/suihooks/useGetObject";
import { SuiParsedData } from "@mysten/sui/client";
import { WithdrawalRequest } from "@/types/move";

export interface WithdrawParams {
    requestId: string;
    buckyBankId: string;
}

/**
 * 执行提现 Hook
 * 调用智能合约的 withdraw 函数，执行已批准的提现申请
 */
export function useWithdraw() {
    const account = useCurrentAccount();
    const executeTransaction = useTransactionExecution();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ requestId, buckyBankId }: WithdrawParams) => {
            if (!account?.address) {
                throw new Error("You need to connect your wallet first pls!");
            }

            const objectsData = await suiClient.getObject({
                id: requestId,
                options: {
                    showType: true,
                    showOwner: true,
                    showContent: true,
                },
            });

            console.log("!!##@@##!!", JSON.stringify(objectsData));

            const parsedRequest = objectsData?.data?.content as
                | SuiParsedData
                | undefined;
            const requestObj =
                parsedRequest && "fields" in parsedRequest
                    ? (parsedRequest.fields as WithdrawalRequest)
                    : undefined;

            if (requestObj === undefined) {
                throw new Error("Withdrawal request not found");
            }

            const withdrawLpAmount = requestObj.amount;
            const requester = requestObj.requester;

            if (requester !== account?.address) {
                throw new Error(
                    "You are not the requester of this withdrawal request"
                );
            }

            // 验证参数
            const errors = validateWithdrawParams({ requestId, buckyBankId });
            if (errors.length > 0) {
                throw new Error(errors.join(", "));
            }

            const tx = new Transaction();

            console.log("Executing withdrawal...");
            tx.moveCall({
                target: `${CONSTANTS.BUCKY_BANK_CONTRACT.PACKAGE_ID}::bucky_bank::withdraw`,
                arguments: [
                    tx.object(buckyBankId),
                    tx.object(requestId),
                    tx.object(CLOCK_OBJECT_ID),
                ],
            });

            // 6. 构建取款交易
            const usdbCoin =
                bucketClient.buildWithdrawFromSavingPoolTransaction(tx, {
                    lpType: CONSTANTS.TYPE.SUSDB_LP_TYPE,
                    amount: Number(withdrawLpAmount),
                });

            // 7. 将 USDB 转换为 USDC
            const usdcCoin = await bucketClient.buildPSMSwapOutTransaction(tx, {
                coinType: CONSTANTS.TYPE.USDC_COIN_TYPE,
                usdbCoinOrAmount: usdbCoin,
            });

            // 8. 将转换后的 USDC 转给用户
            tx.transferObjects([usdcCoin], requester);

            const result = await executeTransaction(tx);

            // 检查交易结果
            if (!result?.objectChanges || result.objectChanges.length === 0) {
                throw new Error("提现执行失败，未检测到对象变更");
            }

            console.log("Withdrawal executed successfully:", result);
            return result;
        },
        onError: (error) => {
            console.error("Failed to execute withdrawal: ", error);
            toast.error(
                `提现执行失败: ${
                    error instanceof Error ? error.message : "未知错误"
                }`
            );
        },
        onSuccess: (data, variables) => {
            console.log("Successfully executed withdrawal: ", data);
            toast.success("提现执行成功！");

            // 刷新相关查询
            queryClient.invalidateQueries({
                queryKey: [
                    QueryKey.GetWithdrawalRequestsByBuckyBankId,
                    variables.buckyBankId,
                ],
            });
            queryClient.invalidateQueries({
                queryKey: [QueryKey.GetBuckyBankById, variables.buckyBankId],
            });
            queryClient.invalidateQueries({
                queryKey: [QueryKey.GetWithdrawalRequestsByRequester],
            });

            // 刷新存钱罐列表和余额相关查询 - 这是关键的修复
            queryClient.invalidateQueries({
                queryKey: [QueryKey.GetBuckyBanks],
            });
            
            // 刷新存取款记录
            queryClient.invalidateQueries({
                queryKey: [
                    QueryKey.GetDepositsByBuckyBankId,
                    variables.buckyBankId,
                ],
            });
            queryClient.invalidateQueries({
                queryKey: [
                    QueryKey.GetWithdrawsByBuckyBankId,
                    variables.buckyBankId,
                ],
            });

            // 刷新取款请求相关查询
            queryClient.invalidateQueries({
                queryKey: [QueryKey.GetWithdrawalRequestsByRequester],
            });
            
            // 强制刷新所有与存钱罐相关的查询，确保余额更新
            queryClient.refetchQueries({
                queryKey: [QueryKey.GetBuckyBanks],
            });
        },
    });
}

/**
 * 验证提现参数
 */
export function validateWithdrawParams(
    params: Partial<WithdrawParams>
): string[] {
    const errors: string[] = [];

    if (!params.requestId) {
        errors.push("提现申请ID不能为空");
    }

    if (!params.buckyBankId) {
        errors.push("存钱罐ID不能为空");
    }

    return errors;
}
