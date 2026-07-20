import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  // transformers.js 依赖原生模块 onnxruntime-node（.node 二进制），
  // 不能被打包器打包，必须声明为服务端外部包，否则 API 路由运行时会报错。
  serverExternalPackages: ["@huggingface/transformers"],
};

export default nextConfig;
