# BuckyBank Frontend

这是 BuckyBank 项目的前端应用，使用 Next.js + React + TypeScript + TanStack Query 构建。

## 功能特性

- 查看 BuckyBank 列表
- 按父地址或子地址筛选
- 分页浏览
- 响应式设计
- 实时数据更新

## 快速开始

### 环境要求

- Node.js 18+
- npm 或 pnpm

### 安装和运行

1. **进入前端目录**
   ```bash
   cd frontend
   ```

2. **安装依赖**
   ```bash
   npm install
   # 或
   pnpm install
   ```

3. **配置环境变量**
   ```bash
   cp .env.local.example .env.local
   ```
   
   编辑 `.env.local` 文件：
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

4. **启动开发服务器**
   ```bash
   npm run dev
   # 或
   pnpm dev
   ```

   应用将在 `http://localhost:3000` 启动。

## 使用 useGetBuckyBank Hook

### 基本用法

```tsx
import { useGetBuckyBanks } from "@/hooks/useGetBuckyBank";

function BuckyBankList() {
  const { data, isLoading, error } = useGetBuckyBanks({
    page: 1,
    limit: 10
  });

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;

  return (
    <div>
      {data?.data.map(bank => (
        <div key={bank.id}>
          <h3>{bank.name}</h3>
          <p>目标金额: {bank.target_amount}</p>
        </div>
      ))}
    </div>
  );
}
```

### 按父地址查询

```tsx
import { useGetBuckyBanksByParent } from "@/hooks/useGetBuckyBank";

function ParentBanks({ parentAddress }: { parentAddress: string }) {
  const { data, isLoading } = useGetBuckyBanksByParent(parentAddress, {
    enabled: !!parentAddress,
    limit: 20
  });

  return (
    <div>
      {data?.data.map(bank => (
        <div key={bank.id}>{bank.name}</div>
      ))}
    </div>
  );
}
```

### 按子地址查询

```tsx
import { useGetBuckyBanksByChild } from "@/hooks/useGetBuckyBank";

function ChildBanks({ childAddress }: { childAddress: string }) {
  const { data, isLoading } = useGetBuckyBanksByChild(childAddress, {
    enabled: !!childAddress,
    refetchInterval: 30000 // 30秒自动刷新
  });

  return (
    <div>
      {data?.data.map(bank => (
        <div key={bank.id}>{bank.name}</div>
      ))}
    </div>
  );
}
```

### 查询单个 BuckyBank

```tsx
import { useGetBuckyBankById } from "@/hooks/useGetBuckyBank";

function BuckyBankDetail({ id }: { id: string }) {
  const { data, isLoading, error } = useGetBuckyBankById(id);

  if (isLoading) return <div>加载中...</div>;
  if (error) return <div>错误: {error.message}</div>;
  if (!data?.success || !data.data) return <div>未找到数据</div>;

  const bank = data.data;
  
  return (
    <div>
      <h1>{bank.name}</h1>
      <p>目标金额: {bank.target_amount}</p>
      <p>父地址: {bank.parent_address}</p>
      <p>子地址: {bank.child_address}</p>
      <p>截止时间: {new Date(bank.deadline_ms).toLocaleString()}</p>
    </div>
  );
}
```

### API 健康检查

```tsx
import { useApiHealth } from "@/hooks/useGetBuckyBank";

function ApiStatus() {
  const { data, isLoading, error } = useApiHealth();

  return (
    <div>
      状态: {isLoading ? "检查中..." : data?.status || "离线"}
    </div>
  );
}
```

## Hook 选项

所有 Hook 都支持以下选项：

- `enabled`: 是否启用查询（默认 true）
- `refetchInterval`: 自动刷新间隔（毫秒）
- `staleTime`: 数据过期时间（默认 5 分钟）

## 类型定义

```typescript
interface BuckyBankCreatedEvent {
  id: string;
  bucky_bank_id: string;
  name: string;
  parent_address: string;
  child_address: string;
  target_amount: number;
  deadline_ms: number;
  created_at: string;
}

interface BuckyBankQueryParams {
  page?: number;
  limit?: number;
  parent_address?: string;
  child_address?: string;
}
```

## 项目结构

```
frontend/src/
├── hooks/
│   └── useGetBuckyBank.ts    # BuckyBank 数据获取 Hook
├── lib/
│   └── api.ts                # API 客户端
├── types/
│   └── index.ts              # 类型定义
├── constants/
│   └── index.ts              # 常量定义
└── components/
    └── BuckyBankList.tsx     # 示例组件
```

## 开发

### 添加新的 API 端点

1. 在 `types/index.ts` 中添加类型定义
2. 在 `lib/api.ts` 中添加 API 方法
3. 在 `hooks/useGetBuckyBank.ts` 中添加对应的 Hook
4. 在 `constants/index.ts` 中添加查询键

### 构建和部署

```bash
# 构建生产版本
npm run build

# 启动生产服务器
npm run start