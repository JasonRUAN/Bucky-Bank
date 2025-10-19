"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { CheckCircle, Coins } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useWithdraw } from "@/mutations/withdraw";
import { useHasApprovedWithdrawalRequests } from "@/hooks/dbhooks/useGetApprovedWithdrawalRequests";
import type { WithdrawalRequest } from "@/types";

interface WithdrawalConfirmationPanelProps {
    requesterAddress: string;
    buckyBankId: string;
    onWithdrawSuccess?: (withdrawAmount: number) => void; // 修改回调以传递取款金额
}

/**
 * 取款确认面板组件
 * 显示已批准的取款请求，允许小孩确认提取
 */
export default function WithdrawalConfirmationPanel({
    requesterAddress,
    buckyBankId,
    onWithdrawSuccess,
}: WithdrawalConfirmationPanelProps) {
    const currentAccount = useCurrentAccount();
    const withdrawMutation = useWithdraw();
    
    const {
        data: hasApprovedRequests,
        approvedRequestsList,
        approvedAmount,
        approvedRequests,
        isLoading,
        error,
    } = useHasApprovedWithdrawalRequests(requesterAddress, {
        enabled: !!requesterAddress,
        refetchInterval: 10 * 1000, // 每10秒检查一次
    });

    const handleConfirmWithdraw = async (request: WithdrawalRequest) => {
        if (!currentAccount?.address) {
            return;
        }

        try {
            await withdrawMutation.mutateAsync({
                requestId: request.request_id,
                buckyBankId: request.bucky_bank_id,
            });
            
            // 成功后调用回调函数刷新父组件数据，并传递取款金额
            if (onWithdrawSuccess) {
                const withdrawAmountInUSDC = request.amount / 1_000_000; // 转换为USDC
                onWithdrawSuccess(withdrawAmountInUSDC);
            }
        } catch (error) {
            console.error("确认提取失败:", error);
        }
    };

    const formatAmount = (amount: number) => {
        return (amount / 1_000_000).toFixed(2); // 转换为USDC
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("zh-CN");
    };

    // 如果正在加载，显示加载状态
    if (isLoading) {
        return (
            <Card className="bg-white/90 backdrop-blur-md border-2 border-green-500/20 shadow-[0_20px_40px_rgba(34,197,94,0.1)]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-slate-700 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        已批准的取款请求
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-green-500/30 border-t-green-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <div className="text-slate-500 text-lg">
                            正在检查批准状态...
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // 如果没有已批准的请求，不显示组件
    if (!hasApprovedRequests || approvedRequestsList.length === 0) {
        return null;
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-3xl"
        >
            <Card className="bg-white/90 backdrop-blur-md border-2 border-green-500/20 shadow-[0_20px_40px_rgba(34,197,94,0.1)]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-slate-700 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5 text-green-500" />
                        已批准的取款请求
                        <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                            {approvedRequests} 个待提取
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="space-y-4">
                        {approvedRequestsList.map((request, index) => (
                            <motion.div
                                key={request.request_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.1,
                                }}
                                className="p-4 rounded-xl border border-green-200/50 bg-gradient-to-r from-green-50/80 to-green-50/60 hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-bold text-lg text-slate-800">
                                                已批准提取
                                            </h3>
                                            <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                                                {request.status}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-slate-600 space-y-1">
                                            <div>
                                                批准金额:{" "}
                                                <span className="font-semibold text-green-600">
                                                    {formatAmount(request.amount)} USDC
                                                </span>
                                            </div>
                                            <div>
                                                申请理由:{" "}
                                                <span className="font-medium">
                                                    {request.reason}
                                                </span>
                                            </div>
                                            <div>
                                                申请时间:{" "}
                                                <span className="font-medium">
                                                    {formatDate(request.created_at_ms)}
                                                </span>
                                            </div>
                                            {request.audit_at_ms && (
                                                <div>
                                                    批准时间:{" "}
                                                    <span className="font-medium">
                                                        {formatDate(request.audit_at_ms)}
                                                    </span>
                                                </div>
                                            )}
                                            {request.approved_by && (
                                                <div>
                                                    批准人:{" "}
                                                    <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                                                        {request.approved_by}
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* 确认提取按钮 */}
                                <div className="flex gap-3 mt-4">
                                    <Button
                                        onClick={() => handleConfirmWithdraw(request)}
                                        disabled={withdrawMutation.isPending}
                                        className="flex-1 py-3 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-none text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                                    >
                                        {withdrawMutation.isPending ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                提取中...
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2">
                                                <Coins className="w-4 h-4" />
                                                确认提取
                                            </div>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* 总计信息 */}
                    <div className="mt-4 p-3 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200/50">
                        <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-slate-600">
                                总计可提取金额:
                            </span>
                            <span className="text-lg font-bold text-green-600">
                                {formatAmount(approvedAmount)} USDC
                            </span>
                        </div>
                    </div>

                    <div className="text-sm text-slate-500 bg-green-50/50 p-3 rounded-lg mt-4">
                        🎉 <strong>恭喜！</strong>
                        你的取款申请已经获得家长批准，点击&ldquo;确认提取&rdquo;按钮即可将资金提取到你的钱包。
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}