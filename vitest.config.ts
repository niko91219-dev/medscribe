import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  // tsconfigPaths 让测试里也能用 @/ 别名（对齐 tsconfig 的 paths）
  plugins: [tsconfigPaths()],
  test: {
    environment: "node", // 纯逻辑单测，不需要浏览器 DOM
    include: ["src/**/*.test.ts"],
    // icd.ts/embedding.ts 在模块加载时就 new OpenAI(...)，没 key 会 import 时抛错。
    // 纯函数测试不会真调用它们，喂假占位 key 让模块能加载即可。
    env: {
      LLM_API_KEY: "test-placeholder",
      DASHSCOPE_API_KEY: "test-placeholder",
      DATABASE_URL: "postgresql://test:test@localhost:5432/test",
      DIRECT_URL: "postgresql://test:test@localhost:5432/test",
    },
  },
});
