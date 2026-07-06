import type { NextAuthConfig } from "next-auth";

// ⚠️ 这份配置必须 "edge 安全"：不能 import Prisma / bcrypt（依赖 Node API，跑不了 edge runtime）。
// middleware 在 edge 上运行，只引用这份；完整逻辑（authorize/adapter）在 auth.ts。
export const authConfig = {
  pages: {
    signIn: "/login", // 未登录被拦截时，统一跳到这个登录页
  },
  providers: [], // 真正的 Credentials provider 在 auth.ts 注入（它依赖 Node）
  callbacks: {
    // middleware 每次请求都会调用它来决定放行还是拦截
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      // 受保护区：/dashboard 和 /records 都要登录
      const isProtected =
        nextUrl.pathname.startsWith("/dashboard") ||
        nextUrl.pathname.startsWith("/records");

      if (isProtected) {
        // 登录才放行；没登录返回 false → Auth.js 自动重定向到上面的 signIn 页
        return isLoggedIn;
      }
      return true; // 其余页面公开
    },
  },
} satisfies NextAuthConfig;

export default authConfig;
