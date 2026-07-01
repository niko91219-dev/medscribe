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

## 二、认证安全（Auth.js v5 + JWT + Cookie）

完成时间：2026/06/30（理论；代码实现见后续）

> 主线一句话：**token 存 localStorage 怕 XSS → 改存 httpOnly cookie → cookie 自动发送怕 CSRF → 用 sameSite 挡 → 再加 secure 强制 HTTPS。** 能完整讲下这条链，认证安全这块就稳了。

### 1. JWT 结构（三段，点分隔）
`header.payload.signature`
- **header**：签名算法（如 HS256）
- **payload**：数据，如 `{ userId, exp }`
- **signature**：用服务端密钥（`AUTH_SECRET`）对前两段算的指纹

要点：
- 前两段只是 **base64 编码，不是加密** → 贴到 jwt.io 谁都能读 payload → **JWT 里绝不放敏感信息**。
- 安全不靠"看不见"，靠"**改不动**"：改了 payload 签名就对不上，服务端验签即发现篡改。
- 签名靠只有服务端知道的 `AUTH_SECRET`；**密钥泄露 = 能伪造任意身份**，必须强随机、只存服务端。
- Auth.js v5 默认更进一步把整个 JWT **加密**（JWE），payload 也看不到。

### 2. 两种会话模式：无状态 vs 有状态
核心区别：**登录凭证存客户端还是服务端。**

| | JWT（无状态，我们用） | Session（有状态） |
|---|---|---|
| 凭证 | 加密 token 存浏览器，服务端不存 | 服务端库里存 session，cookie 只存 id |
| 验证 | 验签名，**不查库** | 拿 id **查库** |
| 优点 | 无状态、可水平扩展、**适配 serverless** | 删库里那行即可**即时踢人下线** |
| 缺点 | 发出后**到期前难作废** | 每次查库、多实例要共享存储(Redis) |

**JWT 难作废的补救**（面试追问必考）：
1. **短过期 + refresh token**（业界主流）：access token 设很短(如15min)，配长效 refresh token 换新。泄露顶多被用一小会儿。
2. **黑名单**(Redis)：验签后再查作废列表 —— 但这又变回有状态，部分放弃了 JWT 优势。

### 3. token 存哪：localStorage vs httpOnly cookie（接前端的 XSS）
| 存哪 | JS 能读 | 风险 |
|------|--------|------|
| localStorage | ✅ | **XSS 致命**：恶意脚本 `localStorage.getItem('token')` 直接偷走 |
| **httpOnly cookie** | ❌ | JS 读不到 → 有 XSS 也偷不走 ✅ |

> **XSS（跨站脚本）**：攻击者让恶意 JS 在你页面上跑（如评论区注入 `<script>`）。token 在 localStorage 就被直接读走。
> 结论：**token 放 httpOnly cookie，不放 localStorage**（很多前端的盲区）。Auth.js 默认就这么做。

### 4. cookie 带来 CSRF → 用 sameSite 防
cookie 特性：浏览器对同域请求**自动带上**。方便，但开了口子。

> **CSRF（跨站请求伪造）**：你登录了 bank.com（cookie 在浏览器）。点开 evil.com，它偷偷提交表单到 `bank.com/transfer`，浏览器**自动带上 bank.com 的 cookie** → 银行以为是你。攻击者**读不到** cookie，但能**借用**它发请求。

**cookie 安全三件套**：
| 属性 | 作用 | 防什么 |
|------|------|--------|
| `httpOnly` | JS 读不到 cookie | **XSS** 偷 token |
| `sameSite=lax/strict` | 跨站请求不自动带 cookie | **CSRF** |
| `secure` | 仅 HTTPS 下发送 | 中间人明文窃听 |

`sameSite` 取值：`strict`(最严，外链点入要重登)、`lax`(默认，导航 GET 放行/跨站 POST 拦截，平衡)、`none`(总带，必须配 secure)。

### 5. 认证 vs 授权（别混）
- **认证 Authn = 你是谁**（登录）← 本次做的
- **授权 Authz = 你能干什么**（权限/角色）← 以后做

### 6. 代码落地要点（Auth.js v5 实操）

**edge 拆分配置（真实工程坑，面试加分）**
- Next.js 的 middleware/proxy 跑在 **edge runtime**，没有完整 Node API → **Prisma、bcrypt 在里面会构建失败**。
- 解法：拆两份配置——
  - `auth.config.ts`：edge 安全的瘦配置（只有路由规则 `authorized` 回调），给 proxy 用。
  - `auth.ts`：完整配置（PrismaAdapter + Credentials 的 bcrypt 验证），给 API 路由（Node runtime）用。
- Next.js 16 起 `middleware.ts` 改名 `proxy.ts`（旧名有 deprecation 警告）。

**bcrypt 两个方法别用错**
- 注册：`bcrypt.hash(明文, 10)` —— 10 是 cost factor，自动加盐。
- 登录：`bcrypt.compare(明文, 库里的哈希)` —— **不是**再 hash 一次去等值比较（每次盐不同，哈希结果也不同，等值比较永远 false）。

**注册接口的后端思维**
- 后端必须**自己校验**邮箱格式/密码长度，绝不只信前端。
- "邮箱唯一"的真正保障是 **DB 的 `@unique` 约束**（并发下应用层查重有竞态 TOCTOU）→ 捕获 Prisma `P2002` 错误码返回 409，而不是只靠先查再插。
- 返回给前端的数据**绝不含 hashedPassword**。

**登录失败不泄露细节**
- 邮箱不存在 / 密码错，都统一返回"邮箱或密码错误"，避免攻击者探测哪些邮箱已注册。

**数据流：id 怎么到前端**
- `authorize` 返回 `{id,...}` → 进 JWT 的 `token.sub` → `session` 回调里 `session.user.id = token.sub` → 页面 `await auth()` 能拿到。
- `session.user.id` 需要用 `next-auth.d.ts` 扩展类型（默认 user 没有 id 字段）。

**JWT 策略是被迫的**：Credentials provider 只支持 JWT session，不支持数据库 session。

<!-- 后续追加：AI 集成、SOAP 功能、部署 等 -->

