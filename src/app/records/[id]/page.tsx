import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import type { IcdList } from "@/lib/icd";
import IcdSection from "./IcdSection";
import ExplanationSection from "./ExplanationSection";

// Next.js 16：动态路由的 params 是 Promise，要 await。
export default async function RecordDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // ⭐ 归属校验的正确姿势：把 userId 放进查询条件本身。
  // 这样"不是我的记录"和"记录不存在"一样都查不到 → 统一 notFound。
  // 对比错误写法：findUnique({where:{id}}) 先查出来、再 if(record.userId !== me) 判断——
  //   一旦哪天忘了那句 if，就成了越权漏洞（IDOR：改 URL 里的 id 就能看别人的病历）。
  // 把权限收进查询，从源头堵死，比"查出来再判断"更不容易出错。
  const record = await prisma.record.findFirst({
    where: { id, userId: session.user.id },
  });

  if (!record) {
    notFound(); // 不存在 或 不属于我 → 404（也不泄露"这条存在但你无权看"）
  }

  const soap = [
    { label: "S 主观 Subjective", value: record.subjective },
    { label: "O 客观 Objective", value: record.objective },
    { label: "A 评估 Assessment", value: record.assessment },
    { label: "P 计划 Plan", value: record.plan },
  ];

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="text-xs text-black/40">
        {record.createdAt.toLocaleString("zh-CN")}
      </div>
      <h1 className="mt-1 text-2xl font-semibold">病历详情</h1>

      <section className="mt-6 space-y-4">
        {soap.map((f) => (
          <div key={f.label} className="rounded-md border border-black/10 p-4">
            <div className="text-xs font-medium text-black/50">{f.label}</div>
            <p className="mt-1 whitespace-pre-wrap">{f.value}</p>
          </div>
        ))}
      </section>

      {/* icd 存在 Json 列里，读出来是 JsonValue；我们存的就是 IcdList，安全地断言类型 */}
      <IcdSection
        recordId={record.id}
        initialIcd={(record.icd as IcdList | null) ?? null}
      />

      <ExplanationSection recordId={record.id} />

      <details className="mt-6">
        <summary className="cursor-pointer text-sm text-black/50">
          查看原始记录
        </summary>
        <p className="mt-2 whitespace-pre-wrap rounded-md bg-black/5 p-3 text-sm">
          {record.rawText}
        </p>
      </details>

      <p className="mt-8 text-sm">
        <Link href="/records" className="underline">
          ← 返回列表
        </Link>
      </p>
    </main>
  );
}
