import { describe, expect, it } from "vitest";
import { fetchAllPages } from "./paginate";

describe("fetchAllPages", () => {
  it("keeps asking until a short page, past the 1000-row API cap", async () => {
    const rows = Array.from({ length: 2345 }, (_, i) => i);
    const seen: [number, number][] = [];
    const all = await fetchAllPages(async (from, to) => {
      seen.push([from, to]);
      return { data: rows.slice(from, to + 1), error: null };
    }, 1000);
    expect(all).toHaveLength(2345);
    expect(seen).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
  });
  it("throws on an error page", async () => {
    await expect(fetchAllPages(async () => ({ data: null, error: { message: "x" } }))).rejects.toThrow("x");
  });
});
