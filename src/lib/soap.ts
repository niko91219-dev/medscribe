import { z } from "zod";
import { llm, LLM_MODEL } from "@/lib/llm";

// SOAP 四段的结构。zod schema 一物两用：
// ① 编译期：z.infer 推出 TypeScript 类型；② 运行期：.parse() 校验 AI 返回的 JSON。
export const soapSchema = z.object({
  subjective: z.string(), // S 主观：主诉、症状、病史
  objective: z.string(), // O 客观：体征、检查结果、生命体征
  assessment: z.string(), // A 评估：诊断、判断
  plan: z.string(), // P 计划：治疗、用药、随访
});
export type Soap = z.infer<typeof soapSchema>;

const SYSTEM_PROMPT = `你是一名专业的病历整理助手。用户会给你一段原始的问诊记录，
请把它整理成规范的 SOAP 病历，包含四个部分：
- subjective（主观）：患者的主诉、症状描述、既往病史
- objective（客观）：可观察或可测量的体征、检查结果、生命体征
- assessment（评估）：医生的诊断与判断
- plan（计划）：治疗方案、用药、随访计划

只返回一个 JSON 对象，格式严格为：
{"subjective": "...", "objective": "...", "assessment": "...", "plan": "..."}
每个字段用简洁的中文。如果原始记录中某部分信息缺失，该字段填「（记录中未提及）」。`;

// 调 LLM 把原始记录整理成结构化 SOAP。
export async function generateSoap(rawText: string): Promise<Soap> {
  const completion = await llm.chat.completions.create({
    model: LLM_MODEL,
    response_format: { type: "json_object" }, // 让模型只吐 JSON，而不是带解释的自然语言
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: rawText },
    ],
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM 返回了空内容");
  }

  // 关键一步：AI 的输出不可全信。JSON.parse 可能抛（格式坏），zod .parse 可能抛（结构不对）。
  // 两道校验把"模型输出"这个不确定的东西，收敛成我们能信任的 Soap 类型。
  return soapSchema.parse(JSON.parse(content));
}
