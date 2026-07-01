"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);

    // 调 Auth.js 的 Credentials 登录。redirect:false 让我们自己处理跳转和报错。
    const res = await signIn("credentials", {
      email: String(form.get("email")),
      password: String(form.get("password")),
      redirect: false,
    });

    if (res?.error) {
      // 出于安全，不告诉用户具体是邮箱不存在还是密码错
      setError("邮箱或密码错误");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-6"
      >
        <h1 className="text-xl font-semibold">登录 MedScribe</h1>

        <input
          name="email"
          type="email"
          required
          placeholder="邮箱"
          className="w-full rounded-md border border-black/15 px-3 py-2"
        />
        <input
          name="password"
          type="password"
          required
          placeholder="密码"
          className="w-full rounded-md border border-black/15 px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black py-2 text-white disabled:opacity-50"
        >
          {loading ? "登录中…" : "登录"}
        </button>

        <p className="text-center text-sm text-black/60">
          还没账号？{" "}
          <Link href="/register" className="underline">
            去注册
          </Link>
        </p>
      </form>
    </main>
  );
}
