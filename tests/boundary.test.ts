/**
 * The boundaries: what each decoder and constructor rejects, with which
 * code and message, and what the values refuse to do (mutate, alias).
 */
import { describe, expect, it } from "vitest";
import { cbor, encodeCbor } from "@blockchaincommons/dcbor";
import { Envelope, EnvelopeError } from "@blockchaincommons/envelope";
import { addType } from "@blockchaincommons/envelope/types";
import { UR } from "@blockchaincommons/uniform-resources";

import {
  PROVENANCE_MARK_ERROR_CODES,
  ProvenanceMark,
  ProvenanceMarkError,
  ProvenanceMarkGenerator,
  ProvenanceMarkInfo,
  ProvenanceSeed,
  RngState,
  dateToDisplay,
  dateToIso8601,
  deserializeDate,
  deserializeSeq,
  serializeDate,
  serializeSeq,
  expectDate,
  formatReport,
  parseDate,
  parseSeed,
  rangeOfDaysInMonth,
  resolutionFromCode,
  validate,
} from "../src";

const DATE = new Date("2023-06-20T12:00:00Z");
const wolf = (res: "low" | "medium" | "quartile" | "high" = "low") =>
  ProvenanceMarkGenerator.fromPassphrase(res, "Wolf");
const chain = (n: number, res: "low" | "medium" | "quartile" | "high" = "low") => {
  const g = wolf(res);
  return Array.from({ length: n }, (_, i) =>
    g.next(new Date(DATE.getTime() + i * 86_400_000), i % 2 === 1 ? `work ${i}` : undefined),
  );
};

const codeOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    if (ProvenanceMarkError.isProvenanceMarkError(e)) return e.code;
    return e instanceof Error ? e.constructor.name : typeof e;
  }
  return "no throw";
};
const messageOf = (fn: () => unknown): string => {
  try {
    fn();
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
  return "no throw";
};

describe("errors", () => {
  it("is an instance with a frozen, code-typed details record", () => {
    const e = ProvenanceMarkError.invalidKeyLength(4, 3);
    expect(ProvenanceMarkError.isProvenanceMarkError(e)).toBe(true);
    expect(ProvenanceMarkError.isProvenanceMarkError({ code: "InvalidKeyLength" })).toBe(false);
    expect(ProvenanceMarkError.isProvenanceMarkError(null)).toBe(false);
    expect(e.is("InvalidKeyLength")).toBe(true);
    expect(e.is("Cbor")).toBe(false);
    expect(Object.isFrozen(e.details)).toBe(true);
    expect(e.details).toEqual({ code: "InvalidKeyLength", expected: 4, actual: 3 });
    expect(e.name).toBe("ProvenanceMarkError");
  });

  it("lists every code once, frozen", () => {
    expect(Object.isFrozen(PROVENANCE_MARK_ERROR_CODES)).toBe(true);
    expect(new Set(PROVENANCE_MARK_ERROR_CODES).size).toBe(PROVENANCE_MARK_ERROR_CODES.length);
    for (const code of ["Bytewords", "Cbor", "Url", "Base64", "Json", "TryFromInt", "Envelope"]) {
      expect(PROVENANCE_MARK_ERROR_CODES).toContain(code);
    }
  });

  it("wraps sibling errors by their class and passes the rest through", () => {
    const own = ProvenanceMarkError.missingKey("x");
    expect(ProvenanceMarkError.wrapForeign(own)).toBe(own);
    const plain = new Error("plain");
    expect(ProvenanceMarkError.wrapForeign(plain)).toBe(plain);
    const wrapped = ProvenanceMarkError.wrapForeign(EnvelopeError.notLeaf());
    expect(ProvenanceMarkError.isProvenanceMarkError(wrapped) && wrapped.code).toBe("Envelope");
    expect((wrapped as ProvenanceMarkError).message).toMatch(/^envelope error: /);
    expect((wrapped as ProvenanceMarkError).cause).toBeInstanceOf(EnvelopeError);
  });

  it("words the wrapping codes as the reference does", () => {
    expect(ProvenanceMarkError.tryFromInt("out of range").message).toBe(
      "integer conversion error: out of range",
    );
    expect(ProvenanceMarkError.duplicateKey("k").message).toBe("duplicate key: k");
    expect(ProvenanceMarkError.invalidKey("k").message).toBe("invalid key: k");
    expect(ProvenanceMarkError.invalidNextKeyLength(4, 5).message).toBe(
      "invalid next key length: expected 4, got 5",
    );
  });
});

describe("dates", () => {
  it("parses strictly", () => {
    expect(parseDate("2023-6-8").toISOString()).toBe("2023-06-08T00:00:00.000Z");
    expect(parseDate("2023-06-20T12:00:00+02:00").toISOString()).toBe("2023-06-20T10:00:00.000Z");
    expect(codeOf(() => parseDate("2023-06-20T12:00:00"))).toBe("InvalidDate");
    expect(codeOf(() => parseDate("June 20, 2023"))).toBe("InvalidDate");
    expect(codeOf(() => parseDate("2023-02-29"))).toBe("InvalidDate");
    expect(messageOf(() => parseDate("nope"))).toBe(
      "invalid date: invalid ISO 8601 date string: Invalid date string",
    );
  });

  it("rejects a Date that holds no time everywhere", () => {
    const bad = new Date(Number.NaN);
    expect(codeOf(() => expectDate(bad))).toBe("InvalidDate");
    expect(codeOf(() => dateToIso8601(bad))).toBe("InvalidDate");
    expect(codeOf(() => dateToDisplay(bad))).toBe("InvalidDate");
    expect(codeOf(() => serializeDate("high", bad))).toBe("InvalidDate");
    expect(codeOf(() => expectDate("2023-06-20" as unknown as Date))).toBe("InvalidDate");
    expect(expectDate(DATE)).toBe(DATE);
  });

  it("names the codec that refuses a date", () => {
    expect(codeOf(() => serializeDate("low", new Date("2022-12-31T00:00:00Z")))).toBe(
      "YearOutOfRange",
    );
    expect(codeOf(() => serializeDate("low", new Date("2151-01-01T00:00:00Z")))).toBe(
      "YearOutOfRange",
    );
    expect(messageOf(() => serializeDate("medium", new Date("2000-12-31T00:00:00Z")))).toBe(
      "date out of range: seconds value too large for u32",
    );
    expect(messageOf(() => serializeDate("high", new Date("2000-12-31T00:00:00Z")))).toBe(
      "date out of range: milliseconds value too large for u64",
    );
    expect(messageOf(() => serializeDate("high", new Date(Date.UTC(10500, 0, 1))))).toBe(
      "date out of range: date exceeds maximum representable value",
    );
    expect(messageOf(() => deserializeDate("low", new Uint8Array(3)))).toBe(
      "resolution serialization error: invalid date length: expected 2, 4, or 6 bytes, got 3",
    );
    expect(codeOf(() => deserializeDate("low", new Uint8Array([0x7f, 0xff])))).toBe(
      "InvalidMonthOrDay",
    );
    expect(codeOf(() => deserializeDate("high", new Uint8Array(6).fill(0xff)))).toBe(
      "DateOutOfRange",
    );
  });

  it("displays at second precision, the date alone at midnight", () => {
    expect(dateToDisplay(new Date("2023-06-20T00:00:00.500Z"))).toBe("2023-06-20");
    expect(dateToDisplay(new Date("2023-06-20T12:00:00.999Z"))).toBe("2023-06-20T12:00:00Z");
    expect(rangeOfDaysInMonth(2024, 2)).toEqual({ min: 1, max: 29 });
    expect(rangeOfDaysInMonth(2023, 2)).toEqual({ min: 1, max: 28 });
  });
});

describe("resolutions and sequences", () => {
  it("rejects wire numbers outside 0 to 3", () => {
    expect(messageOf(() => resolutionFromCode(4))).toBe(
      "resolution serialization error: invalid provenance mark resolution value: 4",
    );
    expect(codeOf(() => resolutionFromCode(1.5))).toBe("ResolutionError");
    expect(codeOf(() => resolutionFromCode(-1))).toBe("ResolutionError");
  });

  it("rejects sequence numbers that are not u32, or too wide for the resolution", () => {
    expect(codeOf(() => serializeSeq("high", 1.5))).toBe("ResolutionError");
    expect(codeOf(() => serializeSeq("high", -1))).toBe("ResolutionError");
    expect(codeOf(() => serializeSeq("high", 2 ** 32))).toBe("ResolutionError");
    expect(messageOf(() => serializeSeq("low", 70_000))).toBe(
      "resolution serialization error: sequence number 70000 out of range for 2-byte format (max 65535)",
    );
    expect(deserializeSeq("medium", serializeSeq("medium", 2 ** 32 - 1))).toBe(2 ** 32 - 1);
    expect(messageOf(() => deserializeSeq("low", new Uint8Array(3)))).toBe(
      "resolution serialization error: invalid sequence number length: expected 2 or 4 bytes, got 3",
    );
  });
});

describe("seeds and RNG states", () => {
  it("take exactly 32 bytes", () => {
    expect(codeOf(() => ProvenanceSeed.from(new Uint8Array(31)))).toBe("InvalidSeedLength");
    expect(codeOf(() => ProvenanceSeed.from("x" as unknown as Uint8Array))).toBe("TypeError");
    expect(messageOf(() => RngState.from(new Uint8Array(1)))).toBe(
      "invalid RNG state length: expected 32 bytes, got 1 bytes",
    );
    expect(codeOf(() => RngState.from([] as unknown as Uint8Array))).toBe("TypeError");
  });

  it("decode from CBOR byte strings only, reporting as the reference's TryFrom does", () => {
    const seed = ProvenanceSeed.from(new Uint8Array(32).fill(7));
    expect(ProvenanceSeed.fromCbor(seed.toCbor()).equals(seed)).toBe(true);
    expect(seed.hex).toBe("07".repeat(32));
    expect(codeOf(() => ProvenanceSeed.fromCbor(cbor("text")))).toBe("Cbor");
    expect(messageOf(() => ProvenanceSeed.fromCbor(cbor(new Uint8Array(3))))).toBe(
      "invalid seed length: expected 32 bytes, got 3 bytes",
    );
    const state = RngState.from(new Uint8Array(32).fill(9));
    expect(RngState.fromCbor(state.toCbor()).equals(state)).toBe(true);
    expect(codeOf(() => RngState.fromCbor(cbor(1)))).toBe("Cbor");
    expect(messageOf(() => RngState.fromCbor(cbor(new Uint8Array(33))))).toBe(
      "invalid RNG state length: expected 32 bytes, got 33 bytes",
    );
  });

  it("are frozen and hand out copies", () => {
    const seed = ProvenanceSeed.random();
    expect(Object.isFrozen(seed)).toBe(true);
    const bytes = seed.bytes;
    bytes[0] ^= 0xff;
    expect(seed.bytes).not.toEqual(bytes);
    expect(codeOf(() => parseSeed("AAAA"))).toBe("Json");
  });
});

describe("base64 under parseSeed", () => {
  it("rejects with the reference's wording", () => {
    expect(messageOf(() => parseSeed("AA A="))).toBe("JSON error: Invalid symbol 32, offset 2.");
    expect(messageOf(() => parseSeed("A"))).toBe("JSON error: Invalid input length: 1");
    expect(messageOf(() => parseSeed("AAA"))).toBe("JSON error: Invalid padding");
    expect(messageOf(() => parseSeed("AAAA="))).toBe("JSON error: Invalid symbol 61, offset 4.");
    expect(messageOf(() => parseSeed("AB=="))).toBe(
      "JSON error: Invalid last symbol 66, offset 1.",
    );
    expect(messageOf(() => parseSeed("AAAA===="))).toBe("JSON error: Invalid symbol 61, offset 4.");
    expect(messageOf(() => parseSeed("AAAA-AAA"))).toBe("JSON error: Invalid symbol 45, offset 4.");
    expect(parseSeed("AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=").bytes).toEqual(
      new Uint8Array(32),
    );
  });
});

describe("marks", () => {
  it("are frozen and hand out copies", () => {
    const [mark] = chain(2);
    expect(Object.isFrozen(mark)).toBe(true);
    const date = mark.date;
    date.setUTCFullYear(1999);
    expect(mark.date.getUTCFullYear()).toBe(2023);
    const key = mark.key;
    key[0] ^= 0xff;
    expect(mark.key).not.toEqual(key);
    expect(Object.isFrozen(ProvenanceMark.codec)).toBe(true);
  });

  it("guard their arguments", () => {
    const [a, b] = chain(2);
    expect(codeOf(() => a.checkPrecedes("b" as unknown as ProvenanceMark))).toBe("TypeError");
    expect(codeOf(() => a.equals(null as unknown as ProvenanceMark))).toBe("TypeError");
    expect(codeOf(() => ProvenanceMark.isSequenceValid([a, 1 as unknown as ProvenanceMark]))).toBe(
      "TypeError",
    );
    expect(codeOf(() => ProvenanceMark.disambiguatedIdBytewords([a, {} as ProvenanceMark]))).toBe(
      "TypeError",
    );
    expect(codeOf(() => ProvenanceMark.fromMessage("bogus" as "low", a.message))).toBe(
      "RangeError",
    );
    expect(codeOf(() => ProvenanceMark.fromBytewords("bogus" as "low", a.toBytewords()))).toBe(
      "RangeError",
    );
    expect(
      codeOf(() =>
        ProvenanceMark.from({
          res: "bogus" as "low",
          key: a.key,
          nextKey: b.key,
          chainId: a.chainId,
          seq: 0,
          date: DATE,
        }),
      ),
    ).toBe("RangeError");
    expect(codeOf(() => a.idBytewords({ wordCount: 4.5 }))).toBe("RangeError");
    expect(codeOf(() => a.idBytemoji({ wordCount: 33 }))).toBe("RangeError");
    expect(codeOf(() => a.idBytewordsMinimal({ wordCount: 3 }))).toBe("RangeError");
  });

  it("check the chain and report why", () => {
    const [a, b, c] = chain(3);
    expect(a.precedes(b)).toBe(true);
    expect(a.precedes(c)).toBe(false);
    expect(ProvenanceMark.isSequenceValid([])).toBe(false);
    expect(ProvenanceMark.isSequenceValid([a])).toBe(false);
    expect(ProvenanceMark.isSequenceValid([a, b, c])).toBe(true);
    expect(ProvenanceMark.isSequenceValid([b, a])).toBe(false);
    const e = (() => {
      try {
        a.checkPrecedes(c);
      } catch (x) {
        return x as ProvenanceMarkError;
      }
      return undefined;
    })();
    expect(e?.is("Validation") && e.details.issue).toEqual({
      type: "SequenceGap",
      expected: 1,
      actual: 2,
    });
    expect(e?.message).toBe("validation error: sequence number gap: expected 1, got 2");
    // A genesis mark from another chain fails as a genesis in second place.
    const [other] = chain(1, "low");
    expect(codeOf(() => a.checkPrecedes(other))).toBe("Validation");
    expect(codeOf(() => a.checkPrecedes(ProvenanceMark.fromMessage("low", b.message)))).toBe(
      "no throw",
    );
  });

  it("take the tagged CBOR in fromCbor and the array in fromUntaggedCbor", () => {
    const [a] = chain(1, "medium");
    expect(ProvenanceMark.fromCbor(a.toCbor()).equals(a)).toBe(true);
    expect(ProvenanceMark.codec.decode(a.toCbor()).equals(a)).toBe(true);
    expect(ProvenanceMark.fromUntaggedCbor(a.untaggedCbor()).equals(a)).toBe(true);
    expect(ProvenanceMark.fromCborData(encodeCbor(a.toCbor())).equals(a)).toBe(true);
    expect(messageOf(() => ProvenanceMark.fromCbor(a.untaggedCbor()))).toBe(
      "the decoded CBOR value was not the expected type",
    );
    expect(codeOf(() => ProvenanceMark.fromUntaggedCbor(a.toCbor()))).toBe("Cbor");
    expect(messageOf(() => ProvenanceMark.fromUntaggedCbor(cbor([1, 2, 3])))).toBe(
      "Invalid provenance mark length",
    );
    expect(messageOf(() => ProvenanceMark.fromUntaggedCbor(cbor([4, new Uint8Array(32)])))).toBe(
      "resolution serialization error: invalid provenance mark resolution value: 4",
    );
    expect(codeOf(() => ProvenanceMark.fromCborData(new Uint8Array([0xff])))).toBe("Cbor");
    expect(codeOf(() => ProvenanceMark.fromCborData(new Uint8Array(0)))).toBe("Cbor");
  });

  it("take a provenance UR only", () => {
    const [a] = chain(1);
    expect(ProvenanceMark.fromUR(a.toUR()).equals(a)).toBe(true);
    expect(ProvenanceMark.fromUR(UR.parse(a.toUR().toString())).equals(a)).toBe(true);
    const other = UR.from("seed", a.untaggedCbor());
    expect(messageOf(() => ProvenanceMark.fromUR(other))).toBe(
      "expected UR type provenance, but found seed",
    );
    expect(codeOf(() => ProvenanceMark.fromUR(other))).toBe("Cbor");
    expect(codeOf(() => ProvenanceMark.fromUR(UR.from("provenance", cbor([1]))))).toBe("Cbor");
  });

  it("take an envelope whose subject leaf is a mark", () => {
    const [a] = chain(1, "quartile");
    expect(ProvenanceMark.fromEnvelope(a.toEnvelope()).equals(a)).toBe(true);
    expect(ProvenanceMark.fromEnvelope(a.toEnvelope().addAssertion("note", "x")).equals(a)).toBe(
      true,
    );
    expect(messageOf(() => ProvenanceMark.fromEnvelope(Envelope.from("hi").wrap()))).toMatch(
      /^CBOR error: envelope error: /,
    );
    expect(messageOf(() => ProvenanceMark.fromEnvelope(Envelope.from("hi")))).toBe(
      "CBOR error: the decoded CBOR value was not the expected type",
    );
    expect(codeOf(() => ProvenanceMark.fromEnvelope(Envelope.leaf(a.untaggedCbor())))).toBe("Cbor");
  });

  it("round-trip through URLs given as strings or URL objects", () => {
    const [a] = chain(1);
    const url = a.toUrl("https://example.com/?x=1");
    expect(url.searchParams.getAll("provenance")).toHaveLength(1);
    expect(ProvenanceMark.fromUrl(url).equals(a)).toBe(true);
    expect(ProvenanceMark.fromUrl(url.toString()).equals(a)).toBe(true);
    expect(ProvenanceMark.fromUrl(a.toUrl(new URL("https://example.com/"))).equals(a)).toBe(true);
    expect(codeOf(() => a.toUrl("nope"))).toBe("Url");
    expect(codeOf(() => ProvenanceMark.fromUrl("nope"))).toBe("Url");
    expect(messageOf(() => ProvenanceMark.fromUrl("https://example.com/"))).toBe(
      "missing required URL parameter: provenance",
    );
    expect(messageOf(() => ProvenanceMark.fromUrl("https://example.com/?provenance="))).toBe(
      "bytewords error: Bytewords error (invalid checksum)",
    );
    expect(codeOf(() => ProvenanceMark.fromUrlEncoding("zzzz"))).toBe("Bytewords");
    expect(codeOf(() => ProvenanceMark.fromBytewords("low", "able able"))).toBe("Bytewords");
    // Bytewords that decode to CBOR that is not a mark: a Cbor code with the reference's prefix.
    expect(messageOf(() => ProvenanceMark.fromUrlEncoding("aeadaolazmjendeoti"))).toMatch(
      /^CBOR error: /,
    );
  });

  it("read persisted JSON as the reference's serde type does", () => {
    const [a] = chain(2)[1] ? chain(2).slice(1) : chain(2);
    const json = a.toJSON();
    expect(ProvenanceMark.fromJSON(json).equals(a)).toBe(true);
    expect(ProvenanceMark.fromJSON({ ...json, extra: true }).equals(a)).toBe(true);
    expect(ProvenanceMark.fromJSON(JSON.parse(JSON.stringify(a))).equals(a)).toBe(true);
    expect(messageOf(() => ProvenanceMark.fromJSON(null))).toBe(
      "JSON error: invalid type: null, expected struct",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON([]))).toBe(
      "JSON error: invalid type: sequence, expected struct",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({}))).toBe("JSON error: missing field `res`");
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, res: true }))).toBe(
      "JSON error: invalid type: boolean `true`, expected u8",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, res: 256 }))).toBe(
      "JSON error: invalid value: integer `256`, expected u8",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, key: 5 }))).toBe(
      "JSON error: invalid type: integer `5`, expected a string",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, date: "2023-06-20T12:00:00" }))).toBe(
      "JSON error: invalid ISO 8601 date string: Invalid date string",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, info_bytes: "" }))).toBe(
      "JSON error: early end of CBOR data",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, info_bytes: {} }))).toBe(
      "JSON error: invalid type: map, expected a string",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, seq: 70_000 }))).toBe(
      "JSON error: resolution serialization error: sequence number 70000 out of range for 2-byte format (max 65535)",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, date: "2000-01-01" }))).toBe(
      "JSON error: year out of range for 2-byte serialization: must be between 2023-2150, got 2000",
    );
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...json, key: "AAAA=" }))).toBe(
      "JSON error: Invalid symbol 61, offset 4.",
    );
    const { chain_id: _dropped, ...withoutChainId } = json;
    expect(messageOf(() => ProvenanceMark.fromJSON({ ...withoutChainId, chainID: "AAAA" }))).toBe(
      "JSON error: missing field `chain_id`",
    );
  });

  it("render text info through diagnostic notation", () => {
    const g = wolf("high");
    const mark = g.next(DATE, 'a"b');
    expect(mark.toDebugString()).toContain('info: "a\\"b"');
    expect(g.next(DATE, new Map([[1, [2, 3]]])).toDebugString()).toMatch(
      /info: \{\s+1:\s+\[2, 3\]\s+\}\)$/,
    );
    expect(mark.toString()).toBe(`ProvenanceMark(${mark.idHex})`);
  });
});

describe("generators", () => {
  it("guard their arguments", () => {
    const g = wolf();
    expect(
      codeOf(() => ProvenanceMarkGenerator.from({ res: "bogus" as "low", seed: g.seed })),
    ).toBe("RangeError");
    expect(
      codeOf(() =>
        ProvenanceMarkGenerator.from({ res: "low", seed: "x" as unknown as ProvenanceSeed }),
      ),
    ).toBe("TypeError");
    const state = {
      res: g.res,
      seed: g.seed,
      chainId: g.chainId,
      nextSeq: g.nextSeq,
      rngState: g.rngState,
    };
    expect(ProvenanceMarkGenerator.fromState(state).toString()).toBe(g.toString());
    expect(codeOf(() => ProvenanceMarkGenerator.fromState({ ...state, seed: 1 as never }))).toBe(
      "TypeError",
    );
    expect(
      codeOf(() => ProvenanceMarkGenerator.fromState({ ...state, rngState: 1 as never })),
    ).toBe("TypeError");
    expect(codeOf(() => ProvenanceMarkGenerator.fromState({ ...state, chainId: 1 as never }))).toBe(
      "TypeError",
    );
    expect(codeOf(() => ProvenanceMarkGenerator.fromState({ ...state, nextSeq: 1.5 }))).toBe(
      "ResolutionError",
    );
    expect(codeOf(() => ProvenanceMarkGenerator.fromState({ ...state, nextSeq: 2 ** 32 }))).toBe(
      "ResolutionError",
    );
    expect(
      codeOf(() => ProvenanceMarkGenerator.fromState({ ...state, chainId: new Uint8Array(8) })),
    ).toBe("InvalidChainIdLength");
    expect(g.toString()).toMatch(
      /^ProvenanceMarkGenerator\(chainID: [0-9a-f]{8}, res: low, seed: [0-9a-f]{64}, nextSeq: 0, rngState: [0-9a-f]{64}\)$/,
    );
  });

  it("leave the state alone when the date is refused", () => {
    const g = wolf("low");
    g.next(DATE);
    const before = g.toJSON();
    expect(codeOf(() => g.next(new Date("2000-01-01T00:00:00Z")))).toBe("YearOutOfRange");
    expect(codeOf(() => g.next(new Date(Number.NaN)))).toBe("InvalidDate");
    expect(g.toJSON()).toEqual(before);
    expect(g.next(DATE).seq).toBe(1);
    expect(g.nextSeq).toBe(2);
  });

  it("read persisted JSON as the reference's serde type does", () => {
    const g = wolf("medium");
    g.next(DATE);
    const json = g.toJSON();
    const restored = ProvenanceMarkGenerator.fromJSON(json);
    expect(restored.toJSON()).toEqual(json);
    expect(restored.next(DATE).equals(g.next(DATE))).toBe(true);
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON(null))).toBe(
      "JSON error: invalid type: null, expected struct",
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON({ ...json, nextSeq: -1 }))).toBe(
      "JSON error: invalid value: integer `-1`, expected u32",
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON({ ...json, nextSeq: "1" }))).toBe(
      'JSON error: invalid type: string "1", expected u32',
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON({ ...json, seed: "AAAA" }))).toBe(
      "JSON error: seed length is 3, expected 32",
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON({ ...json, rngState: "AAAA" }))).toBe(
      "JSON error: seed length is 3, expected 32",
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON({ ...json, chainID: "AAAA" }))).toBe(
      "JSON error: invalid chain ID length: expected 8, got 3",
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON({ ...json, res: 9 }))).toBe(
      "JSON error: resolution serialization error: invalid provenance mark resolution value: 9",
    );
    const { rngState: _dropped, ...withoutState } = json;
    expect(messageOf(() => ProvenanceMarkGenerator.fromJSON(withoutState))).toBe(
      "JSON error: missing field `rngState`",
    );
  });

  it("read envelopes with exactly the five assertions, each of the right shape", () => {
    const g = wolf("low");
    g.next(DATE);
    const env = g.toEnvelope();
    expect(ProvenanceMarkGenerator.fromEnvelope(env).toJSON()).toEqual(g.toJSON());
    expect(codeOf(() => ProvenanceMarkGenerator.fromEnvelope("x" as unknown as Envelope))).toBe(
      "TypeError",
    );
    expect(messageOf(() => ProvenanceMarkGenerator.fromEnvelope(Envelope.from("x")))).toBe(
      "envelope error: Envelope is not a provenance-generator",
    );
    expect(
      messageOf(() => ProvenanceMarkGenerator.fromEnvelope(env.addAssertion("note", "x"))),
    ).toBe("wrong number of keys: expected 5, got 6");
    const typed = addType(Envelope.from(g.chainId), "provenance-generator");
    expect(codeOf(() => ProvenanceMarkGenerator.fromEnvelope(typed))).toBe("ExtraKeys");
    const shaped = (res: unknown, seed: unknown, nextSeq: unknown, rngState: unknown) =>
      typed
        .addAssertion("res", res as string)
        .addAssertion("seed", seed as string)
        .addAssertion("next-seq", nextSeq as string)
        .addAssertion("rng-state", rngState as string);
    const okState = g.rngState.bytes;
    expect(
      messageOf(() =>
        ProvenanceMarkGenerator.fromEnvelope(shaped("low", g.seed.bytes, 1, okState)),
      ),
    ).toBe("CBOR error: the decoded CBOR value was not the expected type");
    expect(
      messageOf(() =>
        ProvenanceMarkGenerator.fromEnvelope(shaped(0, new Uint8Array(3), 1, okState)),
      ),
    ).toBe("CBOR error: invalid seed length: expected 32 bytes, got 3 bytes");
    expect(
      messageOf(() => ProvenanceMarkGenerator.fromEnvelope(shaped(0, g.seed.bytes, -1, okState))),
    ).toBe("CBOR error: the decoded CBOR value was not the expected type");
    expect(
      messageOf(() =>
        ProvenanceMarkGenerator.fromEnvelope(shaped(0, g.seed.bytes, 2 ** 40, okState)),
      ),
    ).toBe("CBOR error: integer out of range");
    expect(
      messageOf(() =>
        ProvenanceMarkGenerator.fromEnvelope(shaped(0, g.seed.bytes, 1, new Uint8Array(2))),
      ),
    ).toBe("CBOR error: invalid RNG state length: expected 32 bytes, got 2 bytes");
    // A non-leaf object for a field.
    const nested = typed
      .addAssertion("res", Envelope.from(0).wrap())
      .addAssertion("seed", g.seed.bytes)
      .addAssertion("next-seq", 1)
      .addAssertion("rng-state", okState);
    expect(codeOf(() => ProvenanceMarkGenerator.fromEnvelope(nested))).toBe("Envelope");
    // A subject that is not bytes.
    const textSubject = addType(Envelope.from("chain"), "provenance-generator")
      .addAssertion("res", 0)
      .addAssertion("seed", g.seed.bytes)
      .addAssertion("next-seq", 1)
      .addAssertion("rng-state", okState);
    expect(codeOf(() => ProvenanceMarkGenerator.fromEnvelope(textSubject))).toBe("Cbor");
    // The same predicate twice.
    const doubled = typed
      .addAssertion("res", 0)
      .addAssertion("res", 1)
      .addAssertion("seed", g.seed.bytes)
      .addAssertion("rng-state", okState);
    expect(codeOf(() => ProvenanceMarkGenerator.fromEnvelope(doubled))).toBe("Envelope");
  });
});

describe("mark info", () => {
  it("guards its arguments and reads its JSON strictly", () => {
    const [mark] = chain(1);
    const info = ProvenanceMarkInfo.from(mark, "first");
    expect(Object.isFrozen(info)).toBe(true);
    expect(info.markdownSummary()).toContain("first");
    expect(ProvenanceMarkInfo.from(mark).markdownSummary()).not.toContain("first");
    expect(codeOf(() => ProvenanceMarkInfo.from("x" as unknown as ProvenanceMark))).toBe(
      "TypeError",
    );
    expect(codeOf(() => ProvenanceMarkInfo.from(mark, 1 as unknown as string))).toBe("TypeError");
    const json = info.toJSON();
    const back = ProvenanceMarkInfo.fromJSON(json);
    expect(back.mark.equals(mark)).toBe(true);
    expect(back.comment).toBe("first");
    expect(ProvenanceMarkInfo.fromJSON({ ...json, comment: undefined }).comment).toBe("");
    expect(messageOf(() => ProvenanceMarkInfo.fromJSON({ ...json, ur: undefined }))).toBe(
      "JSON error: missing field `ur`",
    );
    expect(codeOf(() => ProvenanceMarkInfo.fromJSON({ ...json, ur: "ur:seed/aeadao" }))).toBe(
      "Json",
    );
    expect(codeOf(() => ProvenanceMarkInfo.fromJSON({ ...json, ur: "not a ur" }))).toBe("Json");
    expect(codeOf(() => ProvenanceMarkInfo.fromJSON({ ...json, comment: 3 }))).toBe("Json");
    expect(codeOf(() => ProvenanceMarkInfo.fromJSON({ ...json, bytemoji: 3 }))).toBe("Json");
  });
});

describe("validation reports", () => {
  it("guard their input, freeze their output and reject unknown formats", () => {
    const marks = chain(3, "medium");
    const report = validate(marks);
    expect(Object.isFrozen(report)).toBe(true);
    expect(Object.isFrozen(report.chains)).toBe(true);
    expect(Object.isFrozen(report.chains[0])).toBe(true);
    expect(Object.isFrozen(report.chains[0].sequences[0].marks[0])).toBe(true);
    expect(codeOf(() => validate("x" as unknown as ProvenanceMark[]))).toBe("TypeError");
    expect(codeOf(() => validate([marks[0], 1 as unknown as ProvenanceMark]))).toBe("TypeError");
    expect(codeOf(() => formatReport(report, "xml" as "text"))).toBe("RangeError");
    expect(formatReport(report)).toBe("");
    expect(JSON.parse(formatReport(report, "jsonPretty"))).toEqual(
      JSON.parse(formatReport(report, "jsonCompact")),
    );
  });
});
