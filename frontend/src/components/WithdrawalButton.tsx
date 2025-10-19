import React from "react";
import { motion } from "framer-motion";
import { Coins } from "lucide-react";
import { useHasPendingWithdrawalRequests } from "@/hooks/dbhooks/useGetWithdrawalRequests";
import { useHasApprovedWithdrawalRequests } from "@/hooks/dbhooks/useGetApprovedWithdrawalRequests";

interface WithdrawalButtonProps {
    requesterAddress: string;
    onWithdraw: () => void;
    disabled?: boolean;
    className?: string;
}

/**
 * 取款按钮组件
 * 根据是否有待审批的取款请求来控制按钮状态和显示文本
 */
export function WithdrawalButton({
    requesterAddress,
    onWithdraw,
    disabled = false,
    className = "",
}: WithdrawalButtonProps) {
    const {
        data: hasPendingRequests,
        pendingAmount,
        pendingRequests,
        isLoading: isPendingLoading,
        error: pendingError,
    } = useHasPendingWithdrawalRequests(requesterAddress, {
        enabled: !!requesterAddress,
    });

    const {
        data: hasApprovedRequests,
        approvedAmount,
        approvedRequests,
        isLoading: isApprovedLoading,
        error: approvedError,
    } = useHasApprovedWithdrawalRequests(requesterAddress, {
        enabled: !!requesterAddress,
    });

    // 如果有待审批或待确认的请求或者外部禁用，按钮应该被禁用
    const isDisabled = disabled || hasPendingRequests || hasApprovedRequests || isPendingLoading || isApprovedLoading;
    const isLoading = isPendingLoading || isApprovedLoading;
    const error = pendingError || approvedError;

    // 格式化金额显示（假设金额以最小单位存储，需要除以适当的倍数）
    const formatAmount = (amount: number) => {
        return (amount / 1000000).toFixed(2); // 假设是 6 位小数的代币
    };

    const getButtonText = () => {
        if (isLoading) return "检查状态中...";
        if (error) return "检查失败";
        if (hasPendingRequests) return "取款审批中";
        if (hasApprovedRequests) return "待确认取款";
        return "申请取款";
    };

    const getButtonIcon = () => {
        if (isLoading || hasPendingRequests || hasApprovedRequests) {
            return (
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                        duration: 1,
                        repeat: Infinity,
                        ease: "linear",
                    }}
                >
                    <Coins className="w-5 h-5" />
                </motion.div>
            );
        }
        return <Coins className="w-5 h-5" />;
    };

    const getStatusInfo = () => {
        const statusItems = [];

        // 待审批请求信息
        if (hasPendingRequests && pendingAmount && pendingRequests) {
            statusItems.push(
                <div key="pending" className="text-sm text-orange-600 bg-orange-50 p-2 rounded">
                    <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                        <span>待审批取款请求</span>
                    </div>
                    <div className="mt-1 text-xs">
                        <span>申请数量: {pendingRequests} 笔</span>
                        <span className="ml-3">
                            总金额: {formatAmount(pendingAmount)} USDC
                        </span>
                    </div>
                </div>
            );
        }

        // 待确认请求信息
        if (hasApprovedRequests && approvedAmount && approvedRequests) {
            statusItems.push(
                <div key="approved" className="text-sm text-green-600 bg-green-50 p-2 rounded">
                    <div className="flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        <span>待确认取款请求</span>
                    </div>
                    <div className="mt-1 text-xs">
                        <span>申请数量: {approvedRequests} 笔</span>
                        <span className="ml-3">
                            总金额: {formatAmount(approvedAmount)} USDC
                        </span>
                    </div>
                </div>
            );
        }

        if (statusItems.length === 0) return null;

        return (
            <div className="mt-2 space-y-2">
                {statusItems}
            </div>
        );
    };

    return (
        <div className="w-full">
            <button
                onClick={onWithdraw}
                disabled={isDisabled}
                className={`
                    w-full ${
                        isDisabled
                            ? "bg-gradient-to-br from-gray-400 to-gray-500 cursor-not-allowed"
                            : "bg-gradient-to-br from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                    } border-none text-white transition-all duration-200
                    ${className}
                `}
            >
                <div className="flex items-center gap-2 justify-center">
                    {getButtonIcon()}
                    {getButtonText()}
                </div>
            </button>
            {getStatusInfo()}
        </div>
    );
}

export default WithdrawalButton;
