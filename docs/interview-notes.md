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

### 7. 环境变量与密钥管理（部署 / CI）
- 密钥（DB 连接串、AUTH_SECRET）**绝不进 git**（`.env` 被 gitignore）→ 部署平台（Vercel）在后台单独配 → **本地 .env 不会上传**，两边各存一份。
- **每个环境用不同的 secret**（本地 / 生产 AUTH_SECRET 不同）→ 一处泄露不影响另一处。
- 提交 `.env.example`（只有变量名、无真实值）当模板，方便协作者/未来的自己知道要配哪些。
- 改了环境变量要 **Redeploy** 才生效（构建时注入）。
- 这就是面试常问的"密钥怎么管理" / "本地和线上配置怎么隔离"的标准答案。

## 三、模拟面试：满分答法（登录这条线）

> 2026/07/02 做过一轮模拟面试的复盘。两个通用教训：
> ①答"为什么"要把**因果链说全**，别让面试官替你补最后一句。
> ②分清**功能问题 vs 安全问题**——问"为什么这样设计"时，十有八九考的是安全/权衡。

**Q1. 用户点登录到成功，后端做了哪些事？（讲流程，动词要精确）**
> 后端拿到邮箱密码 → 按邮箱查库 → 用 **`bcrypt.compare`** 把明文和库里存的哈希比对 → 对上就**签发 JWT，作为 httpOnly cookie 种到浏览器** → 前端跳转到目标页。之后每次请求浏览器自动带上这个 cookie。
> （易漏点：说清 JWT **存哪**——httpOnly cookie，能顺带带出 cookie 安全的加分。）

**Q2. 是把输入密码重新哈希再 `===` 比较吗？有什么问题？**
> 不是。bcrypt 每次哈希会**生成新的随机盐**，同一密码两次哈希结果不同，`===` 永远 false。要用 `bcrypt.compare`——它从库里的旧哈希中**取回当初那段盐**，用同一段盐算再比对。

**Q3. 为什么盐要随机？固定盐/全站一个盐不行吗？（考安全，不是功能）**
> 固定盐**不影响能否比对**（功能正常），问题在**安全**：①相同密码会算出相同哈希 → 库泄露后一眼看出谁和谁密码相同；②盐固定且已知 → 黑客可提前算好彩虹表，**一张表破全站**。随机盐让每人盐不同 → 得逐个用户单独算 → 彩虹表失效。
> 条件反射：**听到"盐/为什么随机" → 答"抗彩虹表 + 藏相同密码"**。

**Q4. middleware/proxy 为什么不能直接用 Prisma？你怎么解决的？**
> proxy 跑在 **edge runtime**（精简 JS 环境，缺完整 Node API，不能开 TCP 连接），而 Prisma 连 Postgres 要开 TCP → 用不了。解决：**拆两份配置**——瘦的 `auth.config.ts`（不含 Prisma）给 edge 上的 proxy；完整的 `auth.ts`（含 Prisma+bcrypt）给 Node 端的 API 路由。
> 加分：proxy 其实**不需要**查库——验登录 = 用 Web Crypto 验 JWT 签名（edge 自带），纯计算不查库（JWT 无状态）。

**Q5. JWT 被盗/退出登录，怎么让它立刻失效？难在哪？（筛人题）**
> 难点根因：JWT **无状态**，服务端不存已签发 token 的记录 → **没有一张表可以删** → 够不着、撤不回。只设有效期只能让它"将来"过期，给不了"立刻"。
> 两种解法：①**短有效期 + refresh token**：access token 设短（如15min），refresh token 存服务端可撤销 → 撤 refresh，最多 15min 后出局（把损失窗口压小）。②**黑名单**(Redis)：验签后再查作废名单，能真·立刻失效，但代价是**加回一次查询**，部分放弃 JWT"不查库"的优势。
> 收尾金句：**这是 JWT 的根本权衡——用"无法立刻撤销"换"不查库/快/可扩展"；想要回撤销能力就得加回状态。有状态 vs 无状态是一条按需滑动的光谱，不是非黑即白。**

### 数据库层追问（pooler / 单例）

**Q6. 开发时如果每次都 `new PrismaClient()` 会怎样？`globalThis` 单例怎么解决？**
> 开发模式热更新(HMR)会反复重新执行模块，每次 `new` 就多开一批连接、旧的没释放 → 很快 `too many connections`。`globalThis` 是**进程级、HMR 不会清空**的全局对象，把实例挂上去，之后"有就复用、没有才 new"(`globalForPrisma.prisma ?? new PrismaClient()`) → 热更新一百次也只有一个实例。只在**非生产**环境挂全局（生产每进程只加载一次，不需要）。

**Q7. 为什么运行时用 pooler、迁移用 direct？**
> 运行时(serverless)高并发，很多函数实例各开连接会打爆 Postgres 连接上限 → 走 **pooler 连接池复用**。迁移是改表结构(DDL)，需要独占一个稳定连接、加锁，pooler 中途切换/复用连接会干扰 → 走 **direct 直连**。一句话：**平时读写走池子省连接，改表走直连保稳定。**

**⚠️ 高频混淆点：两种"连接太多"，成因和解法完全不同**

| | 问题 A：开发热更新 | 问题 B：生产 serverless |
|---|---|---|
| 成因 | 改代码 → HMR 反复 `new PrismaClient` → 连接堆积 | 高并发 → 很多 serverless 实例**同时**各开连接 |
| 解法 | **单例（globalThis）** | **连接池（pooler）** |
| 发生在 | 只在**开发** | 主要在**生产/线上** |

> 记牢：**HMR 泄漏 → 单例治；serverless 并发 → 连接池治。** 都是"连接太多"，但一个是"同一进程反复 new"，一个是"很多进程各开一个"。能拆开讲 = 高手信号。

> 📌 复盘教训（反复出现的失分习惯）：①答"为什么"要把**因果链说全**；②别把"看起来一样"的东西混成一个——已踩过两次：**功能问题 vs 安全问题**(盐)、**HMR 泄漏 vs serverless 并发**(连接)。

## 四、AI 集成（Week 2：SOAP 病历整理）

完成时间：2026/07/06。链路：录入页 → `POST /api/records`（`auth()` 保护）→ 调 LLM 结构化输出 SOAP → 存 `Record` 表（挂 userId）→ 页面展示。

> ⚠️ 项目实况：因无国际支付方式，未用 Anthropic/Claude，改用**智谱 GLM**（`glm-4-flash`，OpenAI 兼容接口）。面试就说"接的是国产大模型，OpenAI 兼容接口，换 provider 只动一层"。

### 1. Provider 可移植性（本项目最亮的架构点）
- 国产大模型（智谱/通义/Kimi/DeepSeek）大多提供 **OpenAI 兼容接口** → 直接用官方 `openai` SDK，只改 `baseURL` 指过去。
- 全项目**只有一层**（`src/lib/llm.ts`）和具体 provider 绑定：`baseURL` + 模型名两个常量 + env 里的 key。换供应商时业务代码（整理逻辑、API、页面）一行不动。
- 金句：**"provider 只是一层适配，不是架构"** —— 体现你懂解耦、不被单一厂商锁定。

### 2. 结构化输出的可靠性（为什么不自己 parse 一坨文本）
- 让模型走 **JSON 模式**（`response_format: { type: "json_object" }`），它只吐 JSON，不带"好的，以下是…"的废话。
- 拿到后**两道校验**：`JSON.parse`（防格式坏）→ **zod `.parse`**（防结构不对，比如少了 `plan` 字段）。
- **zod schema 一物两用**：`z.infer` 出 TypeScript 类型（编译期）+ `.parse()` 运行时校验。一份 schema 同时管类型和校验，不重复。
- 核心观点：**"模型输出不可全信，要在边界把不确定的字符串收敛成可信任的类型。"**

### 3. Prompt 设计
- 用 **system prompt** 给模型定角色（"你是病历整理助手"）+ 明确输出结构（SOAP 四段各是什么）+ 兜底规则（信息缺失填"未提及"）。
- system（稳定的指令）与 user（每次不同的原始记录）分离。

### 4. AI 调用的错误处理
- AI 调用会失败：网络/超时、余额不足、返回结构不合规（zod 抛错）。全 try/catch 兜住。
- 状态码选 **502（Bad Gateway）** 而非 500：失败源自**上游依赖**（第三方 AI），502 语义更准。（对比：认证 401、参数 400、自己服务器崩 500、上游挂 502。）
- 免费模型有 **RPM/RPD 限流**，量大时要对 429 做指数退避重试。

### 5. 复用 Week 1 的地基
- 接口用 `auth()` 拿 `session.user.id`（就是当初 session 回调透传的那个 id）→ 记录挂在登录用户名下。
- `Record.userId` 加了 `@@index`：按用户查病历很频繁，外键加索引避免全表扫描。（面试"何时加索引"：高频查询/过滤/JOIN 的列。）

### 6. 又一次密钥管理
- LLM key 用**通用名 `LLM_API_KEY`**（不叫 `GLM_KEY`）→ 换 provider 时连环境变量名都不用改。接上第 7 点的"分环境管理密钥"。
- 上线要在 Vercel 补 `LLM_API_KEY`（同 `AUTH_SECRET`/DB 串）。

