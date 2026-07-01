import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

// POST /api/register —— 注册新用户（邮箱 + 密码）
export async function POST(req: Request) {
  try {
    const { email, password, name } = await req.json();

    // 1. 基本校验（后端必须自己校验，绝不能只信前端）
    if (typeof email !== "string" || typeof password !== "string") {
      return NextResponse.json({ error: "邮箱和密码必填" }, { status: 400 });
    }
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    if (!emailOk) {
      return NextResponse.json({ error: "邮箱格式不正确" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json({ error: "密码至少 8 位" }, { status: 400 });
    }

    // 2. bcrypt 哈希（cost factor 10：每个密码自带随机盐，且故意算得慢以抗暴破）
    const hashedPassword = await bcrypt.hash(password, 10);

    // 3. 存库。真正的"邮箱唯一"保障是数据库的 @unique 约束，
    //    不是上面的应用层查重（并发下查重会有竞态）。所以这里靠 DB 约束兜底。
    const user = await prisma.user.create({
      data: {
        email,
        name: typeof name === "string" && name.trim() ? name.trim() : null,
        hashedPassword,
      },
    });

    // 4. 绝不把 hashedPassword 返回给前端
    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 },
    );
  } catch (err) {
    // P2002 = 唯一约束冲突 → 邮箱已被注册
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
    }
    console.error("register error:", err);
    return NextResponse.json({ error: "服务器错误" }, { status: 500 });
  }
}
