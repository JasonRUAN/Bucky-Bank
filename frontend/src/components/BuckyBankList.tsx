"use client";

import { useState } from "react";
import { useGetBuckyBanks, useGetBuckyBanksByParent } from "@/hooks/useGetBuckyBank";
import type { BuckyBankQueryParams } from "@/types";

export function BuckyBankList() {
    const [queryParams, setQueryParams] = useState<BuckyBankQueryParams>({
        page: 1,
        limit: 10,
    });
    const [parentAddress, setParentAddress] = useState("");

    // 获取所有 BuckyBank 数据
    const { 
        data: buckyBanksData, 
        isLoading, 
        error, 
        refetch 
    } = useGetBuckyBanks(queryParams);

    // 根据父地址获取数据
    const { 
        data: parentBanksData, 
        isLoading: isParentLoading 
    } = useGetBuckyBanksByParent(parentAddress, {
        enabled: !!parentAddress,
        limit: 10,
    });

    const handlePageChange = (newPage: number) => {
        setQueryParams(prev => ({ ...prev, page: newPage }));
    };

    const handleParentAddressSearch = () => {
        // 触发按父地址搜索
        if (parentAddress.trim()) {
            console.log("Searching by parent address:", parentAddress);
        }
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-lg">加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-red-500">
                <div className="text-lg mb-4">加载失败: {error.message}</div>
                <button 
                    onClick={() => refetch()}
                    className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                    重试
                </button>
            </div>
        );
    }

    const displayData = parentAddress && parentBanksData?.success 
        ? parentBanksData 
        : buckyBanksData;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold mb-6">BuckyBank 列表</h1>
            
            {/* 搜索区域 */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <div className="flex gap-4 items-end">
                    <div className="flex-1">
                        <label className="block text-sm font-medium mb-2">
                            按父地址搜索
                        </label>
                        <input
                            type="text"
                            value={parentAddress}
                            onChange={(e) => setParentAddress(e.target.value)}
                            placeholder="输入父地址..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                    <button
                        onClick={handleParentAddressSearch}
                        disabled={!parentAddress.trim() || isParentLoading}
                        className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400"
                    >
                        {isParentLoading ? "搜索中..." : "搜索"}
                    </button>
                    <button
                        onClick={() => setParentAddress("")}
                        className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600"
                    >
                        清除
                    </button>
                </div>
            </div>

            {/* 数据展示 */}
            {displayData?.success ? (
                <div>
                    <div className="mb-4 text-sm text-gray-600">
                        共找到 {displayData.total} 条记录
                        {parentAddress && ` (按父地址 "${parentAddress}" 筛选)`}
                    </div>
                    
                    <div className="grid gap-4">
                        {displayData.data.map((bank) => (
                            <div key={bank.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <h3 className="font-semibold text-lg mb-2">{bank.name}</h3>
                                        <p className="text-sm text-gray-600 mb-1">
                                            <span className="font-medium">BuckyBank ID:</span> {bank.bucky_bank_id}
                                        </p>
                                        <p className="text-sm text-gray-600 mb-1">
                                            <span className="font-medium">目标金额:</span> {bank.target_amount.toLocaleString()} SUI
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">截止时间:</span> {new Date(bank.deadline_ms).toLocaleString()}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-gray-600 mb-1">
                                            <span className="font-medium">父地址:</span> 
                                            <span className="font-mono text-xs ml-1">{bank.parent_address}</span>
                                        </p>
                                        <p className="text-sm text-gray-600 mb-1">
                                            <span className="font-medium">子地址:</span> 
                                            <span className="font-mono text-xs ml-1">{bank.child_address}</span>
                                        </p>
                                        <p className="text-sm text-gray-600">
                                            <span className="font-medium">创建时间:</span> {new Date(bank.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* 分页 */}
                    {displayData.total > (queryParams.limit || 10) && (
                        <div className="mt-6 flex justify-center gap-2">
                            <button
                                onClick={() => handlePageChange((queryParams.page || 1) - 1)}
                                disabled={(queryParams.page || 1) <= 1}
                                className="px-3 py-1 border border-gray-300 rounded disabled:bg-gray-100"
                            >
                                上一页
                            </button>
                            <span className="px-3 py-1">
                                第 {queryParams.page || 1} 页
                            </span>
                            <button
                                onClick={() => handlePageChange((queryParams.page || 1) + 1)}
                                disabled={(queryParams.page || 1) * (queryParams.limit || 10) >= displayData.total}
                                className="px-3 py-1 border border-gray-300 rounded disabled:bg-gray-100"
                            >
                                下一页
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="text-center py-8 text-gray-500">
                    暂无数据
                </div>
            )}
        </div>
    );
}