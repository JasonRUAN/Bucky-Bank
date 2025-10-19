"use client";

import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useApproveWithdrawal } from "@/mutations/approve_withdrawal";
import type { WithdrawalRequest } from "@/types";

interface WithdrawalApprovalPanelProps {
    pendingRequests: WithdrawalRequest[];
    isLoading?: boolean;
    onRefresh?: () => void;
}

export default function WithdrawalApprovalPanel({
    pendingRequests,
    isLoading = false,
    onRefresh,
}: WithdrawalApprovalPanelProps) {
    const currentAccount = useCurrentAccount();
    const approveWithdrawalMutation = useApproveWithdrawal();

    const handleApproval = async (
        request: WithdrawalRequest,
        status: "Approved" | "Rejected"
    ) => {
        if (!currentAccount?.address) {
            return;
        }

        try {
            await approveWithdrawalMutation.mutateAsync({
                requestId: request.request_id,
                buckyBankId: request.bucky_bank_id,
                approve: status === "Approved",
                reason: status === "Approved" ? "家长批准提取" : "家长拒绝提取",
            });

            // 刷新数据
            if (onRefresh) {
                onRefresh();
            }
        } catch (error) {
            console.error("审批操作失败:", error);
        }
    };

    const formatAmount = (amount: number) => {
        return (amount / 1_000_000).toFixed(2); // 转换为USDC
    };

    const formatDate = (timestamp: number) => {
        return new Date(timestamp).toLocaleString("zh-CN");
    };

    if (isLoading) {
        return (
            <Card className="bg-white/90 backdrop-blur-md border-2 border-orange-500/20 shadow-[0_20px_40px_rgba(251,146,60,0.1)]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-slate-700 flex items-center gap-2">
                        <span className="text-xl">⏳</span>
                        待审批的提取请求
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="text-center py-8">
                        <div className="w-8 h-8 border-4 border-orange-500/30 border-t-orange-500 rounded-full animate-spin mx-auto mb-4"></div>
                        <div className="text-slate-500 text-lg">
                            正在加载审批数据...
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (!pendingRequests || pendingRequests.length === 0) {
        return null; // 没有待审批请求时不显示组件
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="w-full max-w-3xl"
        >
            <Card className="bg-white/90 backdrop-blur-md border-2 border-orange-500/20 shadow-[0_20px_40px_rgba(251,146,60,0.1)]">
                <CardHeader>
                    <CardTitle className="text-lg font-bold text-slate-700 flex items-center gap-2">
                        <span className="text-xl">⏳</span>
                        待审批的提取请求
                        <Badge className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                            {pendingRequests.length} 个待处理
                        </Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6 pt-0">
                    <div className="space-y-4">
                        {pendingRequests.map((request, index) => (
                            <motion.div
                                key={request.request_id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                    duration: 0.3,
                                    delay: index * 0.1,
                                }}
                                className="p-4 rounded-xl border border-orange-200/50 bg-gradient-to-r from-orange-50/80 to-orange-50/60 hover:shadow-md transition-all duration-200"
                            >
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <h3 className="font-bold text-lg text-slate-800">
                                                提取申请
                                            </h3>
                                            <Badge className="bg-gradient-to-r from-yellow-500 to-yellow-600 text-white">
                                                {request.status}
                                            </Badge>
                                        </div>
                                        <div className="text-sm text-slate-600 space-y-1">
                                            <div>
                                                申请金额:{" "}
                                                <span className="font-semibold text-orange-600">
                                                    {formatAmount(
                                                        request.amount
                                                    )}{" "}
                                                    USDC
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
                                                    {formatDate(
                                                        request.created_at_ms
                                                    )}
                                                </span>
                                            </div>
                                            <div>
                                                申请人:{" "}
                                                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                                                    {request.requester}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 审批按钮 */}
                                <div className="flex gap-3 mt-4">
                                    <Button
                                        onClick={() =>
                                            handleApproval(request, "Approved")
                                        }
                                        disabled={
                                            approveWithdrawalMutation.isPending
                                        }
                                        className="flex-1 py-2 rounded-lg bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-none text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                                    >
                                        {approveWithdrawalMutation.isPending ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                处理中...
                                            </div>
                                        ) : (
                                            <>✅ 批准</>
                                        )}
                                    </Button>
                                    <Button
                                        onClick={() =>
                                            handleApproval(request, "Rejected")
                                        }
                                        disabled={
                                            approveWithdrawalMutation.isPending
                                        }
                                        className="flex-1 py-2 rounded-lg bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 border-none text-white font-semibold shadow-lg hover:shadow-xl transition-all duration-200"
                                    >
                                        {approveWithdrawalMutation.isPending ? (
                                            <div className="flex items-center gap-2">
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                                处理中...
                                            </div>
                                        ) : (
                                            <>❌ 拒绝</>
                                        )}
                                    </Button>
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    <div className="text-sm text-slate-500 bg-orange-50/50 p-3 rounded-lg mt-4">
                        💡 <strong>提示：</strong>
                        批准后，孩子可以从存钱罐中提取相应金额。拒绝后，提取请求将被取消。
                    </div>
                </CardContent>
            </Card>
        </motion.div>
    );
}
