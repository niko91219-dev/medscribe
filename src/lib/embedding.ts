import OpenAI from "openai";

// Embedding（文本向量化）走阿里百炼（DashScope），OpenAI 兼容接口。
// 为什么用云端而不是本地模型：本地模型（onnxruntime 原生模块 + 100MB）在
// Vercel serverless 上跑不了（无常驻进程、冷启动重载）。云端 API 无此限制。
//
// ⚠️ 铁律：embedding 模型必须"从一而终"——灌库和查询用【同一个模型】。
// 不同模型的向量在不同语义坐标系，不可比。所以本地开发也调百炼（同一个 key），
// 保证和库里存的向量同源。
//
// embedding 模型 ≠ 聊天模型：聊天 text→text（生成）；embedding text→向量（表示）。
// 所以这里单独建一个指向 DashScope 的客户端，和 llm.ts 的 GLM 聊天客户端分开。
const dashscope = new OpenAI({
  apiKey: process.env.DASHSCOPE_API_KEY,
  baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1",
});

export const EMBEDDING_MODEL = "text-embedding-v3";
export const EMBEDDING_DIM = 1024; // 要和 schema 里的 vector(1024) 一致

// 批量把文本转成向量。DashScope 单批有上限，保守按 10 条一批分批。
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const res = await dashscope.embeddings.create({
      model: EMBEDDING_MODEL,
      input: batch,
      dimensions: EMBEDDING_DIM,
      encoding_format: "float",
    });
    // 按 index 排序，确保和输入顺序对齐（不依赖接口返回顺序）
    const sorted = [...res.data].sort((a, b) => a.index - b.index);
    out.push(...sorted.map((d) => d.embedding));
  }
  return out;
}

// 单条文本转向量。
export async function embed(text: string): Promise<number[]> {
  const [v] = await embedMany([text]);
  return v;
}

// 把 number[] 转成 pgvector 认的字面量：'[0.1,0.2,...]'。
// 写入/查询时配合 ::vector 强转使用。
export function toVectorLiteral(v: number[]): string {
  return `[${v.join(",")}]`;
}
