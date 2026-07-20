import "dotenv/config";
import { prisma } from "../src/lib/prisma";
import { embedMany, toVectorLiteral } from "../src/lib/embedding";

// 【离线建索引】给码表每条 title 算 embedding 并写入 embedding 列。
// 这是 RAG 的"离线"一半：向量提前算好存着，在线检索时才快。
// 幂等：重复跑只是覆盖 embedding，不会出错。码表更新后补跑即可。
async function main() {
  const codes = await prisma.icdCode.findMany({
    select: { code: true, title: true },
  });
  console.log(`读到 ${codes.length} 条码表，开始算向量…`);

  // 批量向量化（embedMany 内部按 64 条自动分批）
  const vectors = await embedMany(codes.map((c) => c.title));

  // 逐条写回。向量列 Prisma 不认，走原生 SQL + ::vector 强转。
  for (let i = 0; i < codes.length; i++) {
    const literal = toVectorLiteral(vectors[i]);
    await prisma.$executeRaw`
      UPDATE "IcdCode" SET embedding = ${literal}::vector WHERE code = ${codes[i].code}
    `;
  }

  const filled = await prisma.$queryRaw<{ count: bigint }[]>`
    SELECT count(*)::int AS count FROM "IcdCode" WHERE embedding IS NOT NULL
  `;
  console.log(`✅ 已灌向量，embedding 非空的有 ${filled[0].count} 条`);
}

main()
  .catch((e) => {
    console.error("embed-icd 失败:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
