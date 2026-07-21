-- 部署上线：本地 bge-small(512维) 换成阿里百炼 text-embedding-v3(1024维)。
-- 换 embedding 模型 = 换语义坐标系，旧向量作废，删列重建、之后重灌。
DROP INDEX IF EXISTS "IcdCode_embedding_idx";
ALTER TABLE "IcdCode" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "IcdCode" ADD COLUMN "embedding" vector(1024);
CREATE INDEX "IcdCode_embedding_idx" ON "IcdCode" USING hnsw (embedding vector_cosine_ops);
