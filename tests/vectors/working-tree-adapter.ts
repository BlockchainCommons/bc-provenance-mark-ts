/**
 * The adapter over the working tree: every recipe kind materialised with
 * the package's own API. A thrown value renders from the error's own
 * `code` (or its class name), the `code` of its `cause` for the codes
 * whose reference variant wraps another error, and its message.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the recipe language is checked by its own type; a missing field is a corpus bug */
import {
  attempt,
  displayDate,
  hex,
  unhex,
  type MarkOutputs,
  type MarkSpec,
  type Resolution,
  type SiblingDeps,
  type VectorApi,
} from "./recipes";

/**
 * The JavaScript input domain: inputs the reference's types cannot
 * express (J3) or a reference surface the port reaches differently (J4),
 * by case name. The outcome is what the port does with them.
 */
export const DOMAIN_CASES: readonly [string, "J1" | "J2" | "J3" | "J4"][] = [
  ["encodeDate.invalid.low", "J3"],
  ["encodeDate.invalid.medium", "J3"],
  ["encodeDate.invalid.high", "J3"],
  ["next.invalidDate", "J3"],
  ["fromJSON.null", "J3"],
  ["fromJSON.empty", "J3"],
  ["fromJSON.generator.empty", "J3"],
  ["fromUrl.string", "J4"],
  ["toUrl.invalid", "J3"],
  ["validate.string", "J3"],
  ["validate.numbers", "J3"],
  ["identifier.wordCount.fraction", "J1"],
  ["formatReport.xml", "J3"],
  ["next.info.text", "J4"],
  ["next.info.number", "J4"],
  ["date.aliasing", "J4"],
  ["rngState.short", "J4"],
  ["seed.notBytes", "J3"],
  ["frozen", "J4"],
  ["from.key.string", "J3"],
  ["from.key.array", "J3"],
  ["from.key.number", "J3"],
  ["from.date.cborDate", "J4"],
  ["next.date.cborDate", "J4"],
  ["parseDate.leapSecond", "J4"],
  ["generator.equals", "J4"],
  ["json.seq.negativeZero", "J3"],
  ["json.seq.float1", "J3"],
];

/** The codes whose reference variant wraps another error, with that error's code shown. */
const WRAPPING = new Set([
  "Bytewords",
  "Cbor",
  "Envelope",
  "BytewordsError",
  "CborError",
  "EnvelopeError",
]);

/** The reference "Wolf" chain's genesis mark at low resolution, as JSON. */
const LOW_JSON = {
  seq: 0,
  date: "2023-06-20",
  res: 0,
  chain_id: "CQvy+A==",
  key: "CQvy+A==",
  hash: "W9zsgQ==",
};

export function workingTreeAdapterFor(m: any, deps: SiblingDeps): VectorApi {
  m.registerTags?.();
  const styles = deps.styles;
  const infoOf = (spec: MarkSpec): any =>
    spec.infoHex !== undefined
      ? deps.cborFromHex(spec.infoHex)
      : spec.info !== undefined
        ? deps.cborText(spec.info)
        : undefined;
  const outputs = (mark: any): MarkOutputs => ({
    debug: mark.toDebugString(),
    display: mark.toString(),
    message: hex(mark.message),
    cbor: hex(mark.toCbor().toData()),
    ur: mark.toUR().toString(),
    url: mark.toUrlEncoding(),
    bytewords: mark.toBytewords(styles.standard),
    bytewordsUri: mark.toBytewords(styles.uri),
    bytewordsMinimal: mark.toBytewords(styles.minimal),
    idHex: mark.idHex,
    idBytewords: mark.idBytewords({ prefix: true }),
    idBytemoji: mark.idBytemoji({ prefix: true }),
    idMinimal: mark.idBytewordsMinimal({ prefix: true }),
    json: JSON.stringify(mark.toJSON()),
    envelope: deps.formatEnvelope(mark.toEnvelope()),
  });
  const generatorFor = (
    r: Resolution,
    seed: string | undefined,
    passphrase: string | undefined,
  ): any =>
    seed !== undefined
      ? m.ProvenanceMarkGenerator.from({ res: r, seed: m.ProvenanceSeed.from(unhex(seed)) })
      : m.ProvenanceMarkGenerator.fromPassphrase(r, passphrase);
  /** The reference "Wolf" chain's genesis mark at a resolution. */
  const wolfGenesis = (r: Resolution): any =>
    m.ProvenanceMarkGenerator.fromPassphrase(r, "Wolf").next(new Date("2023-06-20T12:00:00Z"));
  const debugOf = (mark: any): string => mark.toDebugString();
  const domain = (name: string): string => {
    const genesis = wolfGenesis("low");
    const invalid = new Date(NaN);
    switch (name) {
      case "encodeDate.invalid.low":
        return hex(m.serializeDate("low", invalid));
      case "encodeDate.invalid.medium":
        return hex(m.serializeDate("medium", invalid));
      case "encodeDate.invalid.high":
        return hex(m.serializeDate("high", invalid));
      case "next.invalidDate":
        return debugOf(m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf").next(invalid));
      case "fromJSON.null":
        return debugOf(m.ProvenanceMark.fromJSON(null));
      case "fromJSON.empty":
        return debugOf(m.ProvenanceMark.fromJSON({}));
      case "fromJSON.generator.empty":
        return JSON.stringify(m.ProvenanceMarkGenerator.fromJSON({}).toJSON());
      case "fromUrl.string":
        return debugOf(m.ProvenanceMark.fromUrl(genesis.toUrl("https://example.com/").toString()));
      case "toUrl.invalid":
        return genesis.toUrl("not a url").toString();
      case "validate.string":
        return m.formatReport(m.validate("x"), "jsonCompact");
      case "validate.numbers":
        return m.formatReport(m.validate([1]), "jsonCompact");
      case "identifier.wordCount.fraction":
        return genesis.idBytewords({ wordCount: 4.5 });
      case "formatReport.xml":
        return String(m.formatReport(m.validate([genesis]), "xml"));
      case "next.info.text":
        return debugOf(
          m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf").next(
            new Date("2023-06-20T12:00:00Z"),
            "text",
          ),
        );
      case "next.info.number":
        return debugOf(
          m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf").next(
            new Date("2023-06-20T12:00:00Z"),
            42,
          ),
        );
      case "date.aliasing": {
        const before = debugOf(genesis);
        genesis.date.setUTCFullYear(2030);
        return before === debugOf(genesis) ? "unchanged" : "changed";
      }
      case "rngState.short":
        return m.RngState.from(new Uint8Array(1)).hex;
      case "seed.notBytes":
        return m.ProvenanceSeed.from("x").hex;
      case "frozen": {
        const report = m.validate([genesis]);
        const details = attempt(api, () => {
          m.ProvenanceSeed.from(new Uint8Array(3));
        });
        return [
          `resolutions=${String(Object.isFrozen(m.PROVENANCE_MARK_RESOLUTIONS))}`,
          `codes=${String(Object.isFrozen(m.PROVENANCE_MARK_ERROR_CODES))}`,
          `mark=${String(Object.isFrozen(genesis))}`,
          `seed=${String(Object.isFrozen(m.ProvenanceSeed.fromPassphrase("x")))}`,
          `report=${String(Object.isFrozen(report) && Object.isFrozen(report.chains))}`,
          `details=${details.startsWith("throw:") ? "n/a" : details}`,
        ].join("\n");
      }
      case "from.key.string":
      case "from.key.array":
      case "from.key.number": {
        const key = name.endsWith("string") ? "abcd" : name.endsWith("array") ? [1, 2, 3, 4] : 4;
        const mark = m.ProvenanceMark.from({
          res: "low",
          key,
          nextKey: new Uint8Array(4),
          chainId: new Uint8Array(4),
          seq: 0,
          date: new Date("2023-06-20T12:00:00Z"),
        });
        return `key.length=${mark.key.length} message.length=${mark.message.length}`;
      }
      case "from.date.cborDate":
        return debugOf(
          m.ProvenanceMark.from({
            res: "low",
            key: genesis.key,
            nextKey: genesis.key,
            chainId: genesis.key,
            seq: 0,
            date: deps.cborDate?.("2023-06-20T12:00:00Z"),
          }),
        );
      case "next.date.cborDate":
        return debugOf(
          m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf").next(
            deps.cborDate?.("2023-06-20T12:00:00Z"),
          ),
        );
      case "parseDate.leapSecond":
        // A `Date` cannot hold second 60: the leap second reads as the next minute.
        return displayDate(m.parseDate("2023-12-25T10:30:60Z"));
      case "generator.equals": {
        const a = m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
        const b = m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
        const c = m.ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
        c.next(new Date("2023-06-20T12:00:00Z"));
        return typeof a.equals !== "function"
          ? "absent"
          : `same=${String(a.equals(b))} advanced=${String(a.equals(c))}`;
      }
      case "json.seq.negativeZero":
        return String(m.ProvenanceMark.fromJSON({ ...LOW_JSON, seq: -0 }).seq);
      case "json.seq.float1":
        return String(m.ProvenanceMark.fromJSON({ ...LOW_JSON, seq: 1.0 }).seq);
      default:
        throw new Error(`unknown domain case ${name}`);
    }
  };
  const api: VectorApi = {
    chain: (r, seed, passphrase, specs) => {
      const g = generatorFor(r, seed, passphrase);
      const marks: MarkOutputs[] = [];
      for (const spec of specs) {
        const info = infoOf(spec);
        marks.push(outputs(g.next(new Date(spec.date), info)));
      }
      return { marks, generator: JSON.stringify(g.toJSON()) };
    },
    decode: (form, r, s) => {
      const mark =
        form === "message"
          ? m.ProvenanceMark.fromMessage(r, unhex(s))
          : form === "cbor"
            ? m.ProvenanceMark.fromCborData(unhex(s))
            : form === "ur"
              ? m.ProvenanceMark.fromUR(deps.parseUR?.(s))
              : form === "url"
                ? m.ProvenanceMark.fromUrlEncoding(s)
                : m.ProvenanceMark.fromBytewords(r, s);
      return debugOf(mark);
    },
    validate: (r, chains, pretty) => {
      const report = m.validate(
        chains.flat().map((s) => m.ProvenanceMark.fromMessage(r, unhex(s))),
      );
      return {
        text: m.formatReport(report, "text"),
        json: m.formatReport(report, pretty ? "jsonPretty" : "jsonCompact"),
        hasIssues: m.hasIssues(report),
      };
    },
    encodeDate: (r, date) => hex(m.serializeDate(r, m.parseDate(date))),
    decodeDate: (r, bytes) => displayDate(m.deserializeDate(r, unhex(bytes))),
    json: (target, json) => {
      if (target === "mark") {
        const mark = m.ProvenanceMark.fromJSON(json);
        return `${debugOf(mark)}\njson=${JSON.stringify(mark.toJSON())}`;
      }
      return JSON.stringify(m.ProvenanceMarkGenerator.fromJSON(json).toJSON());
    },
    genEnvelope: (r, passphrase, extra) => {
      let env = m.ProvenanceMarkGenerator.fromPassphrase(r, passphrase).toEnvelope();
      for (const [predicate, object] of extra) env = deps.addAssertion(env, predicate, object);
      return JSON.stringify(m.ProvenanceMarkGenerator.fromEnvelope(env).toJSON());
    },
    url: (r, base) => wolfGenesis(r).toUrl(base).toString(),
    fromUrl: (url) => debugOf(m.ProvenanceMark.fromUrl(new URL(url))),
    cbor: (h, via) => {
      if (via === "data") return debugOf(m.ProvenanceMark.fromCborData(unhex(h)));
      // The bytes-to-CBOR step is the reference's `CBOR::try_from_data`, a
      // dcbor failure of its own; it reads as the package's `Cbor` code.
      let value: unknown;
      try {
        value = deps.cborFromHex(h);
      } catch (e) {
        throw m.ProvenanceMarkError.cborDecode(e);
      }
      const mark =
        via === "tagged"
          ? m.ProvenanceMark.fromCbor(value)
          : via === "untagged"
            ? m.ProvenanceMark.fromUntaggedCbor(value)
            : m.ProvenanceMark.codec.decode(value);
      return debugOf(mark);
    },
    identifier: (r, words, style) => {
      const mark = wolfGenesis(r);
      return style === "bytewords"
        ? mark.idBytewords({ wordCount: words })
        : style === "minimal"
          ? mark.idBytewordsMinimal({ wordCount: words })
          : mark.idBytemoji({ wordCount: words });
    },
    parseDate: (date) => displayDate(m.parseDate(date)),
    bytes: (kind, h) => {
      const value = deps.cborBytes(unhex(h));
      return kind === "seed"
        ? m.ProvenanceSeed.fromCbor(value).hex
        : m.RngState.fromCbor(value).hex;
    },
    seed: (text) => m.parseSeed(text).hex,
    info: (r, comment, json) => {
      const info =
        json !== undefined
          ? m.ProvenanceMarkInfo.fromJSON(json)
          : m.ProvenanceMarkInfo.from(wolfGenesis(r), comment);
      return `${info.markdownSummary()}\n===\n${JSON.stringify(info.toJSON())}`;
    },
    disambiguate: (r, indices, style) => {
      const g = m.ProvenanceMarkGenerator.fromPassphrase(r, "Wolf");
      const chainMarks: any[] = [];
      for (let i = 0; i < 4; i++) chainMarks.push(g.next(new Date(Date.UTC(2023, 5, 20 + i, 12))));
      const marks = indices.map((i) => chainMarks[i]);
      const ids =
        style === "bytewords"
          ? m.ProvenanceMark.disambiguatedIdBytewords(marks, { prefix: true })
          : m.ProvenanceMark.disambiguatedIdBytemoji(marks, { prefix: true });
      return ids.join("\n");
    },
    summary: (h) => deps.formatEnvelope(deps.leafEnvelope?.(deps.cborFromHex(h))),
    domain,
    errorCode: (e) => {
      const x = e as { code?: unknown; name?: unknown; cause?: { code?: unknown } };
      const code = typeof x.code === "string" ? x.code : String(x.name ?? "Error");
      const inner =
        WRAPPING.has(code) && typeof x.cause?.code === "string" ? `[${x.cause.code}]` : "";
      return `${code}${inner}`;
    },
    errorMessage: (e) => (e instanceof Error ? e.message : String(e)),
  };
  return api;
}
