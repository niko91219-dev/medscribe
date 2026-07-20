import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { generateIcd, searchIcdCandidates } from "@/lib/icd";

// POST /api/records/[id]/icd —— 为某条病历生成 ICD 编码推荐并存回
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  try {
    // 归属校验（写操作版）：userId 进查询条件，查不到 = 不存在或不是你的。
    // 上次 IDOR 的教训在这里同样适用——不能让别人给你的病历写数据。
    const record = await prisma.record.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!record) {
      return NextResponse.json({ error: "病历不存在" }, { status: 404 });
    }

    // RAG 检索：按诊断(assessment)做语义检索，只取最相关的 top-20 候选，
    // 而不是全表塞给模型。码表大了也只喂这 20 条 → 省 token、更准。
    const catalog = await searchIcdCandidates(record.assessment, 20);

    // 根据这条病历的 SOAP + 码表生成 ICD 推荐
    const icd = await generateIcd(
      {
        subjective: record.subjective,
        objective: record.objective,
        assessment: record.assessment,
        plan: record.plan,
      },
      catalog,
    );

    // 存回该记录的 icd 字段（已确认归属，按 id 更新即可）
    await prisma.record.update({
      where: { id: record.id },
      data: { icd },
    });

    return NextResponse.json({ icd }, { status: 200 });
  } catch (err) {
    console.error("generate icd error:", err);
    return NextResponse.json(
      { error: "ICD 推荐失败，请稍后重试" },
      { status: 502 },
    );
  }
}
