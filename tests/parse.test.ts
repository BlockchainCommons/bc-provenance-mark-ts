/**
 * `parseSeed` reads through the seed's serde form, as the reference's
 * `parse_seed` does: every fault is `Json` with serde's text.
 */
import { describe, expect, it } from "vitest";
import { ProvenanceMarkError, ProvenanceSeed, parseSeed } from "../src";

const rejects = (s: string): string => {
  try {
    parseSeed(s);
    return "accepted";
  } catch (e) {
    if (!ProvenanceMarkError.isProvenanceMarkError(e)) throw e;
    return `${e.code}|${e.message}`;
  }
};

describe("parseSeed", () => {
  it("reads a 32-byte base64 seed", () => {
    const seed = parseSeed("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=");
    expect(seed.equals(ProvenanceSeed.from(new Uint8Array(32)))).toBe(true);
  });

  it("reports bad base64 and the wrong length as Json with serde's text", () => {
    expect(rejects("!!!!")).toBe("Json|JSON error: Invalid symbol 33, offset 0.");
    expect(rejects("AAAA")).toBe("Json|JSON error: seed length is 3, expected 32");
    expect(rejects("A".repeat(43))).toBe("Json|JSON error: Invalid padding");
    expect(rejects("")).toBe("Json|JSON error: seed length is 0, expected 32");
    expect(rejects(" AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=")).toBe(
      "Json|JSON error: Invalid symbol 32, offset 0.",
    );
  });

  it("rejects a non-string with a TypeError", () => {
    expect(() => parseSeed(42 as unknown as string)).toThrow(TypeError);
  });
});
