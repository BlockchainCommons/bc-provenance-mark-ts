/**
 * `toUrl` appends the `provenance` parameter to the base's query text as
 * the reference's `append_pair` does, and `fromUrl` reads the first one.
 */
import { describe, expect, it } from "vitest";
import { ProvenanceMark, ProvenanceMarkError, ProvenanceMarkGenerator } from "../src";

const genesis = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf").next(
  new Date("2023-06-20T12:00:00Z"),
);
const value = genesis.toUrlEncoding();
const codeOf = (f: () => unknown): string => {
  try {
    f();
    return "ok";
  } catch (e) {
    return ProvenanceMarkError.isProvenanceMarkError(e) ? e.code : String(e);
  }
};

describe("toUrl", () => {
  it("appends to the query text as it stands", () => {
    const cases: [string, string][] = [
      ["https://example.com/", `https://example.com/?provenance=${value}`],
      ["https://example.com/?", `https://example.com/?provenance=${value}`],
      ["https://example.com/#frag", `https://example.com/?provenance=${value}#frag`],
      ["https://example.com/?q=a#b=c", `https://example.com/?q=a&provenance=${value}#b=c`],
      ["https://example.com/?q=a%20b", `https://example.com/?q=a%20b&provenance=${value}`],
      ["https://example.com/?q=a b", `https://example.com/?q=a%20b&provenance=${value}`],
      ["https://example.com/?a", `https://example.com/?a&provenance=${value}`],
      ["https://example.com/?a=b&c", `https://example.com/?a=b&c&provenance=${value}`],
      ["https://example.com/?x=%2f", `https://example.com/?x=%2f&provenance=${value}`],
      ["https://example.com/?q=a%ZZ", `https://example.com/?q=a%ZZ&provenance=${value}`],
      ["https://example.com/?q=%41", `https://example.com/?q=%41&provenance=${value}`],
      ["https://example.com/?q=a&", `https://example.com/?q=a&&provenance=${value}`],
      ["https://example.com/?&q=a", `https://example.com/?&q=a&provenance=${value}`],
      ["https://example.com/?q=a;b", `https://example.com/?q=a;b&provenance=${value}`],
      ["https://example.com/?q=a'b(c)~", `https://example.com/?q=a%27b(c)~&provenance=${value}`],
      ["https://example.com/?q==", `https://example.com/?q==&provenance=${value}`],
      ["https://example.com/??", `https://example.com/??&provenance=${value}`],
      [
        "https://example.com/?q=a&provenance=old&r=1",
        `https://example.com/?q=a&provenance=old&r=1&provenance=${value}`,
      ],
    ];
    for (const [base, expected] of cases) {
      expect(genesis.toUrl(base).toString(), base).toBe(expected);
      expect(genesis.toUrl(new URL(base)).toString(), base).toBe(expected);
    }
  });

  it("keeps an existing provenance parameter, which fromUrl then reads first", () => {
    const url = genesis.toUrl("https://example.com/?provenance=old&x=1");
    expect(url.searchParams.getAll("provenance")).toEqual(["old", value]);
    expect(codeOf(() => ProvenanceMark.fromUrl(url))).toBe("Bytewords");
    expect(ProvenanceMark.fromUrl(genesis.toUrl("https://example.com/?x=1")).equals(genesis)).toBe(
      true,
    );
  });
});
