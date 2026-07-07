import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// 服务端组件：直接在服务端查库并渲染。
export default async function RecordsPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  // 关键：where 里锁死 userId → 只查得到自己的病历。
  // 归属条件放进查询本身，从数据源头就杜绝越权（见详情页的说明）。
  const records = await prisma.record.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" }, // 最新的排最前
  });

  return (
    <main className="mx-auto max-w-2xl p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">我的病历</h1>
        <Link
          href="/records/new"
          className="rounded-md bg-black px-4 py-2 text-sm text-white"
        >
          + 新建
        </Link>
      </div>

      {records.length === 0 ? (
        // 空状态：新用户友好提示，而不是空白页
        <p className="mt-10 text-center text-black/50">
          还没有病历，点右上角「新建」试试 AI 整理。
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {records.map((r) => (
            <li key={r.id}>
              <Link
                href={`/records/${r.id}`}
                className="block rounded-md border border-black/10 p-4 hover:bg-black/5"
              >
                <div className="text-xs text-black/40">
                  {r.createdAt.toLocaleString("zh-CN")}
                </div>
                <div className="mt-1 line-clamp-1 font-medium">
                  {r.assessment /* 用「评估/诊断」当标题最能一眼认出 */}
                </div>
                <div className="mt-0.5 line-clamp-1 text-sm text-black/50">
                  {r.subjective}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="underline">
          ← 返回 dashboard
        </Link>
      </p>
    </main>
  );
}
