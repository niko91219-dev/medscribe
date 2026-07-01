"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "next-auth/react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const form = new FormData(e.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    const name = String(form.get("name"));

    // 1. 调我们自己写的注册接口
    const res = await fetch("/api/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email, password, name }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "注册失败");
      setLoading(false);
      return;
    }

    // 2. 注册成功后自动登录，再进 dashboard
    await signIn("credentials", { email, password, redirect: false });
    router.push("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/10 p-6"
      >
        <h1 className="text-xl font-semibold">注册 MedScribe</h1>

        <input
          name="name"
          type="text"
          placeholder="昵称（可选）"
          className="w-full rounded-md border border-black/15 px-3 py-2"
        />
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
          minLength={8}
          placeholder="密码（至少 8 位）"
          className="w-full rounded-md border border-black/15 px-3 py-2"
        />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-md bg-black py-2 text-white disabled:opacity-50"
        >
          {loading ? "注册中…" : "注册"}
        </button>

        <p className="text-center text-sm text-black/60">
          已有账号？{" "}
          <Link href="/login" className="underline">
            去登录
          </Link>
        </p>
      </form>
    </main>
  );
}
