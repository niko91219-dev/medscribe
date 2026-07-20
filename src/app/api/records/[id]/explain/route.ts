import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { explainStream } from "@/lib/explain";

// POST /api/records/[id]/explain —— 流式返回「患者版病情解释」。
// 返回的不是 JSON，而是一段边生成边下发的纯文本流（打字机效果的服务端一半）。
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
    // 归属校验（防 IDOR）：userId 进查询条件，不是你的病历就查不到 → 404。
    // ⚠️ 鉴权/校验必须在【开流之前】做完——流一旦开始，HTTP 状态码就改不了了。
    const record = await prisma.record.findFirst({
      where: { id, userId: session.user.id },
    });
    if (!record) {
      return NextResponse.json({ error: "病历不存在" }, { status: 404 });
    }

    const llmStream = await explainStream({
      subjective: record.subjective,
      objective: record.objective,
      assessment: record.assessment,
      plan: record.plan,
    });

    // 把 LLM 的流"二传"成 HTTP 响应流：收一块 → 编码 → enqueue 写进响应体。
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          for await (const chunk of llmStream) {
            const piece = chunk.choices[0]?.delta?.content ?? "";
            if (piece) controller.enqueue(encoder.encode(piece));
          }
          controller.close();
        } catch (err) {
          // 流已经开始，只能中断流（状态码改不了了）
          console.error("explain stream error:", err);
          controller.error(err);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        // 禁止中间层缓冲，确保边生成边到达
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    // 开流之前出错（鉴权后的建流失败等）→ 还能正常返回 JSON 错误
    console.error("explain setup error:", err);
    return NextResponse.json(
      { error: "生成解释失败，请稍后重试" },
      { status: 502 },
    );
  }
}
