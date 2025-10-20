"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import ChildPiggyBank from "./ChildPiggyBank";
import ParentDashboard from "./ParentDashboard";
import { ConnectButton } from "@mysten/dapp-kit";

export default function PiggyBank() {
    const [activeTab, setActiveTab] = useState<"child" | "parent">("child");

    return (
        <div className="min-h-screen relative">
            {/* 顶部导航栏 */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-white/20 px-8 py-4">
                <div className="flex justify-between items-center max-w-6xl mx-auto">
                    {/* Logo */}
                    <div className="flex items-center gap-2">
                        <span className="text-3xl">🐷</span>
                        <h1 className="text-2xl font-bold bg-gradient-to-br from-pink-500 to-purple-500 bg-clip-text text-transparent m-0">
                            BuckyBank
                        </h1>
                    </div>

                    {/* 导航栏：孩子入口 / 家长入口 */}
                    <div className="flex items-center gap-2">
                        <Button
                            variant={
                                activeTab === "child" ? undefined : "outline"
                            }
                            onClick={() => setActiveTab("child")}
                            className={`px-4 py-2 rounded-3xl ${
                                activeTab === "child"
                                    ? "bg-gradient-to-br from-pink-500 to-purple-500 text-white border-none"
                                    : ""
                            }`}
                        >
                            孩子入口
                        </Button>
                        <Button
                            variant={
                                activeTab === "parent" ? undefined : "outline"
                            }
                            onClick={() => setActiveTab("parent")}
                            className={`px-4 py-2 rounded-3xl ${
                                activeTab === "parent"
                                    ? "bg-gradient-to-br from-blue-500 to-purple-600 text-white border-none"
                                    : ""
                            }`}
                        >
                            家长入口
                        </Button>
                    </div>

                    {/* 钱包连接按钮 */}
                    <ConnectButton />
                </div>
            </div>

            {/* 主要内容区域 */}
            <div className="pt-24">
                {activeTab === "child" ? (
                    <ChildPiggyBank />
                ) : (
                    <ParentDashboard />
                )}
            </div>
        </div>
    );
}
