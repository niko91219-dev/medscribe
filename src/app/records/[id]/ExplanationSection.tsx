"use client";

import { useState } from "react";

// 客户端组件：详情页里「患者版病情解释」的交互块。
// 点按钮 → 流式读取后端返回的文本 → 逐块累加到 state → 打字机效果。
export default function ExplanationSection({
  recordId,
}: {
  recordId: string;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setError("");
    setText("");
    setLoading(true);

    try {
      const res = await fetch(`/api/records/${recordId}/explain`, {
        method: "POST",
      });

      // 开流前的错误（401/404/502）是普通 JSON 响应，这里能读到 status
      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "生成失败");
        setLoading(false);
        return;
      }

      // 关键：不是 res.json()（那会等全部），而是逐块读响应体的流
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setText(acc); // 每收到一块就重渲染 → 字一个个冒出来
      }
    } catch {
      setError("网络中断，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">患者版病情解释</h2>
        <button
          onClick={generate}
          disabled={loading}
          className="rounded-md border border-black/15 px-3 py-1.5 text-sm disabled:opacity-50"
        >
          {loading ? "生成中…" : text ? "重新生成" : "AI 通俗解释"}
        </button>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {(text || loading) && (
        <p className="mt-3 whitespace-pre-wrap rounded-md border border-black/10 p-4 text-sm leading-relaxed">
          {text}
          {loading && <span className="animate-pulse">▍</span>}
        </p>
      )}
    </section>
  );
}
