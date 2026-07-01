import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";

// 服务端组件：直接在服务端读会话。
export default async function DashboardPage() {
  const session = await auth();

  // 双保险：middleware 已经在外层拦了，这里再确认一次（防御式编程）。
  if (!session?.user) {
    redirect("/login");
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-6">
      <div className="text-center">
        <h1 className="text-2xl font-semibold">欢迎回来 👋</h1>
        <p className="mt-2 text-black/60">
          已登录：{session.user.email}
        </p>
        <p className="text-sm text-black/40">用户 ID：{session.user.id}</p>
      </div>

      {/* 退出登录用 server action：在服务端调用 signOut 并重定向 */}
      <form
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/login" });
        }}
      >
        <button className="rounded-md border border-black/15 px-4 py-2 text-sm">
          退出登录
        </button>
      </form>
    </main>
  );
}
