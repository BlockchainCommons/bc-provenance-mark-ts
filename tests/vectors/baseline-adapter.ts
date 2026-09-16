/**
 * The adapter over the frozen bundle's surface of this package:
 * `newWithSeed`/`newWithPassphrase`, `next(date, info)`, zero-argument
 * accessor methods, `urString`, `intoEnvelope`, enum options. A thrown
 * value renders from the bundle's error type or the error's class name,
 * and its message.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- the recipe language is checked by its own type; a missing field is a corpus bug */
import {
  displayDate,
  hex,
  unhex,
  type MarkOutputs,
  type MarkSpec,
  type Resolution,
  type SiblingDeps,
  type VectorApi,
} from "./recipes";

const RES_INDEX: Record<Resolution, number> = { low: 0, medium: 1, quartile: 2, high: 3 };

export function baselineAdapterFor(m: any, deps: SiblingDeps): VectorApi {
  m.registerTags?.();
  const res = (r: Resolution): any => RES_INDEX[r];
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
    message: hex(mark.message()),
    cbor: hex(mark.toCborData()),
    ur: mark.urString(),
    url: mark.toUrlEncoding(),
    bytewords: mark.toBytewordsWithStyle(styles.standard),
    bytewordsUri: mark.toBytewordsWithStyle(styles.uri),
    bytewordsMinimal: mark.toBytewordsWithStyle(styles.minimal),
    idHex: mark.idHex(),
    idBytewords: mark.bytewordsIdentifier(true),
    idBytemoji: mark.bytemojiIdentifier(true),
    idMinimal: mark.bytewordsMinimalIdentifier(true),
    json: JSON.stringify(mark.toJSON()),
    envelope: deps.formatEnvelope(mark.intoEnvelope()),
  });
  const generatorFor = (
    r: Resolution,
    seed: string | undefined,
    passphrase: string | undefined,
  ): any =>
    seed !== undefined
      ? m.ProvenanceMarkGenerator.newWithSeed(res(r), m.ProvenanceSeed.fromBytes(unhex(seed)))
      : m.ProvenanceMarkGenerator.newWithPassphrase(res(r), passphrase);
  const wolfGenesis = (r: Resolution): any =>
    m.ProvenanceMarkGenerator.newWithPassphrase(res(r), "Wolf").next(
      new Date("2023-06-20T12:00:00Z"),
      undefined,
    );
  const debugOf = (mark: any): string => mark.toDebugString();
  const styleId = (mark: any, style: string, words: number): string =>
    style === "bytewords"
      ? mark.idBytewords(words, false)
      : style === "bytemoji"
        ? mark.idBytemoji(words, false)
        : mark.idBytewordsMinimal(words, false);
  return {
    chain: (r, seed, passphrase, specs) => {
      const g = generatorFor(r, seed, passphrase);
      const marks: MarkOutputs[] = [];
      for (const spec of specs) marks.push(outputs(g.next(new Date(spec.date), infoOf(spec))));
      return { marks, generator: JSON.stringify(g.toJSON()) };
    },
    decode: (form, r, s) => {
      const mark =
        form === "message"
          ? m.ProvenanceMark.fromMessage(res(r), unhex(s))
          : form === "cbor"
            ? m.ProvenanceMark.fromCborData(unhex(s))
            : form === "ur"
              ? m.ProvenanceMark.fromURString(s)
              : form === "url"
                ? m.ProvenanceMark.fromUrlEncoding(s)
                : m.ProvenanceMark.fromBytewords(res(r), s);
      return debugOf(mark);
    },
    validate: (r, chains, pretty) => {
      const marks = chains.flat().map((s) => m.ProvenanceMark.fromMessage(res(r), unhex(s)));
      const report = m.validate(marks);
      return {
        text: m.formatReport(report, "text"),
        json: m.formatReport(report, pretty ? "json-pretty" : "json-compact"),
      };
    },
    encodeDate: (r, date) => hex(m.serializeDate(res(r), m.parseDate(date))),
    decodeDate: (r, bytes) => displayDate(m.deserializeDate(res(r), unhex(bytes))),
    json: (target, json) => {
      if (target === "mark") {
        const mark = m.ProvenanceMark.fromJSON(json);
        return `${debugOf(mark)}\njson=${JSON.stringify(mark.toJSON())}`;
      }
      return JSON.stringify(m.ProvenanceMarkGenerator.fromJSON(json).toJSON());
    },
    genEnvelope: (r, passphrase, extra) => {
      let env = m.ProvenanceMarkGenerator.newWithPassphrase(res(r), passphrase).intoEnvelope();
      for (const [predicate, object] of extra) env = deps.addAssertion(env, predicate, object);
      return JSON.stringify(m.ProvenanceMarkGenerator.fromEnvelope(env).toJSON());
    },
    url: (r, base) => wolfGenesis(r).toUrl(base).toString(),
    fromUrl: (url) => debugOf(m.ProvenanceMark.fromUrl(new URL(url))),
    cbor: () => {
      throw new Error("baseline: cannot decode raw CBOR bytes");
    },
    identifier: (r, words, style) => styleId(wolfGenesis(r), style, words),
    parseDate: (date) => displayDate(m.parseDate(date)),
    bytes: (kind, h) => {
      const value = deps.cborBytes(unhex(h));
      return kind === "seed"
        ? m.ProvenanceSeed.fromCbor(value).hex()
        : m.RngState.fromCbor(value).hex();
    },
    domain: () => {
      throw new Error("baseline: no JavaScript-domain guards to compare");
    },
    errorCode: (e) => {
      const x = e as { type?: unknown; code?: unknown; name?: unknown };
      if (x.name === "ProvenanceMarkError") return String(x.type ?? x.code);
      return typeof x.code === "string" ? x.code : String(x.name ?? "Error");
    },
    errorMessage: (e) => (e instanceof Error ? e.message : String(e)),
  };
}
