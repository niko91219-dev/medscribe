import { describe, it, expect } from "vitest";
import { reconcileIcd, type IcdCatalogEntry } from "@/lib/icd";

// 一个小码表当测试夹具
const catalog: IcdCatalogEntry[] = [
  { code: "J06.9", title: "急性上呼吸道感染" },
  { code: "I10", title: "原发性高血压" },
];

describe("reconcileIcd（白名单过滤 + 官方名覆盖）", () => {
  it("表内的 code 正常保留，并带上模型的 reason", () => {
    const out = reconcileIcd(
      [{ code: "J06.9", reason: "咳嗽流涕符合上感" }],
      catalog,
    );
    expect(out).toEqual([
      { code: "J06.9", title: "急性上呼吸道感染", reason: "咳嗽流涕符合上感" },
    ]);
  });

  it("表外编造的 code 被过滤掉（白名单核心防线）", () => {
    const out = reconcileIcd(
      [
        { code: "S72.9", reason: "模型编的骨折码" }, // 不在码表
        { code: "J06.9", reason: "这个在表内" },
      ],
      catalog,
    );
    expect(out).toHaveLength(1);
    expect(out[0].code).toBe("J06.9");
  });

  it("title 一律用码表官方名覆盖——哪怕模型给的 code 对、我们也不信它的名字", () => {
    // 模型只返回 code+reason，这里模拟即使混入错误也不影响：title 来自码表
    const out = reconcileIcd([{ code: "I10", reason: "血压高" }], catalog);
    expect(out[0].title).toBe("原发性高血压"); // 官方名，非模型给的
  });

  it("模型返回空数组 → 结果空数组", () => {
    expect(reconcileIcd([], catalog)).toEqual([]);
  });

  it("全部是表外码 → 结果空数组（没有任何漏网）", () => {
    const out = reconcileIcd(
      [
        { code: "X00", reason: "编的" },
        { code: "Y99", reason: "也是编的" },
      ],
      catalog,
    );
    expect(out).toEqual([]);
  });

  it("保持模型返回的顺序", () => {
    const out = reconcileIcd(
      [
        { code: "I10", reason: "先高血压" },
        { code: "J06.9", reason: "后上感" },
      ],
      catalog,
    );
    expect(out.map((c) => c.code)).toEqual(["I10", "J06.9"]);
  });
});
