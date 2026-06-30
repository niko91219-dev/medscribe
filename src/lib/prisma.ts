import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

// 为什么要单例：Next.js 开发模式下热更新会反复执行模块，
// 每次 new 一个 PrismaClient 就会多开一批数据库连接，很快耗尽 Neon 的连接数。
// 把实例挂到 globalThis 上复用，避免连接泄漏。生产环境每个进程只建一次。
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// 运行时走 pooler 版连接串（DATABASE_URL），适配 serverless 高并发。
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
