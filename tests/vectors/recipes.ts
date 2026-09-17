/**
 * Vector recipes: a seeded generator producing a chain of marks (every
 * encoding of every mark), a mark decoded from one of its encodings, a
 * validation report over sets of marks, the date codecs, persisted JSON
 * and envelope state, URLs, CBOR given to each decoder, identifiers, the
 * date parser, the seed parser, seed and RNG-state decoding, the info
 * type, disambiguated identifiers, the envelope summariser, and the
 * JavaScript input domain. `materialize` runs a recipe through a `VectorApi` and returns
 * one outcome string, so the same recipe drives the golden file, the
 * differential and the Rust harness.
 *
 * A rejection renders as `throw:<code>[<inner code>]|<message>`: the
 * error's code (its class name when it has none), the code of the error
 * it wraps for the codes whose reference variant wraps one, and the
 * message. The Rust harness renders the reference's errors the same way.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Resolution = "low" | "medium" | "quartile" | "high";
export interface MarkSpec {
  /** ISO 8601 UTC. */
  date: string;
  /** A text info payload. */
  info?: string;
  /** Any CBOR info payload, as its encoded bytes. */
  infoHex?: string;
}
export type DecodeForm = "message" | "cbor" | "ur" | "url" | "bytewords";
export type IdentifierStyleName = "bytewords" | "minimal" | "bytemoji";
export type DomainClass = "J1" | "J2" | "J3" | "J4";
export type Recipe =
  | { k: "generator"; res: Resolution; seed?: string; passphrase?: string; marks: MarkSpec[] }
  | { k: "decode"; form: DecodeForm; res: Resolution; s: string }
  | { k: "validate"; res: Resolution; chains: string[][]; pretty?: boolean }
  | { k: "date"; res: Resolution; date?: string; bytes?: string }
  /** A mark or a generator restored from its JSON. */
  | { k: "json"; target: "mark" | "generator"; json: Record<string, unknown> }
  /** A generator's envelope with `extra` assertions (text predicate, text or number object) added, restored. */
  | { k: "genEnvelope"; res: Resolution; passphrase: string; extra?: [string, string | number][] }
  /** The reference chain's genesis mark at `res` placed on `base` as its `provenance` parameter. */
  | { k: "url"; res: Resolution; base: string }
  | { k: "fromurl"; url: string }
  /** CBOR bytes given to the tagged decoder, the untagged one, the codec, or `fromCborData`. */
  | { k: "cbor"; hex: string; via: "tagged" | "untagged" | "codec" | "data" }
  /** The reference chain's genesis mark's identifier at `res`. */
  | { k: "identifier"; res: Resolution; words: number; style: IdentifierStyleName }
  /** A date string given to `parseDate`. */
  | { k: "parse"; date: string }
  /** A byte string given to `ProvenanceSeed.fromCbor` or `RngState.fromCbor`. */
  | { k: "bytes"; kind: "seed" | "rngState"; hex: string }
  /** A string given to `parseSeed`. */
  | { k: "seed"; s: string }
  /**
   * The info type: from the reference chain's genesis mark at `res` with a
   * comment, or read from `json`; the Markdown summary and the JSON both ways.
   */
  | { k: "info"; res: Resolution; comment?: string; json?: Record<string, unknown> }
  /** Disambiguated identifiers of the reference chain's marks at `res`, by index (repeats allowed). */
  | { k: "disambiguate"; res: Resolution; indices: number[]; style: "bytewords" | "bytemoji" }
  /** The envelope format of a leaf holding these CBOR bytes (a mark, good or malformed). */
  | { k: "summary"; hex: string }
  /** The JavaScript input domain; the reference has no analogue (`js-only`). */
  | { k: "domain"; case: string; cls: DomainClass };
export type Outcome = string;

/** Every encoding of one mark, in a fixed order. */
export interface MarkOutputs {
  debug: string;
  display: string;
  message: string;
  cbor: string;
  ur: string;
  url: string;
  bytewords: string;
  bytewordsUri: string;
  bytewordsMinimal: string;
  idHex: string;
  idBytewords: string;
  idBytemoji: string;
  idMinimal: string;
  json: string;
  envelope: string;
}

export interface VectorApi {
  chain(
    res: Resolution,
    seed: string | undefined,
    passphrase: string | undefined,
    marks: MarkSpec[],
  ): { marks: MarkOutputs[]; generator: string };
  decode(form: DecodeForm, res: Resolution, s: string): string;
  validate(
    res: Resolution,
    chains: string[][],
    pretty: boolean,
  ): { text: string; json: string; hasIssues: boolean };
  encodeDate(res: Resolution, date: string): string;
  decodeDate(res: Resolution, bytes: string): string;
  json(target: "mark" | "generator", json: Record<string, unknown>): string;
  genEnvelope(res: Resolution, passphrase: string, extra: [string, string | number][]): string;
  url(res: Resolution, base: string): string;
  fromUrl(url: string): string;
  cbor(hex: string, via: "tagged" | "untagged" | "codec" | "data"): string;
  identifier(res: Resolution, words: number, style: IdentifierStyleName): string;
  parseDate(date: string): string;
  bytes(kind: "seed" | "rngState", hex: string): string;
  seed(s: string): string;
  info(
    res: Resolution,
    comment: string | undefined,
    json: Record<string, unknown> | undefined,
  ): string;
  disambiguate(res: Resolution, indices: number[], style: "bytewords" | "bytemoji"): string;
  summary(hex: string): string;
  domain(name: string): string;
  /** The error's code, with the wrapped error's code in brackets where the reference wraps one. */
  errorCode(e: unknown): string;
  errorMessage(e: unknown): string;
}

export const hex = (u: Uint8Array): string => Buffer.from(u).toString("hex");
export const unhex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, "hex"));

const chainName = (marks: MarkSpec[]): string =>
  `×${marks.length}${marks.some((m) => m.info !== undefined) ? " info" : ""}${
    marks.some((m) => m.infoHex !== undefined)
      ? ` cbor(${marks
          .map((m) => m.infoHex ?? "")
          .join(",")
          .slice(0, 24)})`
      : ""
  }`;

export function recipeName(r: Recipe): string {
  switch (r.k) {
    case "generator":
      return `generator ${r.res} ${r.seed ?? `"${r.passphrase}"`} ${chainName(r.marks)}`;
    case "decode":
      return `decode ${r.form} ${r.res} ${r.s.slice(0, 32)}`;
    case "validate":
      return `validate ${r.res} ${r.chains.map((c) => c.length).join("+")} ${r.chains[0]?.[0]?.slice(0, 12) ?? ""}${r.pretty === true ? " pretty" : ""}`;
    case "date":
      return `date ${r.res} ${r.date ?? r.bytes}`;
    case "json":
      return `json ${r.target} ${JSON.stringify(r.json).slice(0, 60)}`;
    case "genEnvelope":
      return `genEnvelope ${r.res} "${r.passphrase}"${r.extra === undefined || r.extra.length === 0 ? "" : ` +${r.extra.map(([p, o]) => `${p}:${JSON.stringify(o)}`).join(",")}`}`;
    case "url":
      return `url ${r.res} ${r.base}`;
    case "fromurl":
      return `fromurl ${r.url.slice(0, 48)}`;
    case "cbor":
      return `cbor ${r.via} ${r.hex.slice(0, 24)}${r.hex.length > 24 ? "…" : ""}`;
    case "identifier":
      return `identifier ${r.res} ${r.style} ${r.words}`;
    case "parse":
      return `parse ${JSON.stringify(r.date)}`;
    case "bytes":
      return `bytes ${r.kind} ${r.hex.slice(0, 16)}${r.hex.length > 16 ? "…" : ""} (${r.hex.length / 2})`;
    case "seed":
      return `seed ${JSON.stringify(r.s.length > 24 ? `${r.s.slice(0, 16)}…${r.s.slice(-6)}` : r.s)} (${r.s.length})`;
    case "info":
      return `info ${r.res}${r.comment !== undefined ? ` ${JSON.stringify(r.comment)}` : ""}${r.json !== undefined ? ` json ${JSON.stringify(r.json).slice(0, 48)}` : ""}`;
    case "disambiguate":
      return `disambiguate ${r.res} ${r.style} [${r.indices.join(",")}]`;
    case "summary":
      return `summary ${r.hex.slice(0, 24)}${r.hex.length > 24 ? "…" : ""}`;
    case "domain":
      return `domain ${r.case} (${r.cls})`;
  }
}

/**
 * The frozen bundle exports no CBOR decoder (so no raw CBOR bytes, no CBOR
 * info payloads and no summariser rows), reads the info type through a
 * different shape, and has no JavaScript-domain guards to compare.
 */
export const isBaselineSupported = (r: Recipe): boolean => {
  if (r.k === "cbor" || r.k === "domain" || r.k === "info" || r.k === "summary") return false;
  if (r.k === "generator") return r.marks.every((m) => m.infoHex === undefined);
  return true;
};

const renderMark = (m: MarkOutputs): string =>
  (Object.keys(m) as (keyof MarkOutputs)[]).map((k) => `${k}=${m[k]}`).join("\n");

export const thrown = (api: VectorApi, e: unknown): string =>
  `throw:${api.errorCode(e)}|${api.errorMessage(e)}`;

export function materialize(api: VectorApi, r: Recipe): Outcome {
  try {
    switch (r.k) {
      case "generator": {
        const c = api.chain(r.res, r.seed, r.passphrase, r.marks);
        return c.marks.map(renderMark).join("\n---\n") + `\n===\ngenerator=${c.generator}`;
      }
      case "decode":
        return api.decode(r.form, r.res, r.s);
      case "validate": {
        const v = api.validate(r.res, r.chains, r.pretty === true);
        return `${v.text}\n===\n${v.json}\n===\nhasIssues=${String(v.hasIssues)}`;
      }
      case "date":
        return r.date !== undefined
          ? api.encodeDate(r.res, r.date)
          : api.decodeDate(r.res, r.bytes ?? "");
      case "json":
        return api.json(r.target, r.json);
      case "genEnvelope":
        return api.genEnvelope(r.res, r.passphrase, r.extra ?? []);
      case "url":
        return api.url(r.res, r.base);
      case "fromurl":
        return api.fromUrl(r.url);
      case "cbor":
        return api.cbor(r.hex, r.via);
      case "identifier":
        return api.identifier(r.res, r.words, r.style);
      case "parse":
        return api.parseDate(r.date);
      case "bytes":
        return api.bytes(r.kind, r.hex);
      case "seed":
        return api.seed(r.s);
      case "info":
        return api.info(r.res, r.comment, r.json);
      case "disambiguate":
        return api.disambiguate(r.res, r.indices, r.style);
      case "summary":
        return api.summary(r.hex);
      case "domain":
        return api.domain(r.case);
    }
  } catch (e) {
    return thrown(api, e);
  }
}

/** `try` a step and report ok, a value, or the error. */
export const attempt = (api: VectorApi, f: () => string | undefined | void): string => {
  try {
    const v = f();
    return v === undefined ? "ok" : v;
  } catch (e) {
    return thrown(api, e);
  }
};

/** The reference's `Date` display: subseconds ignored; the date alone at midnight, else ISO seconds. */
export const displayDate = (d: Date): string => {
  const iso = new Date(d.getTime() - d.getUTCMilliseconds()).toISOString();
  return iso.endsWith("T00:00:00.000Z") ? iso.slice(0, 10) : iso.replace(/\.\d{3}Z$/, "Z");
};

/** The sibling operations an adapter needs, bound to the frozen bundle's or the working tree's siblings. */
export interface SiblingDeps {
  styles: { standard: unknown; uri: unknown; minimal: unknown };
  cborText: (s: string) => unknown;
  /** A CBOR value from its encoded bytes. */
  cborFromHex: (hex: string) => unknown;
  /** A CBOR byte string. */
  cborBytes: (bytes: Uint8Array) => unknown;
  formatEnvelope: (e: any) => string;
  /** Adds an assertion with a text predicate and a text or number object. */
  addAssertion: (e: any, predicate: string, object: string | number) => any;
  /** The UR string parsed into a UR value (the working tree's `fromUR` takes a UR). */
  parseUR?: (s: string) => unknown;
  /** A `CborDate` from its string. */
  cborDate?: (s: string) => unknown;
  /** A leaf envelope over a CBOR value. */
  leafEnvelope?: (c: unknown) => unknown;
}
