-- 改用本地 bge-small-zh-v1.5（512 维）替换原 1024 维方案。
-- embedding 列此时还没灌数据，直接删列重建最干净。
DROP INDEX IF EXISTS "IcdCode_embedding_idx";
ALTER TABLE "IcdCode" DROP COLUMN IF EXISTS "embedding";
ALTER TABLE "IcdCode" ADD COLUMN "embedding" vector(512);
CREATE INDEX "IcdCode_embedding_idx" ON "IcdCode" USING hnsw (embedding vector_cosine_ops);
