import React, { useState } from 'react';
import { 
    useGetWithdrawalRequestsByRequester,
    useGetWithdrawalRequestsByBuckyBankId 
} from '@/hooks/dbhooks/useGetWithdrawalRequests';
import type { WithdrawalRequest } from '@/types';

interface WithdrawalRequestsListProps {
    /** 查询模式：按请求者查询或按 BuckyBank ID 查询 */
    mode: 'requester' | 'buckybank';
    /** 请求者地址（当 mode 为 'requester' 时使用） */
    requesterAddress?: string;
    /** BuckyBank ID（当 mode 为 'buckybank' 时使用） */
    buckyBankId?: string;
    /** 可选的状态过滤器 */
    statusFilter?: string;
    /** 每页显示数量 */
    pageSize?: number;
    className?: string;
}

/**
 * 取款请求列表组件
 * 可以按请求者或 BuckyBank ID 查询取款请求
 */
export function WithdrawalRequestsList({
    mode,
    requesterAddress,
    buckyBankId,
    statusFilter,
    pageSize = 10,
    className = ""
}: WithdrawalRequestsListProps) {
    const [currentPage, setCurrentPage] = useState(1);

    // 根据模式选择合适的 hook
    const requesterQuery = useGetWithdrawalRequestsByRequester(
        requesterAddress || '',
        {
            page: currentPage,
            limit: pageSize,
            status: statusFilter
        },
        {
            enabled: mode === 'requester' && !!requesterAddress
        }
    );

    const buckyBankQuery = useGetWithdrawalRequestsByBuckyBankId(
        buckyBankId || '',
        {
            page: currentPage,
            limit: pageSize,
            status: statusFilter
        },
        {
            enabled: mode === 'buckybank' && !!buckyBankId
        }
    );

    // 选择当前使用的查询结果
    const query = mode === 'requester' ? requesterQuery : buckyBankQuery;
    const { data, isLoading, error } = query;

    // 格式化金额
    const formatAmount = (amount: number) => {
        return (amount / 1000000).toFixed(2);
    };

    // 格式化时间
    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleString('zh-CN');
    };

    // 获取状态样式
    const getStatusStyle = (status: string) => {
        const styles = {
            'Pending': 'bg-yellow-100 text-yellow-800',
            'Approved': 'bg-green-100 text-green-800',
            'Rejected': 'bg-red-100 text-red-800',
            'Cancelled': 'bg-gray-100 text-gray-800',
            'Withdrawed': 'bg-blue-100 text-blue-800'
        };
        return styles[status as keyof typeof styles] || 'bg-gray-100 text-gray-800';
    };

    // 获取状态中文名称
    const getStatusText = (status: string) => {
        const statusMap = {
            'Pending': '待审批',
            'Approved': '已批准',
            'Rejected': '已拒绝',
            'Cancelled': '已取消',
            'Withdrawed': '已提取'
        };
        return statusMap[status as keyof typeof statusMap] || status;
    };

    if (isLoading) {
        return (
            <div className={`flex justify-center items-center py-8 ${className}`}>
                <div className="text-gray-500">加载中...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={`text-red-500 text-center py-8 ${className}`}>
                加载失败: {error.message}
            </div>
        );
    }

    if (!data?.success || data.data.length === 0) {
        return (
            <div className={`text-gray-500 text-center py-8 ${className}`}>
                暂无取款请求记录
            </div>
        );
    }

    const totalPages = Math.ceil(data.total / pageSize);

    return (
        <div className={`space-y-4 ${className}`}>
            <div className="bg-white rounded-lg shadow overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    申请时间
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    金额 (USDC)
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    原因
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    状态
                                </th>
                                {mode === 'buckybank' && (
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        申请者
                                    </th>
                                )}
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    审批时间
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {data.data.map((request: WithdrawalRequest) => (
                                <tr key={request.id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                        {formatTime(request.created_at_ms)}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                        {formatAmount(request.amount)}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                                        {request.reason}
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusStyle(request.status)}`}>
                                            {getStatusText(request.status)}
                                        </span>
                                    </td>
                                    {mode === 'buckybank' && (
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">
                                            {request.requester.slice(0, 6)}...{request.requester.slice(-4)}
                                        </td>
                                    )}
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                        {request.audit_at_ms ? formatTime(request.audit_at_ms) : '-'}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* 分页控件 */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-700">
                        显示第 {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, data.total)} 条，
                        共 {data.total} 条记录
                    </div>
                    <div className="flex space-x-2">
                        <button
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            disabled={currentPage === 1}
                            className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            上一页
                        </button>
                        <span className="px-3 py-1 text-sm">
                            第 {currentPage} / {totalPages} 页
                        </span>
                        <button
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={currentPage === totalPages}
                            className="px-3 py-1 text-sm border rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

export default WithdrawalRequestsList;