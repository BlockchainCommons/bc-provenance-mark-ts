/**
 * The corpus and its golden subset: seeded chains at every resolution
 * with dates across the representable range and with text, CBOR and no
 * info; every decode form of every golden mark plus corrupted forms;
 * validation over chains, gaps, duplicates and mixed chains, in every
 * report format; the date codecs at their edges; persisted JSON and
 * envelope state; URLs; CBOR given to each decoder; identifiers; the date
 * parser; seed and RNG-state decoding; the JavaScript input domain.
 */
import type { Recipe, Resolution, MarkSpec } from "../vectors/recipes";
import { DOMAIN_CASES } from "../vectors/working-tree-adapter";

export const RESOLUTIONS: readonly Resolution[] = ["low", "medium", "quartile", "high"];
const SEEDS = [
  "0000000000000000000000000000000000000000000000000000000000000000",
  "ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
  "e9f1ab8b0f7f9c4b7c3e0c5d7f2a4b6d8e1f3a5b7c9d0e2f4a6b8c0d2e4f6a8b",
  "0102030405060708090a0b0c0d0e0f101112131415161718191a1b1c1d1e1f20",
];
const PASSPHRASES = ["Wolf", "", "correct horse battery staple", "日本語"];
const BASE_DATES = [
  "2023-06-20T12:00:00Z",
  "1970-01-01T00:00:00Z",
  "2000-02-29T23:59:59Z",
  "2099-12-31T00:00:00Z",
];

const dayAfter = (iso: string, days: number): string =>
  new Date(Date.parse(iso) + days * 86_400_000).toISOString();
const chain = (base: string, n: number, info: boolean): MarkSpec[] =>
  Array.from({ length: n }, (_, i) => ({
    date: dayAfter(base, i),
    ...(info ? { info: `Lorem ipsum ${i}` } : {}),
  }));

/** The reference's own chains: passphrase "Wolf", ten daily marks from 2023-06-20 12:00 UTC. */
export function* referenceChains(): Generator<Recipe> {
  for (const res of RESOLUTIONS)
    for (const info of [false, true])
      yield {
        k: "generator",
        res,
        passphrase: "Wolf",
        marks: chain("2023-06-20T12:00:00Z", 10, info).map((m) =>
          info ? { ...m, info: "Lorem ipsum sit dolor amet." } : m,
        ),
      };
}

export function* hand(): Generator<Recipe> {
  yield* referenceChains();
  for (const res of RESOLUTIONS) {
    for (const seed of SEEDS)
      yield { k: "generator", res, seed, marks: chain(BASE_DATES[0], 4, false) };
    for (const passphrase of PASSPHRASES)
      yield { k: "generator", res, passphrase, marks: chain(BASE_DATES[0], 3, true) };
    for (const base of BASE_DATES)
      yield { k: "generator", res, seed: SEEDS[2], marks: chain(base, 2, false) };
    for (const date of [
      "2023-06-20T00:00:00Z",
      "2023-06-20T12:34:56Z",
      "1970-01-01T00:00:00Z",
      "2100-01-01T00:00:00Z",
      "2262-04-11T00:00:00Z",
      "1969-12-31T23:59:59Z",
    ]) {
      yield { k: "date", res, date };
    }
    for (const bytes of [
      "0000",
      "ffff",
      "00000000",
      "ffffffff",
      "000000000000",
      "ffffffffffff",
      "01",
      "",
    ])
      yield { k: "date", res, bytes };
  }
}

/** Marks materialised once (by the corpus consumer) for decode and validation recipes. */
export interface Materialized {
  /** message hex per (res, index) of the reference "Wolf" chain without info */
  messages: Record<Resolution, string[]>;
  cbor: Record<Resolution, string[]>;
  ur: Record<Resolution, string[]>;
  url: Record<Resolution, string[]>;
  bytewords: Record<Resolution, string[]>;
}

export function* decodeRecipes(m: Materialized): Generator<Recipe> {
  for (const res of RESOLUTIONS) {
    for (let i = 0; i < 3; i++) {
      yield { k: "decode", form: "message", res, s: m.messages[res][i] };
      yield { k: "decode", form: "cbor", res, s: m.cbor[res][i] };
      yield { k: "decode", form: "ur", res, s: m.ur[res][i] };
      yield { k: "decode", form: "url", res, s: m.url[res][i] };
      yield { k: "decode", form: "bytewords", res, s: m.bytewords[res][i] };
    }
    const msg = m.messages[res][0];
    // corruptions: truncated, one byte flipped in the key/hash/date/seq, wrong resolution
    yield { k: "decode", form: "message", res, s: msg.slice(0, msg.length - 2) };
    yield { k: "decode", form: "message", res, s: msg.slice(0, 8) };
    yield { k: "decode", form: "message", res, s: "" };
    for (const pos of [0, 2, 8, 16, msg.length - 2]) {
      const b = (parseInt(msg.slice(pos, pos + 2), 16) ^ 0xff).toString(16).padStart(2, "0");
      yield { k: "decode", form: "message", res, s: msg.slice(0, pos) + b + msg.slice(pos + 2) };
    }
    yield { k: "decode", form: "message", res: res === "low" ? "high" : "low", s: msg };
    yield { k: "decode", form: "bytewords", res, s: "not bytewords at all" };
    yield { k: "decode", form: "url", res, s: "%%%" };
    yield { k: "decode", form: "ur", res, s: "ur:provenance/nope" };
    yield { k: "decode", form: "cbor", res, s: "ff" };
  }
}

export function* validateRecipes(m: Materialized): Generator<Recipe> {
  for (const res of RESOLUTIONS) {
    const c = m.messages[res];
    yield { k: "validate", res, chains: [c] };
    yield { k: "validate", res, chains: [c.slice(0, 3)] };
    yield { k: "validate", res, chains: [[c[0], c[1], c[3]]] };
    yield { k: "validate", res, chains: [[c[1], c[2], c[3]]] };
    yield { k: "validate", res, chains: [[c[0], c[0], c[1]]] };
    yield { k: "validate", res, chains: [[c[2], c[0], c[1]]] };
    yield { k: "validate", res, chains: [c.slice(0, 2), c.slice(0, 2)] };
    yield { k: "validate", res, chains: [[]] };
    yield { k: "validate", res, chains: [[c[0]]] };
  }
  // mixed chains across resolutions are decoded per their own resolution by the adapter (same res per recipe)
}

export function* generated(): Generator<Recipe> {
  let x = 0x9e3779b1 >>> 0;
  const next = (): number => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x;
  };
  for (let i = 0; i < 120; i++) {
    const res = RESOLUTIONS[next() % 4];
    const seed = Array.from({ length: 32 }, () =>
      (next() & 0xff).toString(16).padStart(2, "0"),
    ).join("");
    const base = new Date(946_684_800_000 + (next() % 3_000_000_000) * 1000).toISOString();
    const n = 1 + (next() % 5);
    yield { k: "generator", res, seed, marks: chain(base, n, next() % 2 === 0) };
  }
}

// Persisted state, URLs, decoders, identifiers, parsing, the input domain ----

/** The reference "Wolf" chain's genesis mark at low resolution, in every form. */
const LOW = {
  tagged: "da50524f56820050090bf2f8b96d116cf9e9983ade1d3705",
  untagged: "820050090bf2f8b96d116cf9e9983ade1d3705",
  ur: "ur:provenance/lfaegdasbdwzyarhjnbyjzytwlmkftuecaemahwmfgaxcl",
  url: "tngdgmgwhflfaegdasbdwzyarhjnbyjzytwlmkftuecaemahdpbswmkb",
  bytewords:
    "axis bald whiz yoga rich join body jazz yurt wall monk fact urge cola exam arch kick fuel omit echo",
  json: {
    seq: 0,
    date: "2023-06-20",
    res: 0,
    chain_id: "CQvy+A==",
    key: "CQvy+A==",
    hash: "W9zsgQ==",
  },
};
const HIGH_JSON = {
  seq: 0,
  date: "2023-06-20T12:00:00Z",
  res: 3,
  chain_id: "CQvy+LVb5FtGYbJLfpw0DPlGTF/pXIT1gJVKqr4IXnw=",
  key: "CQvy+LVb5FtGYbJLfpw0DPlGTF/pXIT1gJVKqr4IXnw=",
  hash: "RYD3dTD3EBGuE1XGcG7W0+o2gXAFnL4e6akUAGFTTAI=",
  info_bytes: "Ymhp",
};
/** The reference "Wolf" generator at low resolution after its genesis mark. */
const GEN_JSON = {
  res: 0,
  seed: "znwVmbBQb1+QkeD8p5ak890F+UMrzoC5Ke2E1lh0zhA=",
  chainID: "CQvy+A==",
  nextSeq: 1,
  rngState: "NP1R6mPh5Gsz5KjGVReUxRnM4u3NohBbR1jomiWZCCw=",
};

/** CBOR info payloads, as their encoded bytes: a map, an array, a tag, bytes, numbers, quoted and multi-line text. */
const INFO_CBOR = [
  "a1616101",
  "820102",
  "c100",
  "4100",
  "182a",
  "f5",
  "f6",
  "66e697a5e69cac",
  "60",
  "a161628201a161636164",
  "f93e00",
  "20",
  "d99c4001",
  "6a6d756c74690a6c696e65",
  "63612262",
];

/** Chains carrying CBOR info payloads and a text payload with a quote. */
export function* infoChains(): Generator<Recipe> {
  for (const res of ["low", "high"] as const) {
    for (const infoHex of INFO_CBOR)
      yield { k: "generator", res, passphrase: "Wolf", marks: [{ date: BASE_DATES[0], infoHex }] };
    yield {
      k: "generator",
      res,
      passphrase: "Wolf",
      marks: [{ date: BASE_DATES[0], info: 'a"b' }],
    };
  }
}

/** Mark and generator JSON: the reference's own shape and every leniency. */
export function* jsonRecipes(): Generator<Recipe> {
  const mark = (json: Record<string, unknown>): Recipe => ({ k: "json", target: "mark", json });
  const gen = (json: Record<string, unknown>): Recipe => ({ k: "json", target: "generator", json });
  yield mark(LOW.json);
  yield mark(HIGH_JSON);
  for (const date of [
    "2023-06-20T12:00:00Z",
    "2023-06-20",
    "2023-06-20T12:00:00.5Z",
    "2023-06-20T14:00:00+02:00",
    "2023-06-20T12:00:00",
    "June 20, 2023",
    "2023-06-20 12:00:00",
    "2023-02-29",
    "1690000000",
    "",
    "not a date",
    "2023-06-20T12:00:00z",
  ])
    yield mark({ ...LOW.json, date });
  const { chain_id: chainId, ...withoutChainId } = LOW.json;
  yield mark({ ...withoutChainId, chainID: chainId });
  yield mark(withoutChainId);
  yield mark({ ...LOW.json, info_bytes: "" });
  yield mark({ ...LOW.json, info_bytes: "////" });
  yield mark({ ...LOW.json, info_bytes: "Ymhp" });
  yield mark({ ...LOW.json, res: 5 });
  yield mark({ ...LOW.json, res: "low" });
  yield mark({ ...LOW.json, res: "1" });
  const { hash: _hash, ...withoutHash } = LOW.json;
  yield mark(withoutHash);
  for (const seq of [70000, -1, 1.5, "0"]) yield mark({ ...LOW.json, seq });
  yield mark({ ...LOW.json, key: "AAAA" });
  yield mark({ ...LOW.json, key: "not base64!" });
  yield mark({ ...LOW.json, extra: 1 });
  yield gen(GEN_JSON);
  for (const nextSeq of [-1, 1.5, 4294967295, 4294967296, "1"]) yield gen({ ...GEN_JSON, nextSeq });
  yield gen({ ...GEN_JSON, chainID: "AAAA" });
  const { chainID: genChainId, ...genWithoutChainId } = GEN_JSON;
  yield gen({ ...genWithoutChainId, chain_id: genChainId });
  yield gen({ ...GEN_JSON, seed: "AAAA" });
  yield gen({ ...GEN_JSON, rngState: "AAAA" });
  yield gen({ ...GEN_JSON, res: 9 });
  yield gen({ ...GEN_JSON, extra: true });
}

/** Generator envelopes with the reference's five assertions and with strays. */
export function* envelopeRecipes(): Generator<Recipe> {
  for (const res of ["low", "high"] as const) {
    yield { k: "genEnvelope", res, passphrase: "Wolf" };
    yield { k: "genEnvelope", res, passphrase: "Wolf", extra: [["extra", 1]] };
    yield { k: "genEnvelope", res, passphrase: "Wolf", extra: [["res", 2]] };
    yield { k: "genEnvelope", res, passphrase: "Wolf", extra: [["note", "x"]] };
  }
}

/** URL bases, and URLs given back to `fromUrl`. */
export function* urlRecipes(): Generator<Recipe> {
  for (const base of [
    "https://example.com/",
    "https://example.com/?a=1",
    "https://example.com/#frag",
    "https://example.com/path?x=y&z=w",
    "https://example.com:8080/p?q=1#f",
    "https://EXAMPLE.com/A B",
    "https://example.com/?provenance=old",
    "https://example.com/?provenance=old&provenance=older",
  ])
    yield { k: "url", res: "low", base };
  yield { k: "fromurl", url: `https://example.com/?provenance=${LOW.url}` };
  yield { k: "fromurl", url: `https://example.com/?a=1&provenance=${LOW.url}&b=2` };
  yield { k: "fromurl", url: `https://example.com/?provenance=${LOW.url.toUpperCase()}` };
  yield { k: "fromurl", url: `https://example.com/?provenance=%20${LOW.url}` };
  yield { k: "fromurl", url: "https://example.com/?provenance=zzzz" };
  yield { k: "fromurl", url: "https://example.com/?provenance=" };
  yield { k: "fromurl", url: `https://example.com/#provenance=${LOW.url}` };
  yield { k: "fromurl", url: "https://example.com/" };
}

/** CBOR given to every decoder. */
export function* cborRecipes(): Generator<Recipe> {
  for (const hex of [LOW.tagged, LOW.untagged])
    for (const via of ["tagged", "untagged", "codec", "data"] as const)
      yield { k: "cbor", hex, via };
  for (const hex of [
    "d9054582" + LOW.untagged.slice(2),
    "da50524f5683000040",
    "da50524f56820450090bf2f8b96d116cf9e9983ade1d3705",
    "da50524f5682636c6f7750090bf2f8b96d116cf9e9983ade1d3705",
    "da50524f56820043090bf2",
    "6568656c6c6f",
    "ff",
  ]) {
    yield { k: "cbor", hex, via: "tagged" };
    yield { k: "cbor", hex, via: "untagged" };
  }
}

/** Identifiers at every style and the word-count bounds. */
export function* identifierRecipes(): Generator<Recipe> {
  for (const style of ["bytewords", "minimal", "bytemoji"] as const)
    for (const words of [4, 5, 32, 3, 33, 0]) yield { k: "identifier", res: "high", words, style };
}

/** Date strings given to the parser. */
export function* parseRecipes(): Generator<Recipe> {
  for (const date of [
    "2023-06-20T12:00:00Z",
    "2023-06-20",
    "2023-06-20T12:00:00.999Z",
    "2023-06-20T14:00:00+02:00",
    "2023-06-20T12:00:00",
    "2023-06-20 12:00:00Z",
    "June 20, 2023",
    "2023-02-29",
    "2023-13-01",
    "1690000000",
    "",
    "not a date",
    "2023-06-20T12:00:00z",
    "2023-6-8",
  ])
    yield { k: "parse", date };
}

/** Seeds and RNG states of every length near 32. */
export function* bytesRecipes(): Generator<Recipe> {
  for (const kind of ["seed", "rngState"] as const)
    for (const n of [32, 31, 33, 1, 0]) yield { k: "bytes", kind, hex: "ab".repeat(n) };
}

/** Bytewords in the wrong case and spacing. */
export function* casingRecipes(): Generator<Recipe> {
  yield { k: "decode", form: "bytewords", res: "low", s: LOW.bytewords.toUpperCase() };
  yield { k: "decode", form: "bytewords", res: "low", s: LOW.bytewords.replace(/ /g, "  ") };
  yield { k: "decode", form: "bytewords", res: "low", s: ` ${LOW.bytewords} ` };
  yield { k: "decode", form: "url", res: "low", s: LOW.url.toUpperCase() };
  yield { k: "decode", form: "ur", res: "low", s: LOW.ur.toUpperCase() };
}

/** Dates at the codec ceilings and an impossible calendar date. */
export function* dateEdgeRecipes(): Generator<Recipe> {
  for (const [res, date] of [
    ["medium", "2000-12-31T23:59:59Z"],
    ["medium", "2001-01-01T00:00:00Z"],
    ["medium", "2137-02-07T06:28:15Z"],
    ["medium", "2137-02-07T06:28:16Z"],
    ["low", "2150-12-31"],
    ["low", "2151-01-01"],
    ["low", "2022-12-31"],
    ["low", "2024-02-29"],
    ["low", "2023-02-29"],
    ["high", "9999-12-31"],
    ["high", "8990-01-01"],
    ["high", "8000-01-01"],
    ["high", "2023-06-20T12:00:00.999Z"],
  ] as const)
    yield { k: "date", res, date };
}

/** The JavaScript input domain. */
export function* domainRecipes(): Generator<Recipe> {
  for (const [name, cls] of DOMAIN_CASES) yield { k: "domain", case: name, cls };
}

export function* prettyRecipes(m: Materialized): Generator<Recipe> {
  for (const res of RESOLUTIONS) {
    const c = m.messages[res];
    yield { k: "validate", res, chains: [c.slice(0, 3)], pretty: true };
    yield { k: "validate", res, chains: [[c[0], c[1], c[3]]], pretty: true };
    yield { k: "validate", res, chains: [[]], pretty: true };
  }
}

export const categories: Record<string, (m: Materialized) => Generator<Recipe>> = {
  hand: () => hand(),
  decode: decodeRecipes,
  validate: validateRecipes,
  pretty: prettyRecipes,
  info: () => infoChains(),
  json: () => jsonRecipes(),
  envelope: () => envelopeRecipes(),
  url: () => urlRecipes(),
  cbor: () => cborRecipes(),
  identifier: () => identifierRecipes(),
  parse: () => parseRecipes(),
  bytes: () => bytesRecipes(),
  casing: () => casingRecipes(),
  dateEdges: () => dateEdgeRecipes(),
  domain: () => domainRecipes(),
  generated: () => generated(),
};

/** The golden subset: everything but most of the generated chains. */
export function* goldenRecipes(m: Materialized): Generator<Recipe> {
  for (const [name, gen] of Object.entries(categories)) if (name !== "generated") yield* gen(m);
  let i = 0;
  for (const r of generated()) {
    if (i++ >= 40) break;
    yield r;
  }
}
