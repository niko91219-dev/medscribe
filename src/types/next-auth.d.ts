import type { DefaultSession } from "next-auth";

// 扩展 Auth.js 的 Session 类型，让 session.user.id 在 TS 里合法。
// （默认的 user 只有 name/email/image，没有 id）
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}
