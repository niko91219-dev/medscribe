import { z } from "zod";
import { llm, LLM_MODEL } from "@/lib/llm";
import type { Soap } from "@/lib/soap";

// 存进 Record.icd / 展示用的结构
export type IcdSuggestion = { code: string; title: string; reason: string };
export type IcdList = IcdSuggestion[];

// 码表条目（从数据库 IcdCode 表查出来传进来）
export type IcdCatalogEntry = { code: string; title: string };

// 模型只需返回 code + reason —— title 我们用码表里的【官方名称】，不信模型给的。
const modelResponseSchema = z.object({
  codes: z.array(z.object({ code: z.string(), reason: z.string() })),
});

function buildSystemPrompt(catalog: IcdCatalogEntry[]): string {
  const list = catalog.map((c) => `${c.code} ${c.title}`).join("\n");
  return `你是一名 ICD-10 编码助手。用户会给你一份 SOAP 病历。
请从下面这份【ICD-10 编码表】里，挑出与病历最相关的编码（1 到 5 个，按相关度从高到低排序）。

【ICD-10 编码表】
${list}

严格要求：
- code 只能从上表中选，【绝对不能】编造表中没有的编码。
- 只返回一个 JSON 对象：{"codes": [{"code": "J06.9", "reason": "简短中文理由"}]}
- 若表中没有合适编码，codes 返回空数组 []。`;
}

// grounding：把权威码表喂给模型，约束它只能从表里选，从源头杜绝幻觉。
export async function generateIcd(
  soap: Soap,
  catalog: IcdCatalogEntry[],
): Promise<IcdList> {
  const userContent = `主观：${soap.subjective}
客观：${soap.objective}
评估：${soap.assessment}
计划：${soap.plan}`;

  const completion = await llm.chat.completions.create({
    model: LLM_MODEL,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: buildSystemPrompt(catalog) },
      { role: "user", content: userContent },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回了空内容");
  }

  const { codes } = modelResponseSchema.parse(JSON.parse(content));

  // 二次校验（防御纵深）：即使 prompt 里要求"只从表里选"，模型仍可能违规。
  // 用码表做权威过滤——只保留表里真实存在的 code，并用【官方 title】覆盖模型说法。
  const titleByCode = new Map(catalog.map((c) => [c.code, c.title]));
  return codes
    .filter((c) => titleByCode.has(c.code))
    .map((c) => ({
      code: c.code,
      title: titleByCode.get(c.code)!,
      reason: c.reason,
    }));
}
