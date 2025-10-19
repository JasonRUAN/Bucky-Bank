"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Coins,
    Sparkles,
    PiggyBank as PiggyBankIcon,
    ArrowLeft,
    RefreshCw,
} from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useGetBuckyBanksByChild } from "@/hooks/dbhooks/useGetBuckyBank";
import { useDeposit, amountToUSDC } from "@/mutations/deposit";
import { useRequestWithdrawal } from "@/mutations/request_withdrawal";
import type { BuckyBankCreatedEvent } from "@/types";
import { WithdrawalButton } from "./WithdrawalButton";
import WithdrawalConfirmationPanel from "./WithdrawalConfirmationPanel";
import {
    useGetSuiPrice,
    useRewardSuiPrice,
} from "@/hooks/buckethooks/useGetSuiPrice";
import { useGetUserBankDepositBalances } from "@/hooks/suihooks/useGetUserBankDepositBalances";
import { useGetUserRewardBalances } from "@/hooks/suihooks/useGetUserRewardBalances";
import { useGetDepositsByBuckyBankId } from "@/hooks/dbhooks/useGetDepositsByBuckyBankId";
import { useGetWithdrawByBuckyBankId } from "@/hooks/dbhooks/useGetWithdrawByBuckyBankId";
import { useGetTotalRewards } from "@/hooks/buckethooks/useGetUserSavings";
import { useClaimSavingRewards } from "@/mutations/claim_saving_rewards";
import { useHasPendingWithdrawalRequests } from "@/hooks/dbhooks/useGetWithdrawalRequests";
import { useHasApprovedWithdrawalRequests } from "@/hooks/dbhooks/useGetApprovedWithdrawalRequests";

interface PiggyBankData {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    durationDays: number;
    deadline: number;
    status: "active" | "completed" | "expired";
}

export default function ChildPiggyBank() {
    const [selectedPiggyBank, setSelectedPiggyBank] =
        useState<PiggyBankData | null>(null);
    const [depositAmount, setDepositAmount] = useState("");
    const [withdrawAmount, setWithdrawAmount] = useState("");
    const [withdrawReason, setWithdrawReason] = useState("");
    const [activeTab, setActiveTab] = useState<"deposit" | "withdraw">(
        "deposit"
    );
    const [isDepositing, setIsDepositing] = useState(false);
    const [isWithdrawing, setIsWithdrawing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [coins, setCoins] = useState<
        Array<{ id: number; x: number; y: number }>
    >([]);
    const [hearts, setHearts] = useState<
        Array<{ id: number; x: number; y: number }>
    >([]);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [lastDepositTime, setLastDepositTime] = useState<number | null>(null);

    // 用于管理定时器的 ref
    const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const fastRefreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const account = useCurrentAccount();

    // 获取当前用户作为child的存钱罐列表
    const {
        data: buckyBanksResponse,
        isLoading,
        refetch,
    } = useGetBuckyBanksByChild(account?.address || "", {
        enabled: !!account?.address,
        refetchInterval: 5000, // 30秒刷新一次
    });

    // console.log(
    //     "### buckyBanksResponse: ",
    //     JSON.stringify(buckyBanksResponse, null, 2)
    // );

    const {
        totalSuiRewards,
        formattedTotalSuiRewards,
        isLoading: isTotalLoading,
    } = useGetTotalRewards(account?.address);

    // 获取奖励的USD价格
    // const rewardPriceInfo = useRewardSuiPrice(Number(totalSuiRewards) || 0);
    const suiPriceInfo = useGetSuiPrice();

    console.log("suiPrice: ", suiPriceInfo.data);

    console.log(
        ">>>> ",
        account?.address,
        totalSuiRewards,
        formattedTotalSuiRewards
    );

    // 使用真实的存款 mutation
    const depositMutation = useDeposit();

    // 使用提取奖励 mutation
    const claimRewardsMutation = useClaimSavingRewards({
        buckyBankId: selectedPiggyBank?.id || "",
    });

    // 使用取款申请 mutation
    const requestWithdrawalMutation = useRequestWithdrawal();

    // 检查待审批的取款请求
    const {
        data: hasPendingRequests,
        pendingAmount,
        pendingRequests,
        isLoading: isPendingLoading,
    } = useHasPendingWithdrawalRequests(account?.address || "", {
        enabled: !!account?.address,
        refetchInterval: 5000, // 30秒刷新一次
    });

    // 检查已批准待确认的取款请求
    const {
        data: hasApprovedRequests,
        approvedAmount,
        approvedRequests,
        isLoading: isApprovedLoading,
    } = useHasApprovedWithdrawalRequests(account?.address || "", {
        enabled: !!account?.address,
        refetchInterval: 5000, // 30秒刷新一次
    });

    // 转换数据格式
    const piggyBanks: PiggyBankData[] =
        buckyBanksResponse?.data?.map((bank: BuckyBankCreatedEvent) => ({
            id: bank.bucky_bank_id,
            name: bank.name,
            // targetAmount: bank.target_amount / 1_000_000_000, // 从MIST转换为SUI
            // currentAmount: bank.current_balance / 1_000_000_000, // 从MIST转换为SUI
            targetAmount: bank.target_amount / 1_000_000, // USDC
            currentAmount: bank.current_balance / 1_000_000, // USDC
            durationDays: bank.duration_days,
            deadline: bank.deadline_ms,
            status:
                bank.current_balance >= bank.target_amount
                    ? "completed"
                    : Date.now() > bank.deadline_ms
                    ? "expired"
                    : "active",
        })) || [];

    // 当 piggyBanks 数据更新时，同步更新 selectedPiggyBank
    useEffect(() => {
        if (selectedPiggyBank && piggyBanks.length > 0) {
            const updatedBank = piggyBanks.find(
                (bank) => bank.id === selectedPiggyBank.id
            );
            if (
                updatedBank &&
                updatedBank.currentAmount !== selectedPiggyBank.currentAmount
            ) {
                setSelectedPiggyBank(updatedBank);
            }
        }
    }, [piggyBanks]); // 只依赖 piggyBanks，避免循环依赖

    // const globalStats = useGetGlobalStats();
    // console.log(
    //     "Global stats:",
    //     JSON.stringify(
    //         globalStats,
    //         null,
    //         2
    //     )
    // );

    const {
        data: userBankDepositBalances,
        isLoading: isLoadingUserBankDepositBalances,
        error: userBankDepositBalancesError,
    } = useGetUserBankDepositBalances();

    // 获取用户奖励余额
    const {
        data: userRewardBalances,
        isLoading: isLoadingUserRewardBalances,
        error: userRewardBalancesError,
    } = useGetUserRewardBalances();

    console.log("$$$ ", JSON.stringify(userBankDepositBalances, null, 2));

    // 获取当前选中存钱罐的存款记录
    const {
        data: depositsResponse,
        isLoading: isLoadingDeposits,
        refetch: refetchDeposits,
    } = useGetDepositsByBuckyBankId(
        selectedPiggyBank?.id || "",
        { page: 1, limit: 10 },
        {
            enabled: !!selectedPiggyBank?.id,
            refetchInterval:
                lastDepositTime && Date.now() - lastDepositTime < 60000
                    ? 5000 // 存款后1分钟内每5秒刷新一次
                    : 30000, // 正常情况下30秒刷新一次
        }
    );

    // 获取当前选中存钱罐的取款记录
    const {
        data: withdrawsResponse,
        isLoading: isLoadingWithdraws,
        refetch: refetchWithdraws,
    } = useGetWithdrawByBuckyBankId(
        selectedPiggyBank?.id || "",
        { page: 1, limit: 10 },
        {
            enabled: !!selectedPiggyBank?.id,
            refetchInterval: 5000, // 30秒刷新一次
        }
    );

    // 处理用户银行存款余额获取错误
    if (userBankDepositBalancesError) {
        console.error(
            "获取用户存钱罐存款余额失败:",
            userBankDepositBalancesError
        );
    }

    // 定时刷新逻辑
    useEffect(() => {
        if (!selectedPiggyBank?.id) return;

        // 清除之前的定时器
        if (refreshIntervalRef.current) {
            clearInterval(refreshIntervalRef.current);
        }
        if (fastRefreshIntervalRef.current) {
            clearInterval(fastRefreshIntervalRef.current);
        }

        // 如果最近有存款操作，启动快速刷新
        if (lastDepositTime && Date.now() - lastDepositTime < 60000) {
            fastRefreshIntervalRef.current = setInterval(() => {
                refetchDeposits();
                refetchWithdraws();
                refetch();
            }, 5000); // 每5秒刷新一次

            // 1分钟后切换到正常刷新频率
            setTimeout(() => {
                if (fastRefreshIntervalRef.current) {
                    clearInterval(fastRefreshIntervalRef.current);
                    fastRefreshIntervalRef.current = null;
                }
                // 启动正常刷新
                refreshIntervalRef.current = setInterval(() => {
                    refetchDeposits();
                    refetchWithdraws();
                    refetch();
                }, 30000); // 每30秒刷新一次
            }, 60000);
        } else {
            // 正常刷新频率
            refreshIntervalRef.current = setInterval(() => {
                refetchDeposits();
                refetchWithdraws();
                refetch();
            }, 30000); // 每30秒刷新一次
        }

        return () => {
            if (refreshIntervalRef.current) {
                clearInterval(refreshIntervalRef.current);
            }
            if (fastRefreshIntervalRef.current) {
                clearInterval(fastRefreshIntervalRef.current);
            }
        };
    }, [
        selectedPiggyBank?.id,
        lastDepositTime,
        refetchDeposits,
        refetchWithdraws,
        refetch,
    ]);

    // 手动刷新函数
    const handleManualRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                refetchDeposits(),
                refetchWithdraws(),
                refetch(),
            ]);
        } catch (error) {
            console.error("刷新失败:", error);
        } finally {
            setIsRefreshing(false);
        }
    }, [refetchDeposits, refetchWithdraws, refetch]);

    // 计算利息奖励 - 按存款占比分配 + 已领取奖励
    const calculateInterestReward = useCallback(
        (bankId: string): number => {
            if (
                !totalSuiRewards ||
                !userBankDepositBalances ||
                userBankDepositBalances.length === 0
            )
                return 0;

            // 找到当前存钱罐的存款信息
            const currentBank = userBankDepositBalances.find(
                (balance) => balance.bankId === bankId
            );
            if (!currentBank || currentBank.depositAmount === 0) return 0;

            // 计算用户所有存钱罐的总存款金额
            const totalUserDeposits = userBankDepositBalances.reduce(
                (sum, balance) => {
                    return sum + balance.depositAmount;
                },
                0
            );

            // 如果总存款为0，返回0
            if (totalUserDeposits === 0) return 0;

            // 计算当前存钱罐的存款占比
            const depositRatio = currentBank.depositAmount / totalUserDeposits;

            // 根据占比分配奖励
            const proportionalReward =
                (Number(totalSuiRewards) * depositRatio) / 1e9;

            // 获取该存钱罐已经领取的奖励
            let claimedReward = 0;
            if (userRewardBalances && userRewardBalances.length > 0) {
                const bankReward = userRewardBalances.find(
                    (reward) => reward.bankId === bankId
                );
                if (bankReward) {
                    claimedReward = bankReward.rewardAmount / 1e9; // 转换为 SUI 单位
                }
            }

            // 返回按比例分配的奖励 + 已领取的奖励
            return proportionalReward + claimedReward;
        },
        [totalSuiRewards, userBankDepositBalances, userRewardBalances]
    );

    // 缓存当前选中存钱罐的利息奖励计算结果
    const currentInterestReward = useMemo(() => {
        if (!selectedPiggyBank) return 0;
        return calculateInterestReward(selectedPiggyBank.id);
    }, [selectedPiggyBank, calculateInterestReward]);

    // 检查是否可以提取奖励（需要至少 0.01 SUI）
    const canClaimRewards = useMemo(() => {
        return currentInterestReward >= 0.01;
    }, [currentInterestReward]);

    // 处理存钱罐选择
    const handlePiggyBankSelect = (piggyBankId: string) => {
        const selected = piggyBanks.find((bank) => bank.id === piggyBankId);
        if (selected) {
            setSelectedPiggyBank(selected);
        }
    };

    // 返回存钱罐列表
    const handleBackToList = () => {
        setSelectedPiggyBank(null);
        setDepositAmount("");
    };

    // 处理提取奖励
    const handleClaimRewards = async () => {
        if (!selectedPiggyBank || currentInterestReward <= 0) return;

        try {
            await claimRewardsMutation.mutateAsync();
            // 提取成功后可以刷新数据
            refetch();
        } catch (error) {
            console.error("提取奖励失败:", error);
            alert("提取奖励失败，请重试");
        }
    };

    // 真实的存款函数
    const handleDeposit = async () => {
        if (
            !selectedPiggyBank ||
            !depositAmount ||
            parseFloat(depositAmount) <= 0
        )
            return;

        const amount = parseFloat(depositAmount);
        setIsDepositing(true);

        try {
            const amountInUSDC = amountToUSDC(depositAmount);

            // 调用真实的存款 mutation
            await depositMutation.mutateAsync({
                buckyBankId: selectedPiggyBank.id,
                amount: parseInt(amountInUSDC),
            });

            // 存款成功后更新本地状态
            setSelectedPiggyBank((prev) =>
                prev
                    ? {
                          ...prev,
                          currentAmount: prev.currentAmount + amount,
                      }
                    : null
            );

            setDepositAmount("");
            setShowSuccess(true);

            // 设置最后存款时间，触发快速刷新
            setLastDepositTime(Date.now());

            // 立即刷新数据
            refetch();
            refetchDeposits();
            refetchWithdraws();

            // Add coin animation
            const newCoins = Array.from(
                { length: Math.min(Math.floor(amount / 10), 8) },
                (_, i) => ({
                    id: Date.now() + i,
                    x: Math.random() * 300 + 100,
                    y: Math.random() * 100 + 200,
                })
            );
            setCoins(newCoins);

            // Add heart animation
            const newHearts = Array.from({ length: 3 }, (_, i) => ({
                id: Date.now() + i + 1000,
                x: Math.random() * 200 + 150,
                y: Math.random() * 80 + 180,
            }));
            setHearts(newHearts);

            setTimeout(() => {
                setShowSuccess(false);
                setCoins([]);
                setHearts([]);
            }, 3000);
        } catch (error) {
            console.error("存款失败:", error);
            alert("存款失败，请重试");
        } finally {
            setIsDepositing(false);
        }
    };

    // 处理取款申请
    const handleWithdraw = async () => {
        if (
            !selectedPiggyBank ||
            !withdrawAmount ||
            parseFloat(withdrawAmount) <= 0 ||
            !withdrawReason.trim()
        )
            return;

        // 检查是否有待审批的取款请求
        if (hasPendingRequests) {
            alert(
                `您已有 ${pendingRequests} 笔取款申请正在审批中，请等待家长审核后再提交新的申请。`
            );
            return;
        }

        // 检查是否有已批准待确认的取款请求
        if (hasApprovedRequests) {
            alert(
                `您有 ${approvedRequests} 笔已批准的取款请求待确认，请先确认提取后再提交新的申请。`
            );
            return;
        }

        const amount = parseFloat(withdrawAmount);

        // 检查取款金额是否超过当前余额
        if (amount > selectedPiggyBank.currentAmount) {
            alert("取款金额不能超过当前余额");
            return;
        }

        setIsWithdrawing(true);

        try {
            const amountInUSDC = amountToUSDC(withdrawAmount);

            await requestWithdrawalMutation.mutateAsync({
                buckyBankId: selectedPiggyBank.id,
                amount: parseInt(amountInUSDC),
                reason: withdrawReason.trim(),
            });

            setWithdrawAmount("");
            setWithdrawReason("");
            setShowSuccess(true);

            // 立即刷新数据
            refetch();
            refetchDeposits();

            setTimeout(() => {
                setShowSuccess(false);
            }, 3000);
        } catch (error) {
            console.error("取款申请失败:", error);
            alert("取款申请失败，请重试");
        } finally {
            setIsWithdrawing(false);
        }
    };

    // 设置取款金额百分比
    const setWithdrawPercentage = (percentage: number) => {
        const amount =
            (selectedPiggyBank?.currentAmount || 0) * (percentage / 100);
        setWithdrawAmount(amount.toFixed(2));
    };

    // 获取状态徽章
    const getStatusBadge = (bank: PiggyBankData) => {
        if (bank.status === "completed") {
            return (
                <span className="bg-green-500 text-white px-2 py-1 rounded-full text-sm">
                    🎉 已完成
                </span>
            );
        } else if (bank.status === "expired") {
            return (
                <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm">
                    ⏰ 已过期
                </span>
            );
        } else {
            return (
                <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-sm">
                    🎯 进行中
                </span>
            );
        }
    };

    // 如果没有连接钱包
    if (!account?.address) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <Card className="w-full max-w-md bg-white/90 backdrop-blur-md border-2 border-purple-500/20">
                    <CardContent className="p-8 text-center">
                        <PiggyBankIcon className="w-16 h-16 mx-auto mb-4 text-pink-500" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            连接钱包
                        </h2>
                        <p className="text-gray-600">
                            请先连接您的钱包来查看存钱罐
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 如果正在加载
    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <Card className="w-full max-w-md bg-white/90 backdrop-blur-md border-2 border-purple-500/20">
                    <CardContent className="p-8 text-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{
                                duration: 1,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                            className="w-16 h-16 mx-auto mb-4"
                        >
                            <PiggyBankIcon className="w-full h-full text-pink-500" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            加载中...
                        </h2>
                        <p className="text-gray-600">正在获取您的存钱罐列表</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 如果没有存钱罐
    if (!piggyBanks.length) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <Card className="w-full max-w-md bg-white/90 backdrop-blur-md border-2 border-purple-500/20">
                    <CardContent className="p-8 text-center">
                        <PiggyBankIcon className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">
                            暂无存钱罐
                        </h2>
                        <p className="text-gray-600 mb-4">
                            您还没有任何存钱罐，请联系家长为您创建一个存钱罐。
                        </p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 如果没有选择存钱罐，显示存钱罐列表
    if (!selectedPiggyBank) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <Card className="w-full max-w-2xl bg-white/90 backdrop-blur-md border-2 border-purple-500/20">
                    <CardHeader>
                        <CardTitle className="text-center text-3xl font-bold bg-gradient-to-br from-pink-500 to-purple-500 bg-clip-text text-transparent">
                            🐷 选择您的存钱罐
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                        <div className="grid gap-4">
                            {piggyBanks.map((bank) => {
                                const progress =
                                    (bank.currentAmount / bank.targetAmount) *
                                    100;
                                const daysLeft = Math.max(
                                    0,
                                    Math.ceil(
                                        (bank.deadline - Date.now()) /
                                            (1000 * 60 * 60 * 24)
                                    )
                                );

                                return (
                                    <motion.div
                                        key={bank.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Card
                                            className="cursor-pointer border-2 border-purple-500/20 hover:border-purple-500/40 transition-all duration-200"
                                            onClick={() =>
                                                handlePiggyBankSelect(bank.id)
                                            }
                                        >
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-800 mb-2">
                                                            {bank.name}
                                                        </h3>
                                                        {getStatusBadge(bank)}
                                                    </div>
                                                    <PiggyBankIcon className="w-8 h-8 text-pink-500" />
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex justify-between text-sm text-gray-600">
                                                        <span>进度</span>
                                                        <span>
                                                            {progress.toFixed(
                                                                1
                                                            )}
                                                            %
                                                        </span>
                                                    </div>

                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                        <motion.div
                                                            className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full"
                                                            initial={{
                                                                width: 0,
                                                            }}
                                                            animate={{
                                                                width: `${Math.min(
                                                                    progress,
                                                                    100
                                                                )}%`,
                                                            }}
                                                            transition={{
                                                                duration: 1,
                                                                delay: 0.2,
                                                            }}
                                                        />
                                                    </div>

                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">
                                                            {bank.currentAmount.toFixed(
                                                                2
                                                            )}{" "}
                                                            /{" "}
                                                            {bank.targetAmount.toFixed(
                                                                2
                                                            )}{" "}
                                                            USDC
                                                        </span>
                                                        {bank.status ===
                                                            "active" && (
                                                            <span className="text-orange-500">
                                                                剩余 {daysLeft}{" "}
                                                                天
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    </motion.div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // 显示选中的存钱罐详情和存款界面
    return (
        <div className="flex flex-col items-center justify-center min-h-screen p-8">
            {/* 返回按钮 */}
            <div className="w-full max-w-4xl mb-6">
                <Button
                    onClick={handleBackToList}
                    variant="outline"
                    className="flex items-center gap-2 border-2 border-purple-500/30 text-purple-600 hover:bg-purple-50"
                >
                    <ArrowLeft className="w-4 h-4" />
                    返回存钱罐列表
                </Button>
            </div>

            {/* 存钱罐主体 */}
            <div className="relative text-center mb-12">
                {/* 存钱罐名称 */}
                <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-4xl font-bold bg-gradient-to-br from-pink-500 to-purple-500 bg-clip-text text-transparent mb-6"
                >
                    {selectedPiggyBank.name}
                </motion.h1>

                {/* 可爱的存钱罐图片 */}
                <motion.div
                    className="relative inline-block"
                    animate={{
                        scale:
                            selectedPiggyBank.currentAmount > 0
                                ? [1, 1.02, 1]
                                : 1,
                        rotate:
                            selectedPiggyBank.currentAmount > 0
                                ? [0, 1, -1, 0]
                                : 0,
                    }}
                    transition={{
                        duration: 3,
                        repeat:
                            selectedPiggyBank.currentAmount > 0 ? Infinity : 0,
                        repeatDelay: 2,
                    }}
                >
                    {/* 存钱罐主体 */}
                    <div className="w-[300px] h-[250px] bg-gradient-to-br from-pink-200 via-pink-300 to-pink-500 rounded-[50%_50%_45%_45%] relative mx-auto shadow-[0_20px_40px_rgba(255,105,180,0.3),inset_0_-10px_20px_rgba(255,105,180,0.2)] border-[3px] border-white/30">
                        {/* 存钱罐的腿 */}
                        <div className="absolute -bottom-5 left-[60px] w-[30px] h-[25px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-full shadow-[0_5px_10px_rgba(255,20,147,0.3)]" />
                        <div className="absolute -bottom-5 right-[60px] w-[30px] h-[25px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-full shadow-[0_5px_10px_rgba(255,20,147,0.3)]" />
                        <div className="absolute -bottom-[15px] left-[100px] w-[25px] h-[20px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-full shadow-[0_5px_10px_rgba(255,20,147,0.3)]" />
                        <div className="absolute -bottom-[15px] right-[100px] w-[25px] h-[20px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-full shadow-[0_5px_10px_rgba(255,20,147,0.3)]" />

                        {/* 猪鼻子 */}
                        <div className="absolute top-20 left-1/2 -translate-x-1/2 w-[60px] h-[40px] bg-gradient-to-br from-pink-600 to-red-700 rounded-full shadow-[inset_0_3px_6px_rgba(220,20,60,0.3)]">
                            {/* 鼻孔 */}
                            <div className="absolute top-3 left-[15px] w-2 h-3 bg-red-900 rounded-full" />
                            <div className="absolute top-3 right-[15px] w-2 h-3 bg-red-900 rounded-full" />
                        </div>

                        {/* 眼睛 */}
                        <motion.div
                            className="absolute top-[50px] left-20 w-[25px] h-[25px] bg-white rounded-full flex items-center justify-center"
                            animate={
                                selectedPiggyBank.currentAmount > 0
                                    ? {
                                          scale: [1, 0.1, 1],
                                      }
                                    : {}
                            }
                            transition={{
                                duration: 0.3,
                                repeat:
                                    selectedPiggyBank.currentAmount > 0
                                        ? Infinity
                                        : 0,
                                repeatDelay: 3,
                            }}
                        >
                            <div className="w-[15px] h-[15px] bg-black rounded-full" />
                        </motion.div>
                        <motion.div
                            className="absolute top-[50px] right-20 w-[25px] h-[25px] bg-white rounded-full flex items-center justify-center"
                            animate={
                                selectedPiggyBank.currentAmount > 0
                                    ? {
                                          scale: [1, 0.1, 1],
                                      }
                                    : {}
                            }
                            transition={{
                                duration: 0.3,
                                repeat:
                                    selectedPiggyBank.currentAmount > 0
                                        ? Infinity
                                        : 0,
                                repeatDelay: 3,
                            }}
                        >
                            <div className="w-[15px] h-[15px] bg-black rounded-full" />
                        </motion.div>

                        {/* 嘴巴 */}
                        <div className="absolute top-[140px] left-1/2 -translate-x-1/2 w-10 h-5 border-[3px] border-red-900 border-t-0 rounded-b-[40px]" />

                        {/* 耳朵 */}
                        <div className="absolute top-5 left-10 w-10 h-[50px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-[50%_50%_0_50%] -rotate-[30deg] shadow-[0_5px_10px_rgba(255,20,147,0.3)]" />
                        <div className="absolute top-5 right-10 w-10 h-[50px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-[50%_50%_50%_0] rotate-[30deg] shadow-[0_5px_10px_rgba(255,20,147,0.3)]" />

                        {/* 投币口 */}
                        <div className="absolute top-[10px] left-1/2 -translate-x-1/2 w-20 h-2 bg-red-900 rounded shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)]" />

                        {/* 尾巴 */}
                        <motion.div
                            className="absolute top-[100px] -right-[25px] w-[30px] h-[30px] bg-gradient-to-br from-pink-500 to-pink-600 rounded-full shadow-[0_5px_10px_rgba(255,20,147,0.3)]"
                            animate={{
                                rotate: [0, 10, -10, 0],
                            }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            <div className="absolute top-[5px] left-[5px] w-5 h-5 border-[3px] border-pink-600 rounded-full border-t-pink-600 border-r-transparent border-b-transparent border-l-pink-600 rotate-45" />
                        </motion.div>
                    </div>

                    {/* 特效元素 */}
                    {selectedPiggyBank.currentAmount > 0 && (
                        <>
                            <motion.div
                                className="absolute -top-5 right-5"
                                animate={{ rotate: 360 }}
                                transition={{
                                    duration: 2,
                                    repeat: Infinity,
                                    ease: "linear",
                                }}
                            >
                                <Sparkles className="w-8 h-8 text-amber-400" />
                            </motion.div>
                            <motion.div
                                className="absolute top-[50px] -left-5"
                                animate={{
                                    scale: [1, 1.2, 1],
                                    rotate: [0, 10, -10, 0],
                                }}
                                transition={{
                                    duration: 1.5,
                                    repeat: Infinity,
                                    repeatDelay: 2,
                                }}
                            >
                                <span className="text-3xl">✨</span>
                            </motion.div>
                            <motion.div
                                className="absolute bottom-5 -right-[10px]"
                                animate={{
                                    y: [0, -10, 0],
                                    opacity: [0.7, 1, 0.7],
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            >
                                <span className="text-2xl">💫</span>
                            </motion.div>
                        </>
                    )}
                </motion.div>

                {/* 飞舞的硬币动画 */}
                <AnimatePresence>
                    {coins.map((coin) => (
                        <motion.div
                            key={coin.id}
                            className="absolute text-3xl pointer-events-none z-10"
                            style={{
                                left: coin.x,
                                top: coin.y,
                            }}
                            initial={{
                                opacity: 1,
                                scale: 0,
                                y: 0,
                            }}
                            animate={{
                                y: -150,
                                opacity: 0,
                                scale: 1,
                                rotate: 360,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2, ease: "easeOut" }}
                        >
                            🪙
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* 飞舞的爱心动画 */}
                <AnimatePresence>
                    {hearts.map((heart) => (
                        <motion.div
                            key={heart.id}
                            className="absolute text-2xl pointer-events-none z-10"
                            style={{
                                left: heart.x,
                                top: heart.y,
                            }}
                            initial={{
                                opacity: 1,
                                scale: 0,
                                y: 0,
                            }}
                            animate={{
                                y: -120,
                                opacity: 0,
                                scale: 1.5,
                                x: heart.x + (Math.random() - 0.5) * 50,
                            }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 2.5, ease: "easeOut" }}
                        >
                            💖
                        </motion.div>
                    ))}
                </AnimatePresence>

                {/* 存储金额显示 */}
                <motion.div
                    className="mt-8"
                    animate={
                        selectedPiggyBank.currentAmount > 0
                            ? {
                                  scale: [1, 1.05, 1],
                              }
                            : {}
                    }
                    transition={{
                        duration: 2,
                        repeat:
                            selectedPiggyBank.currentAmount > 0 ? Infinity : 0,
                        repeatDelay: 1,
                    }}
                >
                    <p
                        className={`text-5xl font-bold bg-gradient-to-br from-pink-500 to-purple-500 bg-clip-text text-transparent mb-2 ${
                            selectedPiggyBank.currentAmount > 0
                                ? "drop-shadow-[0_0_20px_rgba(236,72,153,0.3)]"
                                : ""
                        }`}
                    >
                        {selectedPiggyBank.currentAmount.toFixed(2)} USDC
                    </p>
                    <p className="text-xl text-gray-500 mb-2">当前余额</p>
                    <p className="text-lg text-gray-400 mb-2">
                        目标: {selectedPiggyBank.targetAmount.toFixed(2)} USDC
                    </p>
                    <p className="text-lg text-gray-400 mb-4">
                        存款期限: {selectedPiggyBank.durationDays} 天
                        {selectedPiggyBank.status === "active" && (
                            <span className="text-orange-500 ml-2">
                                (剩余{" "}
                                {Math.max(
                                    0,
                                    Math.ceil(
                                        (selectedPiggyBank.deadline -
                                            Date.now()) /
                                            (1000 * 60 * 60 * 24)
                                    )
                                )}{" "}
                                天)
                            </span>
                        )}
                    </p>

                    {/* 进度条 */}
                    <div className="w-80 mx-auto mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>进度</span>
                            <span>
                                {(
                                    (selectedPiggyBank.currentAmount /
                                        selectedPiggyBank.targetAmount) *
                                    100
                                ).toFixed(1)}
                                %
                            </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <motion.div
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-4 rounded-full"
                                initial={{ width: 0 }}
                                animate={{
                                    width: `${Math.min(
                                        (selectedPiggyBank.currentAmount /
                                            selectedPiggyBank.targetAmount) *
                                            100,
                                        100
                                    )}%`,
                                }}
                                transition={{ duration: 1, delay: 0.2 }}
                            />
                        </div>
                    </div>

                    {/* 状态徽章或目标达成提示 - 二选一显示 */}
                    <div className="mb-4">
                        {selectedPiggyBank.currentAmount >=
                        selectedPiggyBank.targetAmount ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                            >
                                <span className="bg-gradient-to-br from-amber-400 to-amber-500 text-white px-4 py-2 rounded-full text-base font-semibold shadow-[0_4px_15px_rgba(251,191,36,0.3)]">
                                    🏆 目标达成！
                                </span>
                            </motion.div>
                        ) : (
                            getStatusBadge(selectedPiggyBank)
                        )}
                    </div>
                </motion.div>
            </div>

            {/* 存款/取款操作区域 */}
            {account?.address && (
                <Card className="w-full max-w-4xl bg-white/90 backdrop-blur-md border-2 border-purple-500/20 shadow-[0_20px_40px_rgba(168,85,247,0.1)]">
                    {/* Tab 切换 */}
                    <div className="flex bg-gray-100 rounded-t-xl">
                        <button
                            onClick={() => setActiveTab("deposit")}
                            className={`flex-1 py-4 px-6 font-semibold rounded-tl-xl transition-all duration-200 ${
                                activeTab === "deposit"
                                    ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white shadow-lg"
                                    : "text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            💰 存款
                        </button>
                        <button
                            onClick={() => setActiveTab("withdraw")}
                            className={`flex-1 py-4 px-6 font-semibold rounded-tr-xl transition-all duration-200 ${
                                activeTab === "withdraw"
                                    ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white shadow-lg"
                                    : "text-gray-600 hover:bg-gray-200"
                            }`}
                        >
                            💸 取款
                        </button>
                    </div>

                    <CardContent className="p-8">
                        {activeTab === "deposit" ? (
                            /* 存款页面 */
                            <div className="flex flex-col gap-6">
                                <div className="flex gap-3">
                                    <Input
                                        type="number"
                                        placeholder="输入存款金额"
                                        value={depositAmount}
                                        onChange={(e) =>
                                            setDepositAmount(e.target.value)
                                        }
                                        disabled={isDepositing}
                                        className="flex-1 border-2 border-purple-500/20 rounded-xl p-4 text-lg bg-white/80"
                                    />
                                    <motion.div
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                    >
                                        <Button
                                            onClick={handleDeposit}
                                            disabled={
                                                isDepositing ||
                                                depositMutation.isPending ||
                                                !depositAmount ||
                                                parseFloat(depositAmount) <= 0
                                            }
                                            className={`px-8 py-4 ${
                                                isDepositing ||
                                                depositMutation.isPending
                                                    ? "bg-gradient-to-br from-gray-400 to-gray-500"
                                                    : "bg-gradient-to-br from-pink-500 to-purple-500"
                                            } border-none text-lg font-semibold rounded-xl shadow-[0_4px_15px_rgba(236,72,153,0.3)]`}
                                        >
                                            {isDepositing ||
                                            depositMutation.isPending ? (
                                                <motion.div
                                                    animate={{ rotate: 360 }}
                                                    transition={{
                                                        duration: 1,
                                                        repeat: Infinity,
                                                        ease: "linear",
                                                    }}
                                                    className="flex items-center gap-2"
                                                >
                                                    <Coins className="w-5 h-5" />
                                                    存入中...
                                                </motion.div>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <Coins className="w-5 h-5" />
                                                    存入
                                                </div>
                                            )}
                                        </Button>
                                    </motion.div>
                                </div>

                                {/* 快捷金额按钮 */}
                                <div className="flex gap-3">
                                    {[1, 5, 10].map((amount) => (
                                        <motion.div
                                            key={amount}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="flex-1"
                                        >
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setDepositAmount(
                                                        amount.toString()
                                                    )
                                                }
                                                disabled={
                                                    isDepositing ||
                                                    depositMutation.isPending
                                                }
                                                className="w-full border-2 border-purple-500/30 text-purple-500 font-semibold py-3 rounded-xl bg-white/80"
                                            >
                                                💰 {amount} USDC
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            /* 取款页面 */
                            <div className="flex flex-col gap-6">
                                {/* 取款金额输入 */}
                                <div className="flex gap-3">
                                    <Input
                                        type="number"
                                        placeholder="输入取款金额"
                                        value={withdrawAmount}
                                        onChange={(e) =>
                                            setWithdrawAmount(e.target.value)
                                        }
                                        disabled={isWithdrawing}
                                        className="flex-1 border-2 border-purple-500/20 rounded-xl p-4 text-lg bg-white/80"
                                    />
                                    <div className="flex items-center text-sm text-gray-500 px-3">
                                        USDC
                                    </div>
                                </div>

                                {/* 百分比选择按钮 */}
                                <div className="flex gap-3">
                                    {[
                                        { label: "25%", value: 25 },
                                        { label: "50%", value: 50 },
                                        { label: "75%", value: 75 },
                                        { label: "Max", value: 100 },
                                    ].map((option) => (
                                        <motion.div
                                            key={option.label}
                                            whileHover={{ scale: 1.05 }}
                                            whileTap={{ scale: 0.95 }}
                                            className="flex-1"
                                        >
                                            <Button
                                                variant="outline"
                                                onClick={() =>
                                                    setWithdrawPercentage(
                                                        option.value
                                                    )
                                                }
                                                disabled={
                                                    isWithdrawing ||
                                                    !selectedPiggyBank ||
                                                    selectedPiggyBank.currentAmount <=
                                                        0
                                                }
                                                className="w-full border-2 border-orange-500/30 text-orange-500 font-semibold py-3 rounded-xl bg-white/80 hover:bg-orange-50"
                                            >
                                                {option.label}
                                            </Button>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* 当前余额显示 */}
                                <div className="text-center text-sm text-gray-500">
                                    当前余额:{" "}
                                    {selectedPiggyBank?.currentAmount.toFixed(
                                        2
                                    ) || "0.00"}{" "}
                                    USDC
                                </div>

                                {/* 取款理由输入 */}
                                <div>
                                    <Textarea
                                        placeholder="请输入取款理由（例如：购买学习用品、生日礼物等）"
                                        value={withdrawReason}
                                        onChange={(e) =>
                                            setWithdrawReason(e.target.value)
                                        }
                                        disabled={isWithdrawing}
                                        className="w-full border-2 border-purple-500/20 rounded-xl p-4 text-base bg-white/80 min-h-[80px] resize-none"
                                        maxLength={200}
                                    />
                                    <div className="text-xs text-gray-400 mt-1 text-right">
                                        {withdrawReason.length}/200
                                    </div>
                                </div>

                                {/* 取款申请按钮 - 使用智能取款按钮组件 */}
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <WithdrawalButton
                                        requesterAddress={
                                            account?.address || ""
                                        }
                                        onWithdraw={handleWithdraw}
                                        disabled={
                                            isWithdrawing ||
                                            requestWithdrawalMutation.isPending ||
                                            !withdrawAmount ||
                                            parseFloat(withdrawAmount) <= 0 ||
                                            !withdrawReason.trim() ||
                                            !selectedPiggyBank ||
                                            parseFloat(withdrawAmount) >
                                                selectedPiggyBank.currentAmount ||
                                            hasPendingRequests ||
                                            hasApprovedRequests ||
                                            isPendingLoading ||
                                            isApprovedLoading
                                        }
                                        className="px-8 py-4 text-lg font-semibold rounded-xl shadow-[0_4px_15px_rgba(251,146,60,0.3)]"
                                    />
                                </motion.div>

                                {/* 状态提示信息 */}
                                {(hasPendingRequests ||
                                    hasApprovedRequests) && (
                                    <div className="mb-4 p-4 rounded-xl border-2 border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
                                        {hasPendingRequests && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="inline-block w-2 h-2 bg-orange-400 rounded-full animate-pulse"></span>
                                                <span className="text-orange-700 font-medium">
                                                    您有 {pendingRequests}{" "}
                                                    笔取款申请正在审批中
                                                </span>
                                            </div>
                                        )}
                                        {hasApprovedRequests && (
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                                <span className="text-green-700 font-medium">
                                                    您有 {approvedRequests}{" "}
                                                    笔已批准的取款请求待确认
                                                </span>
                                            </div>
                                        )}
                                        <div className="text-sm text-gray-600 mt-2">
                                            💡
                                            请等待当前申请处理完成后再提交新的取款申请
                                        </div>
                                    </div>
                                )}

                                {/* 取款提示 */}
                                {!hasPendingRequests &&
                                    !hasApprovedRequests && (
                                        <div className="text-xs text-gray-400 text-center">
                                            💡
                                            取款申请需要家长审核通过后才能到账
                                        </div>
                                    )}

                                {/* 融合的取款确认面板 - 显示已批准的取款请求 */}
                                <div className="mt-6 pt-6 border-t border-gray-200">
                                    <div className="mb-3">
                                        <h4 className="text-lg font-semibold text-gray-700 mb-2">
                                            📋 待确认取款
                                        </h4>
                                        <p className="text-sm text-gray-500">
                                            已批准的取款申请将在这里显示
                                        </p>
                                    </div>
                                    <WithdrawalConfirmationPanel
                                        requesterAddress={
                                            account?.address || ""
                                        }
                                        buckyBankId={
                                            selectedPiggyBank?.id || ""
                                        }
                                        onWithdrawSuccess={(withdrawAmount) => {
                                            // 立即更新 selectedPiggyBank 状态
                                            setSelectedPiggyBank((prev) =>
                                                prev
                                                    ? {
                                                          ...prev,
                                                          currentAmount:
                                                              prev.currentAmount -
                                                              withdrawAmount,
                                                      }
                                                    : null
                                            );

                                            // 成功取款后刷新所有相关数据
                                            refetch();
                                            refetchDeposits();
                                            refetchWithdraws();
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* 成功提示 */}
            <AnimatePresence>
                {showSuccess && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.8 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -20, scale: 0.8 }}
                        className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center p-8 bg-gradient-to-br from-green-500/95 to-emerald-500/95 rounded-3xl border-2 border-green-500/30 text-white z-[100] backdrop-blur-md shadow-[0_20px_40px_rgba(34,197,94,0.3)]"
                    >
                        <motion.div
                            animate={{
                                scale: [1, 1.2, 1],
                                rotate: [0, 10, -10, 0],
                            }}
                            transition={{ duration: 0.6, repeat: 2 }}
                            className="text-5xl mb-4"
                        >
                            🎉
                        </motion.div>
                        <div className="text-2xl font-semibold mb-2">
                            {activeTab === "deposit"
                                ? "存款成功！"
                                : "申请取款成功！"}
                        </div>
                        <p className="text-lg opacity-90">
                            {activeTab === "deposit"
                                ? "你的小猪更开心了！ 🐷💕"
                                : "申请已提交，等待家长审核！ 📋✨"}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* 统计信息 */}
            {selectedPiggyBank.currentAmount > 0 && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12 w-full max-w-4xl"
                >
                    <Card className="bg-white/90 backdrop-blur-md border-2 border-purple-600/10 shadow-[0_20px_40px_rgba(147,51,234,0.1)]">
                        <CardContent className="p-8">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl border border-blue-500/20 flex flex-col items-center justify-center text-center space-y-2"
                                >
                                    <div className="text-4xl font-bold text-blue-500">
                                        💎{" "}
                                        {selectedPiggyBank.currentAmount.toFixed(
                                            2
                                        )}
                                    </div>
                                    <div className="text-base text-gray-500">
                                        当前存款 USDC
                                    </div>
                                </motion.div>
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-2xl border border-emerald-500/20 flex flex-col items-center justify-center text-center space-y-2"
                                >
                                    <div className="text-4xl font-bold text-emerald-500 mb-2">
                                        {isTotalLoading ? (
                                            <motion.div
                                                animate={{ rotate: 360 }}
                                                transition={{
                                                    duration: 1,
                                                    repeat: Infinity,
                                                    ease: "linear",
                                                }}
                                                className="inline-block"
                                            >
                                                🔄
                                            </motion.div>
                                        ) : (
                                            `🎁 ${currentInterestReward.toFixed(
                                                4
                                            )}`
                                        )}
                                    </div>
                                    <div className="text-lg font-semibold text-emerald-600 mb-1">
                                        {suiPriceInfo.error
                                            ? "获取价格中..."
                                            : suiPriceInfo.data
                                            ? `~$${(
                                                  currentInterestReward *
                                                  suiPriceInfo.data
                                              ).toFixed(4)}`
                                            : "加载中..."}
                                    </div>
                                    <div className="text-base text-gray-500 mb-3">
                                        利息奖励 SUI
                                    </div>

                                    {/* 提取奖励按钮 */}
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <motion.div
                                                whileHover={
                                                    canClaimRewards
                                                        ? { scale: 1.05 }
                                                        : {}
                                                }
                                                whileTap={
                                                    canClaimRewards
                                                        ? { scale: 0.95 }
                                                        : {}
                                                }
                                            >
                                                <Button
                                                    onClick={handleClaimRewards}
                                                    disabled={
                                                        claimRewardsMutation.isPending ||
                                                        currentInterestReward <=
                                                            0 ||
                                                        isTotalLoading ||
                                                        !canClaimRewards
                                                    }
                                                    className={`px-4 py-2 text-sm font-semibold rounded-lg ${
                                                        claimRewardsMutation.isPending ||
                                                        currentInterestReward <=
                                                            0 ||
                                                        !canClaimRewards
                                                            ? "bg-gradient-to-br from-gray-400 to-gray-500 cursor-not-allowed"
                                                            : "bg-gradient-to-br from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700"
                                                    } border-none text-white shadow-[0_2px_8px_rgba(16,185,129,0.3)]`}
                                                >
                                                    {claimRewardsMutation.isPending ? (
                                                        <motion.div
                                                            animate={{
                                                                rotate: 360,
                                                            }}
                                                            transition={{
                                                                duration: 1,
                                                                repeat: Infinity,
                                                                ease: "linear",
                                                            }}
                                                            className="flex items-center gap-1"
                                                        >
                                                            <span className="text-xs">
                                                                🔄
                                                            </span>
                                                            提取中...
                                                        </motion.div>
                                                    ) : (
                                                        <div className="flex items-center gap-1">
                                                            <span className="text-xs">
                                                                💰
                                                            </span>
                                                            提取奖励
                                                        </div>
                                                    )}
                                                </Button>
                                            </motion.div>
                                        </TooltipTrigger>
                                        {!canClaimRewards &&
                                            currentInterestReward > 0 && (
                                                <TooltipContent>
                                                    <p>
                                                        需要至少 0.01 SUI
                                                        才能提取奖励
                                                    </p>
                                                </TooltipContent>
                                            )}
                                    </Tooltip>
                                </motion.div>
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-2xl border border-purple-500/20 flex flex-col items-center justify-center text-center space-y-2"
                                >
                                    <div className="text-4xl font-bold text-purple-500">
                                        🎯{" "}
                                        {selectedPiggyBank.targetAmount.toFixed(
                                            2
                                        )}
                                    </div>
                                    <div className="text-base text-gray-500">
                                        目标金额 USDC
                                    </div>
                                </motion.div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}

            {/* 交易记录列表 - 根据当前选中的 tab 显示对应记录 */}
            {selectedPiggyBank && (
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-8 w-full max-w-4xl"
                >
                    <Card className={`bg-white/90 backdrop-blur-md border-2 shadow-[0_20px_40px_rgba(147,51,234,0.1)] ${
                        activeTab === "deposit" 
                            ? "border-purple-600/10" 
                            : "border-orange-600/10"
                    }`}>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle className={`text-2xl font-bold bg-clip-text text-transparent flex items-center gap-2 ${
                                        activeTab === "deposit"
                                            ? "bg-gradient-to-br from-pink-500 to-purple-500"
                                            : "bg-gradient-to-br from-orange-500 to-red-500"
                                    }`}>
                                        {activeTab === "deposit" ? "📋 存款记录" : "💸 取款记录"}
                                    </CardTitle>
                                    <p className="text-sm text-gray-500 mt-2">
                                        💡 最近 5 条{activeTab === "deposit" ? "存款" : "取款"}记录
                                        {activeTab === "deposit" && lastDepositTime &&
                                            Date.now() - lastDepositTime <
                                                60000 && (
                                                <span className="ml-2 text-green-500 font-medium">
                                                    (刷新中...)
                                                </span>
                                            )}
                                    </p>
                                </div>
                                {activeTab === "deposit" && (
                                    <Tooltip>
                                        <TooltipTrigger asChild>
                                            <motion.div
                                                whileHover={{ scale: 1.05 }}
                                                whileTap={{ scale: 0.95 }}
                                            >
                                                <Button
                                                    onClick={handleManualRefresh}
                                                    disabled={
                                                        isRefreshing ||
                                                        isLoadingDeposits
                                                    }
                                                    variant="outline"
                                                    size="sm"
                                                    className="border-2 border-purple-500/30 text-purple-600 hover:bg-purple-50"
                                                >
                                                    <motion.div
                                                        animate={
                                                            isRefreshing
                                                                ? { rotate: 360 }
                                                                : {}
                                                        }
                                                        transition={
                                                            isRefreshing
                                                                ? {
                                                                      duration: 1,
                                                                      repeat: Infinity,
                                                                      ease: "linear",
                                                                  }
                                                                : {}
                                                        }
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                    </motion.div>
                                                </Button>
                                            </motion.div>
                                        </TooltipTrigger>
                                        <TooltipContent>
                                            <p>手动刷新存款记录</p>
                                        </TooltipContent>
                                    </Tooltip>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent className="p-6">
                            {activeTab === "deposit" ? (
                                /* 存款记录内容 */
                                isLoadingDeposits ? (
                                    <div className="flex items-center justify-center py-8">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "linear",
                                            }}
                                            className="w-8 h-8 text-purple-500"
                                        >
                                            <Coins className="w-full h-full" />
                                        </motion.div>
                                        <span className="ml-3 text-gray-600">
                                            {isRefreshing
                                                ? "刷新存款记录中..."
                                                : "加载存款记录中..."}
                                        </span>
                                    </div>
                                ) : depositsResponse?.data &&
                                  depositsResponse.data.length > 0 ? (
                                    <div className="space-y-3">
                                        {depositsResponse.data
                                            .slice(0, 5)
                                            .map((deposit, index) => (
                                                <motion.div
                                                    key={deposit.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{
                                                        delay: index * 0.1,
                                                    }}
                                                    className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200/50 hover:shadow-md transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-gradient-to-br from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                                                            <Coins className="w-6 h-6 text-white" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-800">
                                                                +
                                                                {(
                                                                    deposit.amount /
                                                                    1_000_000
                                                                ).toFixed(2)}{" "}
                                                                USDC
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {new Date(
                                                                    deposit.created_at_ms
                                                                ).toLocaleString(
                                                                    "zh-CN",
                                                                    {
                                                                        year: "numeric",
                                                                        month: "2-digit",
                                                                        day: "2-digit",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    }
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-gray-500">
                                                            存款人
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-mono">
                                                            {deposit.depositor.slice(
                                                                0,
                                                                6
                                                            )}
                                                            ...
                                                            {deposit.depositor.slice(
                                                                -4
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}

                                        {/* 显示总记录数 */}
                                        {depositsResponse.total > 5 && (
                                            <div className="text-center py-4 mt-4 border-t border-purple-200/50">
                                                <span className="text-sm text-gray-500">
                                                    显示最近 5 条记录，共{" "}
                                                    {depositsResponse.total} 条
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                            <Coins className="w-8 h-8 text-gray-400" />
                                        </div>
                                        <p className="text-gray-500 text-lg">
                                            暂无存款记录
                                        </p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            开始您的第一笔存款吧！
                                        </p>
                                    </div>
                                )
                            ) : (
                                /* 取款记录内容 */
                                isLoadingWithdraws ? (
                                    <div className="flex items-center justify-center py-8">
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{
                                                duration: 1,
                                                repeat: Infinity,
                                                ease: "linear",
                                            }}
                                            className="w-8 h-8 text-orange-500"
                                        >
                                            <Coins className="w-full h-full" />
                                        </motion.div>
                                        <span className="ml-3 text-gray-600">
                                            加载取款记录中...
                                        </span>
                                    </div>
                                ) : withdrawsResponse?.data &&
                                  withdrawsResponse.data.length > 0 ? (
                                    <div className="space-y-3">
                                        {withdrawsResponse.data
                                            .slice(0, 5)
                                            .map((withdraw, index) => (
                                                <motion.div
                                                    key={withdraw.id}
                                                    initial={{ opacity: 0, x: -20 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    transition={{
                                                        delay: index * 0.1,
                                                    }}
                                                    className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-red-50 rounded-xl border border-orange-200/50 hover:shadow-md transition-all duration-200"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                                                            <span className="text-white text-xl">
                                                                💸
                                                            </span>
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-gray-800">
                                                                -
                                                                {(
                                                                    withdraw.amount /
                                                                    1_000_000
                                                                ).toFixed(2)}{" "}
                                                                USDC
                                                            </div>
                                                            <div className="text-sm text-gray-500">
                                                                {new Date(
                                                                    withdraw.created_at_ms
                                                                ).toLocaleString(
                                                                    "zh-CN",
                                                                    {
                                                                        year: "numeric",
                                                                        month: "2-digit",
                                                                        day: "2-digit",
                                                                        hour: "2-digit",
                                                                        minute: "2-digit",
                                                                    }
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm text-gray-500">
                                                            取款人
                                                        </div>
                                                        <div className="text-xs text-gray-400 font-mono">
                                                            {withdraw.withdrawer.slice(
                                                                0,
                                                                6
                                                            )}
                                                            ...
                                                            {withdraw.withdrawer.slice(
                                                                -4
                                                            )}
                                                        </div>
                                                        <div className="text-xs text-gray-500 mt-1">
                                                            余额:{" "}
                                                            {(
                                                                withdraw.left_balance /
                                                                1_000_000
                                                            ).toFixed(2)}{" "}
                                                            USDC
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            ))}

                                        {/* 显示总记录数 */}
                                        {withdrawsResponse.total > 5 && (
                                            <div className="text-center py-4 mt-4 border-t border-orange-200/50">
                                                <span className="text-sm text-gray-500">
                                                    显示最近 5 条记录，共{" "}
                                                    {withdrawsResponse.total} 条
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-center py-8">
                                        <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                                            <span className="text-2xl">💸</span>
                                        </div>
                                        <p className="text-gray-500 text-lg">
                                            暂无取款记录
                                        </p>
                                        <p className="text-gray-400 text-sm mt-2">
                                            还没有进行过取款操作
                                        </p>
                                    </div>
                                )
                            )}
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}
