// Auth.js 的标准路由入口。
// [...nextauth] 是 catch-all 动态路由，把 /api/auth/* 下所有请求
// （signin、signout、session、callback 等）都交给 Auth.js 处理。
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
