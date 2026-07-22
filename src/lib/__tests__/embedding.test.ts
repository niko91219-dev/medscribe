import { describe, it, expect } from "vitest";
import { toVectorLiteral } from "@/lib/embedding";

describe("toVectorLiteral（number[] → pgvector 字面量）", () => {
  it("普通向量转成 [a,b,c] 形式", () => {
    expect(toVectorLiteral([0.1, 0.2, 0.3])).toBe("[0.1,0.2,0.3]");
  });

  it("空数组 → []", () => {
    expect(toVectorLiteral([])).toBe("[]");
  });

  it("单元素", () => {
    expect(toVectorLiteral([1])).toBe("[1]");
  });

  it("负数与整数混合", () => {
    expect(toVectorLiteral([-0.5, 0, 2])).toBe("[-0.5,0,2]");
  });
});
