"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Sparkles, PiggyBank as PiggyBankIcon, ArrowLeft } from "lucide-react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useGetBuckyBanksByChild } from "@/hooks/useGetBuckyBank";
import { useDeposit, suiToMist } from "@/mutations/deposit";
import type { BuckyBankCreatedEvent } from "@/types";

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
    const [selectedPiggyBank, setSelectedPiggyBank] = useState<PiggyBankData | null>(null);
    const [depositAmount, setDepositAmount] = useState("");
    const [isDepositing, setIsDepositing] = useState(false);
    const [showSuccess, setShowSuccess] = useState(false);
    const [coins, setCoins] = useState<
        Array<{ id: number; x: number; y: number }>
    >([]);
    const [hearts, setHearts] = useState<
        Array<{ id: number; x: number; y: number }>
    >([]);

    const account = useCurrentAccount();
    
    // 获取当前用户作为child的存钱罐列表
    const { data: buckyBanksResponse, isLoading, refetch } = useGetBuckyBanksByChild(
        account?.address || "",
        {
            enabled: !!account?.address,
            refetchInterval: 30000, // 30秒刷新一次
        }
    );

    // 使用真实的存款 mutation
    const depositMutation = useDeposit();

    // 转换数据格式
    const piggyBanks: PiggyBankData[] = buckyBanksResponse?.data?.map((bank: BuckyBankCreatedEvent) => ({
        id: bank.bucky_bank_id,
        name: bank.name,
        targetAmount: bank.target_amount / 1_000_000_000, // 从MIST转换为SUI
        currentAmount: bank.current_balance_value / 1_000_000_000, // 从MIST转换为SUI
        durationDays: bank.duration_days,
        deadline: bank.deadline_ms,
        status: bank.current_balance_value >= bank.target_amount ? "completed" :
                (Date.now() > bank.deadline_ms) ? "expired" : "active"
    })) || [];
    // 处理存钱罐选择
    const handlePiggyBankSelect = (piggyBankId: string) => {
        const selected = piggyBanks.find(bank => bank.id === piggyBankId);
        if (selected) {
            setSelectedPiggyBank(selected);
        }
    };

    // 返回存钱罐列表
    const handleBackToList = () => {
        setSelectedPiggyBank(null);
        setDepositAmount("");
    };

    // 真实的存款函数
    const handleDeposit = async () => {
        if (!selectedPiggyBank || !depositAmount || parseFloat(depositAmount) <= 0) return;

        const amount = parseFloat(depositAmount);
        setIsDepositing(true);

        try {
            // 将 SUI 转换为 MIST 单位
            const amountInMist = suiToMist(depositAmount);
            
            // 调用真实的存款 mutation
            await depositMutation.mutateAsync({
                buckyBankId: selectedPiggyBank.id,
                amount: amountInMist
            });

            // 存款成功后更新本地状态
            setSelectedPiggyBank(prev => prev ? {
                ...prev,
                currentAmount: prev.currentAmount + amount
            } : null);
            
            setDepositAmount("");
            setShowSuccess(true);

            // 刷新存钱罐数据
            refetch();

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
            // 可以在这里添加错误提示
            alert("存款失败，请重试");
        } finally {
            setIsDepositing(false);
        }
    };

    // 获取状态徽章
    const getStatusBadge = (bank: PiggyBankData) => {
        if (bank.status === "completed") {
            return <span className="bg-green-500 text-white px-2 py-1 rounded-full text-sm">🎉 已完成</span>;
        } else if (bank.status === "expired") {
            return <span className="bg-red-500 text-white px-2 py-1 rounded-full text-sm">⏰ 已过期</span>;
        } else {
            return <span className="bg-blue-500 text-white px-2 py-1 rounded-full text-sm">🎯 进行中</span>;
        }
    };

    // 如果没有连接钱包
    if (!account?.address) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen p-8">
                <Card className="w-full max-w-md bg-white/90 backdrop-blur-md border-2 border-purple-500/20">
                    <CardContent className="p-8 text-center">
                        <PiggyBankIcon className="w-16 h-16 mx-auto mb-4 text-pink-500" />
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">连接钱包</h2>
                        <p className="text-gray-600">请先连接您的钱包来查看存钱罐</p>
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
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-16 h-16 mx-auto mb-4"
                        >
                            <PiggyBankIcon className="w-full h-full text-pink-500" />
                        </motion.div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">加载中...</h2>
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
                        <h2 className="text-2xl font-bold text-gray-800 mb-4">暂无存钱罐</h2>
                        <p className="text-gray-600 mb-4">您还没有任何存钱罐，请联系家长为您创建一个存钱罐。</p>
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
                                const progress = (bank.currentAmount / bank.targetAmount) * 100;
                                const daysLeft = Math.max(0, Math.ceil((bank.deadline - Date.now()) / (1000 * 60 * 60 * 24)));
                                
                                return (
                                    <motion.div
                                        key={bank.id}
                                        whileHover={{ scale: 1.02 }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <Card 
                                            className="cursor-pointer border-2 border-purple-500/20 hover:border-purple-500/40 transition-all duration-200"
                                            onClick={() => handlePiggyBankSelect(bank.id)}
                                        >
                                            <CardContent className="p-6">
                                                <div className="flex justify-between items-start mb-4">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-800 mb-2">{bank.name}</h3>
                                                        {getStatusBadge(bank)}
                                                    </div>
                                                    <PiggyBankIcon className="w-8 h-8 text-pink-500" />
                                                </div>
                                                
                                                <div className="space-y-3">
                                                    <div className="flex justify-between text-sm text-gray-600">
                                                        <span>进度</span>
                                                        <span>{progress.toFixed(1)}%</span>
                                                    </div>
                                                    
                                                    <div className="w-full bg-gray-200 rounded-full h-3">
                                                        <motion.div
                                                            className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full"
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${Math.min(progress, 100)}%` }}
                                                            transition={{ duration: 1, delay: 0.2 }}
                                                        />
                                                    </div>
                                                    
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-600">
                                                            {bank.currentAmount.toFixed(2)} / {bank.targetAmount.toFixed(2)} SUI
                                                        </span>
                                                        {bank.status === "active" && (
                                                            <span className="text-orange-500">
                                                                剩余 {daysLeft} 天
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
                        scale: selectedPiggyBank.currentAmount > 0 ? [1, 1.02, 1] : 1,
                        rotate: selectedPiggyBank.currentAmount > 0 ? [0, 1, -1, 0] : 0,
                    }}
                    transition={{
                        duration: 3,
                        repeat: selectedPiggyBank.currentAmount > 0 ? Infinity : 0,
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
                                repeat: selectedPiggyBank.currentAmount > 0 ? Infinity : 0,
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
                                repeat: selectedPiggyBank.currentAmount > 0 ? Infinity : 0,
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
                        repeat: selectedPiggyBank.currentAmount > 0 ? Infinity : 0,
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
                        {selectedPiggyBank.currentAmount.toFixed(2)} SUI
                    </p>
                    <p className="text-xl text-gray-500 mb-2">当前余额</p>
                    <p className="text-lg text-gray-400 mb-4">
                        目标: {selectedPiggyBank.targetAmount.toFixed(2)} SUI
                    </p>
                    
                    {/* 进度条 */}
                    <div className="w-80 mx-auto mb-4">
                        <div className="flex justify-between text-sm text-gray-600 mb-2">
                            <span>进度</span>
                            <span>{((selectedPiggyBank.currentAmount / selectedPiggyBank.targetAmount) * 100).toFixed(1)}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4">
                            <motion.div
                                className="bg-gradient-to-r from-pink-500 to-purple-500 h-4 rounded-full"
                                initial={{ width: 0 }}
                                animate={{ 
                                    width: `${Math.min((selectedPiggyBank.currentAmount / selectedPiggyBank.targetAmount) * 100, 100)}%` 
                                }}
                                transition={{ duration: 1, delay: 0.2 }}
                            />
                        </div>
                    </div>

                    {/* 状态徽章 */}
                    <div className="mb-4">
                        {getStatusBadge(selectedPiggyBank)}
                    </div>

                    {selectedPiggyBank.currentAmount >= selectedPiggyBank.targetAmount && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                        >
                            <span className="bg-gradient-to-br from-amber-400 to-amber-500 text-white px-4 py-2 rounded-full text-base font-semibold shadow-[0_4px_15px_rgba(251,191,36,0.3)]">
                                🏆 目标达成！
                            </span>
                        </motion.div>
                    )}
                </motion.div>
            </div>

            {/* 存款操作区域 */}
            {account?.address && (
                <Card className="w-full max-w-[500px] bg-white/90 backdrop-blur-md border-2 border-purple-500/20 shadow-[0_20px_40px_rgba(168,85,247,0.1)]">
                    <CardContent className="p-8">
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
                                            isDepositing || depositMutation.isPending
                                                ? "bg-gradient-to-br from-gray-400 to-gray-500"
                                                : "bg-gradient-to-br from-pink-500 to-purple-500"
                                        } border-none text-lg font-semibold rounded-xl shadow-[0_4px_15px_rgba(236,72,153,0.3)]`}
                                    >
                                        {isDepositing || depositMutation.isPending ? (
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
                                {[10, 50, 100].map((amount) => (
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
                                            disabled={isDepositing || depositMutation.isPending}
                                            className="w-full border-2 border-purple-500/30 text-purple-500 font-semibold py-3 rounded-xl bg-white/80"
                                        >
                                            💰 {amount} SUI
                                        </Button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
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
                            存款成功！
                        </div>
                        <p className="text-lg opacity-90">
                            你的小猪更开心了！ 🐷💕
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
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="p-6 bg-gradient-to-br from-blue-500/10 to-blue-600/10 rounded-2xl border border-blue-500/20"
                                >
                                    <div className="text-4xl font-bold text-blue-500 mb-2">
                                        💎 {selectedPiggyBank.currentAmount.toFixed(2)}
                                    </div>
                                    <div className="text-base text-gray-500">
                                        当前余额 SUI
                                    </div>
                                </motion.div>
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="p-6 bg-gradient-to-br from-emerald-500/10 to-emerald-600/10 rounded-2xl border border-emerald-500/20"
                                >
                                    <div className="text-4xl font-bold text-emerald-500 mb-2">
                                        💵 ${(selectedPiggyBank.currentAmount * 3.37).toFixed(2)}
                                    </div>
                                    <div className="text-base text-gray-500">
                                        估值 USD
                                    </div>
                                </motion.div>
                                <motion.div
                                    whileHover={{ scale: 1.05 }}
                                    className="p-6 bg-gradient-to-br from-purple-500/10 to-purple-600/10 rounded-2xl border border-purple-500/20"
                                >
                                    <div className="text-4xl font-bold text-purple-500 mb-2">
                                        🎯 {selectedPiggyBank.targetAmount.toFixed(2)}
                                    </div>
                                    <div className="text-base text-gray-500">
                                        目标金额 SUI
                                    </div>
                                </motion.div>
                            </div>
                        </CardContent>
                    </Card>
                </motion.div>
            )}
        </div>
    );
}
