/**
 * The info type's JSON both ways and its Markdown summary, disambiguated
 * identifiers over repeated marks, the envelope summariser's reason, and
 * the resolution decoder's `u8` bounds.
 */
import { describe, expect, it } from "vitest";
import { CborError, cbor, decodeCbor } from "@blockchaincommons/dcbor";
import { Envelope } from "@blockchaincommons/envelope";
import { format } from "@blockchaincommons/envelope/format";
import {
  ProvenanceMark,
  ProvenanceMarkError,
  ProvenanceMarkGenerator,
  ProvenanceMarkInfo,
} from "../src";
import { resolutionFromCbor } from "../src/resolution.js";

const unhex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, "hex"));
const wolfChain = (res: "low" | "high", n: number): ProvenanceMark[] => {
  const g = ProvenanceMarkGenerator.fromPassphrase(res, "Wolf");
  return Array.from({ length: n }, (_, i) => g.next(new Date(Date.UTC(2023, 5, 20 + i, 12))));
};
const jsonFault = (json: unknown): string => {
  try {
    ProvenanceMarkInfo.fromJSON(json);
    return "accepted";
  } catch (e) {
    if (!ProvenanceMarkError.isProvenanceMarkError(e)) throw e;
    return `${e.code}|${e.message}`;
  }
};

describe("ProvenanceMarkInfo", () => {
  it("words a bad comment as serde does", () => {
    const base = ProvenanceMarkInfo.from(wolfChain("low", 1)[0]).toJSON();
    expect(jsonFault({ ...base, comment: 5 })).toBe(
      "Json|JSON error: invalid type: integer `5`, expected a string",
    );
    expect(jsonFault({ ...base, comment: null })).toBe(
      "Json|JSON error: invalid type: null, expected a string",
    );
    expect(jsonFault({ ...base, comment: ["a"] })).toBe(
      "Json|JSON error: invalid type: sequence, expected a string",
    );
    expect(jsonFault({ ...base, comment: { a: 1 } })).toBe(
      "Json|JSON error: invalid type: map, expected a string",
    );
    expect(ProvenanceMarkInfo.fromJSON({ ...base, comment: "c" }).comment).toBe("c");
    expect(ProvenanceMarkInfo.fromJSON(base).comment).toBe("");
  });

  it("round-trips through JSON and renders the summary", () => {
    const info = ProvenanceMarkInfo.from(wolfChain("low", 1)[0], "A comment.");
    const back = ProvenanceMarkInfo.fromJSON(JSON.parse(JSON.stringify(info)));
    expect(back.mark.equals(info.mark)).toBe(true);
    expect(back.toJSON()).toEqual(info.toJSON());
    expect(info.markdownSummary().split("\n")).toEqual([
      "---",
      "",
      "2023-06-20",
      "",
      `#### ${info.ur.toString()}`,
      "",
      `#### \`${info.bytewords}\``,
      "",
      info.bytemoji,
      "",
      "A comment.",
      "",
    ]);
  });
});

describe("disambiguatedIdBytewords", () => {
  it("extends only the colliding identifiers", () => {
    const [a, b] = wolfChain("low", 2);
    const ids = ProvenanceMark.disambiguatedIdBytewords([a, b, a], { prefix: true });
    expect(ids[0]).toBe(ids[2]);
    expect(ids[0].split(" ").length).toBe(33);
    expect(ids[1].split(" ").length).toBe(5);
    expect(ProvenanceMark.disambiguatedIdBytewords([])).toEqual([]);
  });
});

describe("the envelope summariser", () => {
  it("prints the decoder's reason for a tagged leaf that is not a mark", () => {
    const leaf = (hex: string): string => format(Envelope.leaf(decodeCbor(unhex(hex))));
    expect(leaf("da50524f56820950090bf2f8b96d116cf9e9983ade1d3705")).toBe(
      "<error: resolution serialization error: invalid provenance mark resolution value: 9>",
    );
    expect(leaf("da50524f56820043090bf2")).toBe(
      "<error: invalid message length: expected at least 16, got 3>",
    );
    expect(leaf("da50524f5619012c")).toBe(
      "<error: the decoded CBOR value was not the expected type>",
    );
    expect(format(Envelope.leaf(cbor(wolfChain("low", 1)[0])))).toMatch(
      /^ProvenanceMark\([0-9a-f]{64}\)$/,
    );
  });
});

describe("resolutionFromCbor", () => {
  it("reads the wire number as a u8", () => {
    expect(resolutionFromCbor(cbor(3))).toBe("high");
    expect(() => resolutionFromCbor(cbor(300))).toThrow(CborError);
    expect(() => resolutionFromCbor(cbor(300))).toThrow(
      "the CBOR numeric value could not be represented in the specified numeric type",
    );
    expect(() => resolutionFromCbor(cbor(2n ** 40n))).toThrow(CborError);
    expect(() => resolutionFromCbor(cbor(-1))).toThrow(
      "the decoded CBOR value was not the expected type",
    );
    expect(() => resolutionFromCbor(cbor(4))).toThrow(
      "invalid provenance mark resolution value: 4",
    );
  });
});
