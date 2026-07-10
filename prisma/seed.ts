import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { prisma } from "../src/lib/prisma";

// 读取同目录下的 ICD-10 子集数据
const here = path.dirname(fileURLToPath(import.meta.url));
const data = JSON.parse(
  readFileSync(path.join(here, "icd10-seed.json"), "utf8"),
) as { code: string; title: string }[];

async function main() {
  for (const { code, title } of data) {
    // upsert = 有则更新、无则创建。保证脚本【幂等】：重复跑不会插重复、不会报主键冲突。
    await prisma.icdCode.upsert({
      where: { code },
      update: { title },
      create: { code, title },
    });
  }
  const total = await prisma.icdCode.count();
  console.log(`✅ seed 完成，IcdCode 表现有 ${total} 条编码`);
}

main()
  .catch((e) => {
    console.error("seed 失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
