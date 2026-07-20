import { pipeline, type FeatureExtractionPipeline } from "@huggingface/transformers";

// 本地 embedding：用 transformers.js 在本机跑开源中文向量模型，
// 完全离线、免费、不需要任何 API key。首次调用会自动下载模型（~100MB）并缓存。
//
// bge-small-zh-v1.5：中文语义 embedding，512 维，输出做了归一化（unit vector），
// 配合 pgvector 的余弦距离（vector_cosine_ops 索引）正好。
export const EMBEDDING_MODEL = "Xenova/bge-small-zh-v1.5";
export const EMBEDDING_DIM = 512; // 要和 schema 里的 vector(512) 一致

// 懒加载单例：模型只加载一次，后续复用（加载/下载很贵，绝不能每次都来）。
let extractorPromise: Promise<FeatureExtractionPipeline> | null = null;
function getExtractor(): Promise<FeatureExtractionPipeline> {
  extractorPromise ??= pipeline("feature-extraction", EMBEDDING_MODEL);
  return extractorPromise;
}

// 批量把文本转成向量。mean pooling + normalize，得到定长归一化向量。
export async function embedMany(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const extractor = await getExtractor();
  const output = await extractor(texts, { pooling: "mean", normalize: true });
  return output.tolist() as number[][];
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
