"use client";

import { useState } from "react";
import Link from "next/link";

type Soap = {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
};

export default function NewRecordPage() {
  const [rawText, setRawText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [soap, setSoap] = useState<Soap | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSoap(null);
    setLoading(true);

    const res = await fetch("/api/records", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ rawText }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "整理失败");
      setLoading(false);
      return;
    }

    const record = await res.json();
    setSoap({
      subjective: record.subjective,
      objective: record.objective,
      assessment: record.assessment,
      plan: record.plan,
    });
    setLoading(false);
  }

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="text-2xl font-semibold">AI 病历整理</h1>
      <p className="mt-1 text-sm text-black/60">
        粘贴一段原始问诊记录，AI 会整理成 SOAP 四段并自动存档。
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-3">
        <textarea
          value={rawText}
          onChange={(e) => setRawText(e.target.value)}
          required
          rows={6}
          placeholder="例如：患者男，45岁，咳嗽三天伴低热37.8度，查体咽部充血……"
          className="w-full rounded-md border border-black/15 p-3"
        />
        <button
          type="submit"
          disabled={loading || !rawText.trim()}
          className="rounded-md bg-black px-4 py-2 text-white disabled:opacity-50"
        >
          {loading ? "AI 整理中…" : "AI 整理"}
        </button>
      </form>

      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

      {soap && (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">整理结果（已存档）</h2>
          {[
            { label: "S 主观 Subjective", value: soap.subjective },
            { label: "O 客观 Objective", value: soap.objective },
            { label: "A 评估 Assessment", value: soap.assessment },
            { label: "P 计划 Plan", value: soap.plan },
          ].map((f) => (
            <div key={f.label} className="rounded-md border border-black/10 p-4">
              <div className="text-xs font-medium text-black/50">{f.label}</div>
              <p className="mt-1 whitespace-pre-wrap">{f.value}</p>
            </div>
          ))}
        </section>
      )}

      <p className="mt-8 text-sm">
        <Link href="/dashboard" className="underline">
          ← 返回 dashboard
        </Link>
      </p>
    </main>
  );
}
