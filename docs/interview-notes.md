# MedScribe 面试知识点速查

> 这个文件记录做项目过程中遇到的、**面试官会深挖**的技术点。
> 每完成一块功能就往下追加。复习时从这里一站式查看。

---

## 一、数据库层（Prisma 7 + Neon Postgres）

完成时间：2026/06/30

### 1. 为什么选 Postgres 而不是 SQLite？
- Postgres 是后端岗位的**事实标准**，能聊的话题多：索引、事务隔离级别、连接池、migration、读写分离。
- SQLite 是单文件嵌入式库，撑不起"我懂后端基建"的叙事。
- 选型不是图省事，是**刻意挑能讲出深度的技术**。

### 2. 连接池（pooler）vs 直连（direct），为什么要两个连接串？
| 连接 | 用途 | 原因 |
|------|------|------|
| `DATABASE_URL`（带 `-pooler`） | app 运行时查询 | Serverless（Vercel）每次请求可能开新连接，Postgres 连接数有限，**连接池复用连接**才不会被打爆 |
| `DIRECT_URL`（不带 `-pooler`） | `prisma migrate` 改表结构 | 迁移要建临时连接、对表加锁改 schema（DDL），**连接池会干扰这类操作**，所以走直连更稳 |

一句话：**平时走池子省连接，改表时走直连保稳定。**

> 面试延伸："Serverless 环境怎么连数据库？" → 标准答案就是连接池（connection pooling），否则高并发下连接数瞬间耗尽。

### 3. 为什么 Prisma 客户端要做成单例（singleton）？
- Next.js 开发模式**热更新**会反复重新执行模块，每次 `new PrismaClient()` 就多开一批数据库连接 → 很快耗尽 Neon 连接数。
- 解法：把实例挂到 `globalThis` 上复用；生产环境每个进程只 new 一次。
- 代码见 `src/lib/prisma.ts`。

### 4. 密码为什么字段叫 `hashedPassword`，而不是 `password`？
- **数据库永远不存明文密码**，只存经过哈希（后续用 bcrypt 加盐）的值。
- 命名即文档：字段名直接表明"这里是哈希值"，防止有人误存明文。
- 即使数据库泄露，攻击者拿到的也只是哈希，无法直接还原密码。

### 5. Prisma 7 的新变化（能体现你跟得上版本）
- 连接配置从 `schema.prisma` 移到了独立的 `prisma.config.ts`。
- 运行时改用**驱动适配器**（driver adapter，这里是 `@prisma/adapter-pg`），不再内置 Rust 引擎直连。
- 客户端生成到 `src/generated/prisma`，按 ESM 方式导入。
- 生成的客户端**不进 git**（`.gitignore` 自动忽略）。所以 CI/部署（Vercel）必须重新生成 →
  在 `package.json` 加 `"postinstall": "prisma generate"`，每次装依赖后自动生成，否则线上构建会因找不到客户端而失败。
  > 这是"生成物不入库、构建时重建"的通用工程实践，能聊到 CI 流程设计。

---

<!-- 后续追加：认证、AI 集成、部署 等 -->
