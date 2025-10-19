"use client";

import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useCreateBuckyBank } from "@/mutations/create_bucky_bank";
import { useGetBuckyBanksByParent } from "@/hooks/dbhooks/useGetBuckyBank";
import { useGetParentPendingRequests } from "@/hooks/dbhooks/useGetParentPendingRequests";
import WithdrawalApprovalPanel from "@/components/WithdrawalApprovalPanel";
import type { BuckyBankInfo, BuckyBankCreatedEvent } from "@/types";

interface PiggyBank {
    id: string;
    name: string;
    targetAmount: number;
    durationDays: number;
    parentAddress: string;
    childAddress: string;
    createdAt: number;
    deadline: number;
    currentAmount: number;
    status: "active" | "completed" | "expired";
}

interface CreatePiggyBankForm {
    name: string;
    targetAmount: string;
    durationDays: string;
    childAddress: string;
}

// 数据转换函数：将后端数据转换为前端显示格式
const transformBuckyBankData = (buckyBanks: BuckyBankCreatedEvent[]): PiggyBank[] => {
    return buckyBanks.map((bank) => ({
        id: bank.bucky_bank_id,
        name: bank.name,
        // targetAmount: bank.target_amount / 1_000_000_000, // 从MIST转换为SUI
        targetAmount: bank.target_amount / 1_000_000, // USDC
        durationDays: bank.duration_days,
        parentAddress: bank.parent_address,
        childAddress: bank.child_address,
        createdAt: bank.created_at_ms,
        deadline: bank.deadline_ms,
        // currentAmount: bank.current_balance / 1_000_000_000, // 从MIST转换为SUI
        currentAmount: bank.current_balance / 1_000_000, // USDC
        status: bank.current_balance >= bank.target_amount ? "completed" :
                (Date.now() > bank.created_at_ms + bank.duration_days * 24 * 60 * 60 * 1000) ? "expired" : "active"
    }));
};

export default function ParentDashboard() {
    const [formData, setFormData] = useState<CreatePiggyBankForm>({
        name: "",
        targetAmount: "",
        durationDays: "",
        childAddress: "",
    });

    const currentAccount = useCurrentAccount();
    const createBuckyBankMutation = useCreateBuckyBank();
    
    // 使用 hook 获取存钱罐数据
    const { 
        data: buckyBanksResponse, 
        isLoading, 
        error, 
        refetch 
    } = useGetBuckyBanksByParent(
        currentAccount?.address || "",
        {
            enabled: !!currentAccount?.address,
            refetchInterval: 5000, // 30秒自动刷新
        }
    );

    // 转换数据格式
    const piggyBanks = buckyBanksResponse?.data ? transformBuckyBankData(buckyBanksResponse.data) : [];

    // 获取所有存钱罐的ID用于查询待审批请求
    const buckyBankIds = piggyBanks.map(bank => bank.id);
    
    // 获取待审批的提取请求
    const { 
        data: pendingRequests = [], 
        isLoading: isPendingRequestsLoading,
        refetch: refetchPendingRequests 
    } = useGetParentPendingRequests(
        currentAccount?.address || "",
        buckyBankIds,
        {
            enabled: !!currentAccount?.address && buckyBankIds.length > 0,
            refetchInterval: 5000, // 30秒自动刷新
        }
    );

    console.log("AAA:", JSON.stringify(buckyBanksResponse?.data, null, 2));
    console.log("BBB:", JSON.stringify(piggyBanks, null, 2));
    console.log("Pending Requests:", JSON.stringify(pendingRequests, null, 2));

    const handleInputChange = (
        field: keyof CreatePiggyBankForm,
        value: string
    ) => {
        setFormData((prev) => ({
            ...prev,
            [field]: value,
        }));
    };

    const validateForm = (): boolean => {
        if (!currentAccount || !currentAccount.address) {
            toast.error("请先连接家长钱包");
            return false;
        }

        if (!formData.name.trim()) {
            toast.error("请输入存钱罐名称");
            return false;
        }

        if (!formData.targetAmount || parseFloat(formData.targetAmount) <= 0) {
            toast.error("请输入有效的目标金额");
            return false;
        }

        if (!formData.durationDays || parseInt(formData.durationDays) <= 0) {
            toast.error("请输入有效的存款期限");
            return false;
        }

        if (!formData.childAddress.trim()) {
            toast.error("请输入孩子钱包地址");
            return false;
        }

        // 简单的地址格式验证
        if (
            !formData.childAddress.startsWith("0x") ||
            formData.childAddress.length < 10
        ) {
            toast.error("请输入有效的钱包地址格式");
            return false;
        }

        return true;
    };

    // 用于存储定时器引用
    const refetchTimerRef = useRef<NodeJS.Timeout | null>(null);

    // 定时重新获取数据的函数
    const startPeriodicRefetch = (maxAttempts = 10, interval = 2000) => {
        let attempts = 0;
        const originalCount = piggyBanks.length;

        const attemptRefetch = async () => {
            attempts++;
            console.log(`尝试获取最新数据 (${attempts}/${maxAttempts})`);
            
            try {
                const result = await refetch();
                const newCount = result.data?.data ? transformBuckyBankData(result.data.data).length : 0;
                
                // 如果数据已更新（数量增加）或达到最大尝试次数，停止定时器
                if (newCount > originalCount || attempts >= maxAttempts) {
                    if (refetchTimerRef.current) {
                        clearInterval(refetchTimerRef.current);
                        refetchTimerRef.current = null;
                    }
                    
                    if (newCount > originalCount) {
                        console.log("✅ 成功获取到最新数据");
                        toast.success("数据已更新！");
                    } else if (attempts >= maxAttempts) {
                        console.log("⏰ 达到最大重试次数，停止尝试");
                        toast.info("如果数据未及时更新，请稍后手动刷新页面");
                    }
                }
            } catch (error) {
                console.error("定时获取数据失败:", error);
            }
        };

        // 清除之前的定时器（如果存在）
        if (refetchTimerRef.current) {
            clearInterval(refetchTimerRef.current);
        }

        // 设置新的定时器
        refetchTimerRef.current = setInterval(attemptRefetch, interval);
        
        // 立即执行一次
        attemptRefetch();
    };

    const handleCreatePiggyBank = async () => {
        if (!validateForm()) return;

        const address = currentAccount?.address;

        try {
            // 构造BuckyBankInfo数据
            const buckyBankInfo: BuckyBankInfo = {
                name: formData.name.trim(),
                // target_amount: Math.floor(parseFloat(formData.targetAmount) * 1_000_000_000), // 转换为MIST单位
                target_amount: Math.floor(parseFloat(formData.targetAmount) * 1_000_000), // USDC
                duration_days: parseInt(formData.durationDays),
                child_address: formData.childAddress.trim(),
            };

            try {
                // 调用mutation创建存钱罐
                await createBuckyBankMutation.mutateAsync([buckyBankInfo]);

                // 重置表单
                setFormData({
                    name: "",
                    targetAmount: "",
                    durationDays: "",
                    childAddress: "",
                });

                toast.success(
                    `存钱罐"${formData.name.trim()}"已创建成功！正在同步数据... 🐷`
                );

                // 开始定时重新获取数据，直到获取到新数据
                startPeriodicRefetch(10, 2000); // 最多尝试10次，每2秒一次
                
                // 同时刷新待审批请求
                refetchPendingRequests();

            } catch (error) {
                console.error("创建存钱罐失败:", error);
                // toast.error("创建存钱罐失败，请重试");
            }
        } catch (error) {
            console.error("创建存钱罐失败:", error);
            // toast.error("创建存钱罐失败，请重试");
        }
    };

    const getStatusBadge = (bank: PiggyBank) => {
        const progress = (bank.currentAmount / bank.targetAmount) * 100;
        const daysLeft = Math.max(
            0,
            bank.durationDays -
                Math.floor(
                    (Date.now() - bank.createdAt) / (1000 * 60 * 60 * 24)
                )
        );

        if (progress >= 100) {
            return (
                <Badge className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                    已完成
                </Badge>
            );
        } else if (daysLeft === 0) {
            return (
                <Badge className="bg-gradient-to-r from-red-500 to-red-600 text-white">
                    已过期
                </Badge>
            );
        } else {
            return (
                <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                    进行中
                </Badge>
            );
        }
    };

    const userPiggyBanks = piggyBanks;

    // 清理定时器
    React.useEffect(() => {
        return () => {
            if (refetchTimerRef.current) {
                clearInterval(refetchTimerRef.current);
            }
        };
    }, []);

    return (
        <div className="flex flex-col items-center justify-start min-h-[70vh] p-8 gap-6">
            {/* 审批组件 - 只有在有待审批请求时才显示 */}
            {pendingRequests.length > 0 && (
                <WithdrawalApprovalPanel 
                    pendingRequests={pendingRequests}
                    isLoading={isPendingRequestsLoading}
                    onRefresh={() => {
                        refetchPendingRequests();
                        refetch(); // 同时刷新存钱罐数据
                    }}
                />
            )}

            {/* 创建存钱罐卡片 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-3xl"
            >
                <Card className="bg-white/90 backdrop-blur-md border-2 border-blue-500/20 shadow-[0_20px_40px_rgba(59,130,246,0.1)]">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-slate-700 flex items-center gap-2">
                            <span className="text-2xl">🐷</span>
                            家长入口 · 创建孩子的存钱罐
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 存钱罐名称 */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="name"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    存钱罐名称 *
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="例如：小明的新玩具基金"
                                    value={formData.name}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "name",
                                            e.target.value
                                        )
                                    }
                                    className="border-2 border-blue-500/20 rounded-xl bg-white/85 focus:border-blue-500/50"
                                />
                            </div>

                            {/* 目标金额 */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="targetAmount"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    目标金额 (USDC) *
                                </Label>
                                <Input
                                    id="targetAmount"
                                    type="number"
                                    placeholder="100"
                                    min="0"
                                    step="0.01"
                                    value={formData.targetAmount}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "targetAmount",
                                            e.target.value
                                        )
                                    }
                                    className="border-2 border-blue-500/20 rounded-xl bg-white/85 focus:border-blue-500/50"
                                />
                            </div>

                            {/* 存款期限 */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="durationDays"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    存款期限 (天) *
                                </Label>
                                <Input
                                    id="durationDays"
                                    type="number"
                                    placeholder="30"
                                    min="1"
                                    value={formData.durationDays}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "durationDays",
                                            e.target.value
                                        )
                                    }
                                    className="border-2 border-blue-500/20 rounded-xl bg-white/85 focus:border-blue-500/50"
                                />
                            </div>

                            {/* 孩子钱包地址 */}
                            <div className="space-y-2">
                                <Label
                                    htmlFor="childAddress"
                                    className="text-sm font-medium text-slate-700"
                                >
                                    孩子钱包地址 *
                                </Label>
                                <Input
                                    id="childAddress"
                                    placeholder="0x1234567890abcdef..."
                                    value={formData.childAddress}
                                    onChange={(e) =>
                                        handleInputChange(
                                            "childAddress",
                                            e.target.value
                                        )
                                    }
                                    className="border-2 border-blue-500/20 rounded-xl bg-white/85 focus:border-blue-500/50"
                                />
                            </div>
                        </div>

                        <div className="mt-6 flex flex-col gap-4">
                            <Button
                                onClick={handleCreatePiggyBank}
                                disabled={createBuckyBankMutation.isPending}
                                className="w-full py-3 rounded-xl bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 border-none text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all duration-200"
                            >
                                {createBuckyBankMutation.isPending ? (
                                    <div className="flex items-center gap-2">
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                                        创建中...
                                    </div>
                                ) : (
                                    "🎯 创建存钱罐"
                                )}
                            </Button>

                            <div className="text-sm text-slate-500 bg-blue-50/50 p-3 rounded-lg">
                                💡 <strong>提示：</strong>
                                创建后，孩子使用对应地址连接钱包，即可在&ldquo;孩子入口&rdquo;页面开始存钱。存钱罐将在设定期限内有效。
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </motion.div>

            {/* 存钱罐列表卡片 */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="w-full max-w-3xl"
            >
                <Card className="bg-white/90 backdrop-blur-md border-2 border-indigo-500/20 shadow-[0_20px_40px_rgba(99,102,241,0.1)]">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold text-slate-700 flex items-center gap-2">
                            <span className="text-xl">📊</span>
                            我创建的存钱罐
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-0">
                        {!currentAccount ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-4">🔒</div>
                                <div className="text-red-500 text-lg">
                                    请先连接家长钱包
                                </div>
                                <div className="text-slate-500 text-sm mt-2">
                                    连接钱包后即可查看和管理存钱罐
                                </div>
                            </div>
                        ) : isLoading ? (
                            <div className="text-center py-8">
                                <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                                <div className="text-slate-500 text-lg">
                                    正在加载存钱罐数据...
                                </div>
                            </div>
                        ) : error ? (
                            <div className="text-center py-8">
                                <div className="text-4xl mb-4">❌</div>
                                <div className="text-red-500 text-lg mb-2">
                                    加载失败
                                </div>
                                <div className="text-slate-500 text-sm mb-4">
                                    {error.message || "获取存钱罐数据时出现错误"}
                                </div>
                                <Button 
                                    onClick={() => refetch()} 
                                    variant="outline"
                                    className="text-blue-600 border-blue-600 hover:bg-blue-50"
                                >
                                    重试
                                </Button>
                            </div>
                        ) : userPiggyBanks.length ? (
                                <div className="space-y-4">
                                    {userPiggyBanks.map((bank, index) => {
                                        const progress =
                                            (bank.currentAmount /
                                                bank.targetAmount) *
                                            100;
                                        const daysLeft = Math.max(
                                            0,
                                            bank.durationDays -
                                                Math.floor(
                                                    (Date.now() -
                                                        bank.createdAt) /
                                                        (1000 * 60 * 60 * 24)
                                                )
                                        );

                                        return (
                                            <motion.div
                                                key={bank.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{
                                                    duration: 0.3,
                                                    delay: index * 0.1,
                                                }}
                                                className="p-4 rounded-xl border border-slate-200/50 bg-gradient-to-r from-white/80 to-white/60 hover:shadow-md transition-all duration-200"
                                            >
                                                <div className="flex justify-between items-start mb-3">
                                                    <div className="flex-1">
                                                        <h3 className="font-bold text-lg text-slate-800 mb-1">
                                                            {bank.name}
                                                        </h3>
                                                        <div className="text-sm text-slate-600 space-y-1">
                                                            <div>
                                                                目标金额:{" "}
                                                                <span className="font-semibold text-green-600">
                                                                    {
                                                                        bank.targetAmount
                                                                    }{" "}
                                                                    USDC
                                                                </span>
                                                            </div>
                                                            <div>
                                                                当前进度:{" "}
                                                                <span className="font-semibold">
                                                                    {
                                                                        bank.currentAmount
                                                                    }{" "}
                                                                    USDC (
                                                                    {progress.toFixed(
                                                                        1
                                                                    )}
                                                                    %)
                                                                </span>
                                                            </div>
                                                            <div>
                                                                剩余天数:{" "}
                                                                <span className="font-semibold text-blue-600">
                                                                    {daysLeft}{" "}
                                                                    天
                                                                </span>
                                                            </div>
                                                            <div>
                                                                孩子地址:{" "}
                                                                <span className="font-mono text-xs bg-slate-100 px-2 py-1 rounded">
                                                                    {
                                                                        bank.childAddress
                                                                    }
                                                                </span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex flex-col items-end gap-2">
                                                        {getStatusBadge(bank)}
                                                        <div className="text-xs text-slate-500">
                                                            {new Date(
                                                                bank.createdAt
                                                            ).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* 进度条 */}
                                                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
                                                    <motion.div
                                                        className="h-full bg-gradient-to-r from-green-400 to-green-600 rounded-full"
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: `${Math.min(
                                                                progress,
                                                                100
                                                            )}%`,
                                                        }}
                                                        transition={{
                                                            duration: 1,
                                                            delay: 0.5,
                                                        }}
                                                    />
                                                </div>
                                            </motion.div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="text-6xl mb-4">🐷</div>
                                    <div className="text-slate-400 text-lg">
                                        暂无存钱罐记录
                                    </div>
                                    <div className="text-slate-500 text-sm mt-2">
                                        创建第一个存钱罐，开始孩子的理财之旅吧！
                                    </div>
                                </div>
                            )}
                    </CardContent>
                </Card>
            </motion.div>
        </div>
    );
}
