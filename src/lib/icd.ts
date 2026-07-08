import { z } from "zod";
import { llm, LLM_MODEL } from "@/lib/llm";
import type { Soap } from "@/lib/soap";

// 单条 ICD 推荐：编码 + 名称 + 推荐理由
export const icdSuggestionSchema = z.object({
  code: z.string(), // 如 J06.9
  title: z.string(), // 该编码对应的疾病名
  reason: z.string(), // 为什么根据这份病历推荐它
});
export type IcdSuggestion = z.infer<typeof icdSuggestionSchema>;
export type IcdList = IcdSuggestion[];

// ⚠️ 小坑：JSON 模式要求顶层是一个「对象」，不能直接是数组。
// 所以让模型返回 { "codes": [...] } 包一层，我们再取 .codes。
const icdResponseSchema = z.object({
  codes: z.array(icdSuggestionSchema),
});

const SYSTEM_PROMPT = `你是一名熟悉 ICD-10 编码的医疗编码助手。
用户会给你一份 SOAP 病历（重点看"评估/诊断"部分）。
请推荐最相关的 ICD-10 编码（1 到 5 个，按相关度从高到低排序）。

只返回一个 JSON 对象，格式严格为：
{"codes": [{"code": "J06.9", "title": "急性上呼吸道感染", "reason": "……"}]}
- code：ICD-10 编码
- title：该编码对应的中文疾病名称
- reason：为什么根据这份病历推荐它（简短中文）
如果病历信息不足以给出编码，codes 返回空数组 []。`;

// 根据 SOAP 病历推荐 ICD-10 编码列表。
export async function generateIcd(soap: Soap): Promise<IcdList> {
  const userContent = `主观：${soap.subjective}
客观：${soap.objective}
评估：${soap.assessment}
计划：${soap.plan}`;

  const completion = await llm.chat.completions.create({
    model: LLM_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回了空内容");
  }

  // 同样的双校验，取出 codes 数组
  return icdResponseSchema.parse(JSON.parse(content)).codes;
}
