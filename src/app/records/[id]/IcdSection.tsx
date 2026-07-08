"use client";

import { useState } from "react";
import type { IcdList } from "@/lib/icd";

// 客户端组件：详情页里负责 ICD 推荐的交互块。
// initialIcd 来自服务端已存的数据（有就直接显示，不用再点一次）。
export default function IcdSection({
  recordId,
  initialIcd,
}: {
  recordId: string;
  initialIcd: IcdList | null;
}) {
  const [icd, setIcd] = useState<IcdList | null>(initialIcd);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setLoading(true);
    const res = await fetch(`/api/records/${recordId}/icd`, { method: "POST" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "推荐失败");
      setLoading(false);
      return;
    }
    const data = await res.json();
    setIcd(data.icd);
    setLoading(false);
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">ICD 编码推荐</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? "AI 推荐中…" : icd ? "重新推荐" : "AI 推荐 ICD 编码"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {icd && icd.length === 0 && (
        <p className="mt-3 text-sm text-black/50">信息不足，暂无编码建议。</p>
      )}

      {icd && icd.length > 0 && (
        <ul className="mt-3 space-y-2">
          {icd.map((c, i) => (
            <li key={i} className="rounded-md border border-black/10 p-3">
              <div className="flex items-baseline gap-2">
                <span className="rounded bg-black/80 px-1.5 py-0.5 font-mono text-xs text-white">
                  {c.code}
                </span>
                <span className="font-medium">{c.title}</span>
              </div>
              <p className="mt-1 text-sm text-black/50">{c.reason}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
