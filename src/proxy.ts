import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

// proxy（Next.js 16 前叫 middleware）跑在 edge runtime，只用 edge 安全的 authConfig
// （绝不碰 Prisma/bcrypt）。它在请求到达页面之前运行，靠 authConfig 里的 authorized
// 回调决定放行 or 重定向到登录页。
export default NextAuth(authConfig).auth;

export const config = {
  // matcher：决定哪些路径会经过 proxy。
  // 这里排除掉 Auth.js 接口、Next 静态资源、图片优化、favicon，其余都过一遍门卫。
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico).*)"],
};
