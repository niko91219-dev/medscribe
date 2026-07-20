import { llm, LLM_MODEL } from "@/lib/llm";
import type { Soap } from "@/lib/soap";

// 把专业 SOAP 病历翻译成患者能看懂的大白话。
// ⚠️ 和 generateSoap/generateIcd 不同：这里【不用】JSON 模式——输出是自由散文，
//    正因为是散文，才适合"流式"（一个字一个字吐）。JSON 必须收全才能 parse，不能流式。
const SYSTEM_PROMPT = `你是一名耐心的医生助理。用户会给你一份专业的 SOAP 病历。
请用通俗易懂的大白话，向【患者本人】解释这份病历：得的是什么病、检查说明了什么、
接下来要怎么治疗和注意什么。要求：
- 避免专业术语，必须用时要顺带解释一句；
- 语气温和、安抚，像面对面跟病人说话；
- 用连贯的自然段，别用条目符号；
- 不要新增病历里没有的诊断或用药信息。`;

// 返回 OpenAI 的【流式】响应（一个 async iterable）。stream:true 是关键。
// 调用方（路由）用 for await 逐块取 delta.content，边收边转发给浏览器。
export async function explainStream(soap: Soap) {
  return llm.chat.completions.create({
    model: LLM_MODEL,
    stream: true, // ← 流式：模型逐块吐，而不是等全部生成完
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `主观：${soap.subjective}
客观：${soap.objective}
评估：${soap.assessment}
计划：${soap.plan}`,
      },
    ],
  });
}
