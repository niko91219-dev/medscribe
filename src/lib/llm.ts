import OpenAI from "openai";

// 智谱 GLM 提供 OpenAI 兼容接口，所以直接用官方 openai SDK 指过去即可。
// baseURL 和模型名不是密钥，放代码里；只有 API key 从环境变量读（不进 git）。
//
// ⭐ 可移植性：换 provider（如通义千问）时，只改下面这两个常量 + .env 里的 key，
//    上层业务代码（soap.ts / API 路由 / 页面）一行都不用动。这就是"provider 只是一层"。
export const LLM_BASE_URL = "https://open.bigmodel.cn/api/paas/v4";
export const LLM_MODEL = "glm-4-flash"; // 智谱永久免费模型

export const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY,
  baseURL: LLM_BASE_URL,
});
