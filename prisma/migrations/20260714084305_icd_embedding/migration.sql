-- 启用 pgvector 扩展（Neon 预装，只需开启；每库一次，幂等）
CREATE EXTENSION IF NOT EXISTS vector;

-- AlterTable：给码表加向量列，存 title 的 embedding（1024 维）
ALTER TABLE "IcdCode" ADD COLUMN     "embedding" vector(1024);

-- ANN 索引（HNSW，余弦距离）。76 条其实用不到，数据量大才生效；
-- 放这里体现"向量检索怎么加速"，也是简历上的真实产物。
CREATE INDEX "IcdCode_embedding_idx" ON "IcdCode" USING hnsw (embedding vector_cosine_ops);
