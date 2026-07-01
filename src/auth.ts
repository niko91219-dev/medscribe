import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,

  // adapter 现在主要为将来加 OAuth 准备（OAuth 登录会用它自动建 User/Account）。
  // 邮箱密码 + JWT 流程其实不经过 adapter，但提前接好，以后加 OAuth 零改动。
  adapter: PrismaAdapter(prisma),

  // Credentials provider 只能用 JWT 策略（不支持数据库 session）。
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      // 声明这个 provider 接收哪些字段
      credentials: {
        email: {},
        password: {},
      },
      // 登录时 Auth.js 调用 authorize 验证身份。
      // 返回 user 对象 = 登录成功；返回 null = 登录失败（Auth.js 不会泄露具体哪里错）。
      async authorize(credentials) {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // 用户不存在，或这是个没设密码的 OAuth 用户 → 失败
        if (!user?.hashedPassword) return null;

        // 关键：用 compare 把明文和库里的哈希比对，绝不是再 hash 一次去等值比较
        const passwordOk = await bcrypt.compare(password, user.hashedPassword);
        if (!passwordOk) return null;

        // 返回的字段会被放进 JWT —— 注意绝不能带 hashedPassword
        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  callbacks: {
    ...authConfig.callbacks,
    // 把用户 id 透传到前端可读的 session 上，方便页面/接口拿到当前用户是谁。
    // 数据流：authorize 返回的 id → token.sub（JWT 里）→ session.user.id
    session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
});
