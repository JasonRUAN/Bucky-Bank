// import React from 'react';
// import { useHasPendingWithdrawalRequests } from '@/hooks/dbhooks/useGetWithdrawalRequests';

// interface WithdrawalDebugProps {
//     requesterAddress: string;
// }

// /**
//  * 调试组件 - 用于检查取款请求状态检测是否正常工作
//  */
// export function WithdrawalDebug({ requesterAddress }: WithdrawalDebugProps) {
//     const { 
//         data: hasPendingRequests, 
//         pendingAmount, 
//         pendingRequests,
//         isLoading,
//         error,
//         isError,
//         isSuccess
//     } = useHasPendingWithdrawalRequests(requesterAddress, {
//         enabled: !!requesterAddress
//     });

//     console.log('WithdrawalDebug - Hook 返回值:', {
//         hasPendingRequests,
//         pendingAmount,
//         pendingRequests,
//         isLoading,
//         error,
//         isError,
//         isSuccess
//     });

//     return (
//         <div className="p-4 border rounded-lg bg-gray-50">
//             <h3 className="font-bold mb-2">取款状态调试信息</h3>
//             <div className="space-y-1 text-sm">
//                 <div>请求者地址: {requesterAddress}</div>
//                 <div>加载中: {isLoading ? '是' : '否'}</div>
//                 <div>成功: {isSuccess ? '是' : '否'}</div>
//                 <div>错误: {isError ? '是' : '否'}</div>
//                 <div>错误信息: {error?.message || '无'}</div>
//                 <div>有待审批请求: {hasPendingRequests ? '是' : '否'}</div>
//                 <div>待审批数量: {pendingRequests || 0}</div>
//                 <div>待审批金额: {pendingAmount || 0}</div>
//             </div>
            
//             <div className="mt-4">
//                 <h4 className="font-semibold">按钮状态预览:</h4>
//                 <button
//                     disabled={hasPendingRequests || isLoading}
//                     className={`
//                         mt-2 px-4 py-2 rounded font-medium
//                         ${(hasPendingRequests || isLoading)
//                             ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
//                             : 'bg-blue-500 text-white cursor-pointer'
//                         }
//                     `}
//                 >
//                     {isLoading ? '检查中...' : hasPendingRequests ? '取款审批中' : '申请取款'}
//                 </button>
//             </div>
//         </div>
//     );
// }

// export default WithdrawalDebug;