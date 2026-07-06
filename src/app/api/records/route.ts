import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateSoap } from "@/lib/soap";

// POST /api/records —— 提交原始记录，AI 整理成 SOAP 并存库
export async function POST(req: Request) {
  // 1. 认证：复用 Week 1 的 auth()。只有登录用户能建病历。
  //    session.user.id 就是我们当初在 session 回调里透传出来的那个 id。
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    // 2. 后端校验（老规矩，绝不只信前端）
    const { rawText } = await req.json();
    if (typeof rawText !== "string" || rawText.trim().length === 0) {
      return NextResponse.json({ error: "原始记录不能为空" }, { status: 400 });
    }

    // 3. 调 LLM 整理成结构化 SOAP
    const soap = await generateSoap(rawText);

    // 4. 存库，挂在当前登录用户名下
    const record = await prisma.record.create({
      data: {
        userId: session.user.id,
        rawText,
        subjective: soap.subjective,
        objective: soap.objective,
        assessment: soap.assessment,
        plan: soap.plan,
      },
    });

    return NextResponse.json(record, { status: 201 });
  } catch (err) {
    // AI 调用可能失败：网络、超时、余额不足、返回结构不合规（zod 抛错）。
    // 这属于"上游依赖出问题"，用 502（Bad Gateway）比 500 更准确。
    console.error("create record error:", err);
    return NextResponse.json(
      { error: "AI 整理失败，请稍后重试" },
      { status: 502 },
    );
  }
}
