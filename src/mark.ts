/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * One link of a provenance chain and its encodings.
 */

import {
  type Cbor,
  type CborCodec,
  type CborInput,
  type CborTagged,
  type Tag,
  type ToCbor,
  CborError,
  bytesToHex,
  encodeCbor,
} from "@blockchaincommons/dcbor";
import { diagnostic } from "@blockchaincommons/dcbor/diagnostic";
import { TAG_PROVENANCE_MARK } from "@blockchaincommons/tags";
import { type ToUR, type UR, decodeURWith, urFor } from "@blockchaincommons/uniform-resources";
import type { BytewordsStyle } from "@blockchaincommons/uniform-resources/bytewords";
import { Envelope, EnvelopeError, type ToEnvelope } from "@blockchaincommons/envelope";

import { ProvenanceMarkError } from "./error.js";
import type { ValidationIssue } from "./validation-issue.js";
import { type ProvenanceMarkResolution, isProvenanceMarkResolution } from "./resolution.js";
import { sha256 } from "./crypto-utils.js";
import { type DateInput, dateToDisplay } from "./date.js";
import { bytesEqual } from "./utils.js";
import {
  type MarkFields,
  buildFields,
  buildMessage,
  infoOf,
  makeHash,
  parseMessage,
} from "./mark-layout.js";
import {
  type MarkWire,
  bytewordsToMessage,
  markFieldsFromCborData,
  markFieldsFromJSON,
  markFieldsFromTaggedCbor,
  markFieldsFromUntaggedCbor,
  markFieldsFromUrlEncoding,
  markFieldsToJSON,
  markTaggedCbor,
  markToUrlEncoding,
  markUntaggedCbor,
  messageToBytewords,
} from "./mark-encodings.js";
import { disambiguatedIdentifiers, identifierOf, markId } from "./mark-identifier.js";

/** What `ProvenanceMark.from` takes. */
export interface ProvenanceMarkInput {
  /** The resolution, which fixes every field's width. */
  res: ProvenanceMarkResolution;
  /** This mark's key; the genesis mark's is the chain id. */
  key: Uint8Array;
  /** The next mark's key, committed to in this mark's hash. */
  nextKey: Uint8Array;
  /** The chain id: the genesis mark's key. */
  chainId: Uint8Array;
  /** The sequence number, 0 for genesis. */
  seq: number;
  /** The date, a `Date` or a `CborDate`; stored at the resolution's precision. */
  date: DateInput;
  /** Any CBOR the mark carries: a `Cbor`, a `ToCbor`, or a value dcbor encodes (text, numbers, bytes, arrays, maps). */
  info?: CborInput | undefined;
}

/**
 * The two trailing parameters of `idBytewords`, `idBytemoji` and
 * `idBytewordsMinimal`.
 */
export interface IdentifierOptions {
  /** How many ID bytes to render, an integer from 4 to 32; 4 by default. */
  wordCount?: number | undefined;
  /** Whether to lead with the 🅟 marker; off by default. */
  prefix?: boolean | undefined;
}

/** What `disambiguatedIdBytewords` and `disambiguatedIdBytemoji` take besides the marks. */
export interface DisambiguatedIdentifierOptions {
  /** Whether to lead with the 🅟 marker; off by default. */
  prefix?: boolean | undefined;
}

/** A tagged-CBOR codec for marks, with the `provenance` tag. */
export interface ProvenanceMarkCodec extends CborCodec<ProvenanceMark> {
  /** `[TAG_PROVENANCE_MARK]`. */
  readonly tags: readonly Tag[];
}

let CODEC: ProvenanceMarkCodec | undefined;

/** A `ProvenanceMark` or a `TypeError`. */
function expectMark(value: unknown, what: string): ProvenanceMark {
  if (!(value instanceof ProvenanceMark)) throw new TypeError(`${what} must be a ProvenanceMark`);
  return value;
}

/**
 * One link of a provenance chain: a key, the hash committing to the next
 * key, the chain id, a sequence number, a date and optional CBOR info,
 * laid out per its resolution. Frozen: every accessor returns a copy.
 *
 * ```ts
 * const generator = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
 * const mark = generator.next(new Date("2023-06-20T12:00:00Z"));
 * mark.toUR().toString(); // "ur:provenance/…"
 * ```
 */
export class ProvenanceMark implements ToCbor, CborTagged, ToUR, ToEnvelope {
  private readonly f: MarkFields;

  private constructor(fields: MarkFields) {
    this.f = fields;
    Object.freeze(this);
  }

  /**
   * A mark from its parts; the hash is computed. The key, next key and
   * chain id must be `Uint8Array`s (a `TypeError` otherwise) of the
   * resolution's link length, the sequence number must fit the resolution,
   * the date must be one the resolution encodes.
   */
  static from({
    res,
    key,
    nextKey,
    chainId,
    seq,
    date,
    info,
  }: ProvenanceMarkInput): ProvenanceMark {
    return new ProvenanceMark(
      buildFields(expectResolution(res), key, nextKey, chainId, seq, date, info),
    );
  }

  /** A mark from its wire message at a resolution: `key ‖ obfuscated payload`. */
  static fromMessage(res: ProvenanceMarkResolution, message: Uint8Array): ProvenanceMark {
    return new ProvenanceMark(parseMessage(expectResolution(res), message));
  }

  // Fields --------------------------------------------------------------------

  /** The resolution. */
  get res(): ProvenanceMarkResolution {
    return this.f.res;
  }

  /** A copy of the key. */
  get key(): Uint8Array {
    return new Uint8Array(this.f.key);
  }

  /** A copy of the hash, which commits to the next mark's key. */
  get hash(): Uint8Array {
    return new Uint8Array(this.f.hash);
  }

  /** A copy of the chain id. */
  get chainId(): Uint8Array {
    return new Uint8Array(this.f.chainId);
  }

  /** A copy of the sequence number's bytes. */
  get seqBytes(): Uint8Array {
    return new Uint8Array(this.f.seqBytes);
  }

  /** A copy of the date's bytes. */
  get dateBytes(): Uint8Array {
    return new Uint8Array(this.f.dateBytes);
  }

  /** The sequence number. */
  get seq(): number {
    return this.f.seq;
  }

  /** A copy of the date, at the resolution's precision. */
  get date(): Date {
    return new Date(this.f.date.getTime());
  }

  /** The info CBOR, freshly decoded, if the mark carries any. */
  get info(): Cbor | undefined {
    return infoOf(this.f);
  }

  /** The wire message. */
  get message(): Uint8Array {
    return buildMessage(this.f);
  }

  /** Sequence 0 with the key equal to the chain id. */
  get isGenesis(): boolean {
    return this.f.seq === 0 && bytesEqual(this.f.key, this.f.chainId);
  }

  // Identifiers ---------------------------------------------------------------

  /**
   * The 32-byte Mark ID: the hash, filled from the fingerprint at
   * resolutions whose hash is shorter.
   */
  get id(): Uint8Array {
    return markId(this.f.hash, () => this.fingerprint());
  }

  /** The Mark ID as 64 hex characters. */
  get idHex(): string {
    return bytesToHex(this.id);
  }

  /** SHA-256 of the tagged CBOR. */
  fingerprint(): Uint8Array {
    return sha256(encodeCbor(this.toCbor()));
  }

  /**
   * The Mark ID as upper-case bytewords: `wordCount` words (4 by default,
   * at most 32), led by 🅟 when `prefix` is set. A `wordCount` outside 4
   * to 32, or not an integer, is a `RangeError` where the reference
   * asserts.
   */
  idBytewords({ wordCount = 4, prefix = false }: IdentifierOptions = {}): string {
    return identifierOf(this.id, wordCount, "bytewords", prefix);
  }

  /** The Mark ID as bytemoji, otherwise as `idBytewords`. */
  idBytemoji({ wordCount = 4, prefix = false }: IdentifierOptions = {}): string {
    return identifierOf(this.id, wordCount, "bytemoji", prefix);
  }

  /** The Mark ID as minimal bytewords (two letters a byte), otherwise as `idBytewords`. */
  idBytewordsMinimal({ wordCount = 4, prefix = false }: IdentifierOptions = {}): string {
    return identifierOf(this.id, wordCount, "minimal", prefix);
  }

  /**
   * Bytewords identifiers for a set of marks, each only as long as it
   * must be to differ from the others: four words unless two IDs share a
   * prefix.
   */
  static disambiguatedIdBytewords(
    marks: readonly ProvenanceMark[],
    { prefix = false }: DisambiguatedIdentifierOptions = {},
  ): string[] {
    return disambiguatedIdentifiers(
      marks.map((m, i) => expectMark(m, `marks[${i}]`).id),
      "bytewords",
      prefix,
    );
  }

  /** Bytemoji identifiers for a set of marks, as `disambiguatedIdBytewords`. */
  static disambiguatedIdBytemoji(
    marks: readonly ProvenanceMark[],
    { prefix = false }: DisambiguatedIdentifierOptions = {},
  ): string[] {
    return disambiguatedIdentifiers(
      marks.map((m, i) => expectMark(m, `marks[${i}]`).id),
      "bytemoji",
      prefix,
    );
  }

  // Chain checks --------------------------------------------------------------

  /** Whether `next` follows this mark in its chain. */
  precedes(next: ProvenanceMark): boolean {
    try {
      this.checkPrecedes(next);
      return true;
    } catch (error) {
      if (ProvenanceMarkError.isProvenanceMarkError(error) && error.is("Validation")) return false;
      throw error;
    }
  }

  /**
   * Throws `Validation`, whose `details.issue` says why `next` does not
   * follow this mark: a genesis in second place, a sequence gap, a date
   * going backwards, or a hash that does not commit to `next`'s key.
   */
  checkPrecedes(next: ProvenanceMark): void {
    const a = this.f;
    const b = expectMark(next, "next").f;
    if (b.seq === 0) throw ProvenanceMarkError.validation({ type: "NonGenesisAtZero" });
    if (bytesEqual(b.key, b.chainId)) {
      throw ProvenanceMarkError.validation({ type: "InvalidGenesisKey" });
    }
    if (a.seq !== b.seq - 1) {
      const issue: ValidationIssue = { type: "SequenceGap", expected: a.seq + 1, actual: b.seq };
      throw ProvenanceMarkError.validation(issue);
    }
    if (a.date > b.date) {
      throw ProvenanceMarkError.validation({
        type: "DateOrdering",
        previous: new Date(a.date.getTime()),
        next: new Date(b.date.getTime()),
      });
    }
    const expectedHash = makeHash(
      a.res,
      a.key,
      b.key,
      a.chainId,
      a.seqBytes,
      a.dateBytes,
      a.infoBytes,
    );
    if (!bytesEqual(a.hash, expectedHash)) {
      throw ProvenanceMarkError.validation({
        type: "HashMismatch",
        expected: expectedHash,
        actual: new Uint8Array(a.hash),
      });
    }
  }

  /** Whether each mark precedes the next; at least two marks, a genesis first if at 0. */
  static isSequenceValid(marks: readonly ProvenanceMark[]): boolean {
    marks.forEach((m, i) => expectMark(m, `marks[${i}]`));
    if (marks.length < 2) return false;
    if (marks[0].f.seq === 0 && !marks[0].isGenesis) return false;
    for (let i = 0; i < marks.length - 1; i++) {
      if (!marks[i].precedes(marks[i + 1])) return false;
    }
    return true;
  }

  // Encodings -----------------------------------------------------------------

  private wire(): MarkWire {
    return { res: this.f.res, message: this.message };
  }

  /**
   * The message as bytewords: `standard` (space-separated words) unless
   * `uri` (hyphens) or `minimal` (two letters a word) is given.
   */
  toBytewords(style: BytewordsStyle = "standard"): string {
    return messageToBytewords(this.message, style);
  }

  /** Standard bytewords at a resolution; a decode failure is `Bytewords`. */
  static fromBytewords(res: ProvenanceMarkResolution, bytewords: string): ProvenanceMark {
    return ProvenanceMark.fromMessage(expectResolution(res), bytewordsToMessage(bytewords));
  }

  /** The `provenance` query parameter: minimal bytewords of the tagged CBOR. */
  toUrlEncoding(): string {
    return markToUrlEncoding(this.wire());
  }

  /** The `provenance` query parameter, parsed; a decode failure is `Bytewords` or `Cbor`. */
  static fromUrlEncoding(urlEncoding: string): ProvenanceMark {
    return new ProvenanceMark(markFieldsFromUrlEncoding(urlEncoding));
  }

  /**
   * `base` with the mark appended as a `provenance` query parameter. The
   * pair is appended to the query text as it stands, as the reference's
   * `append_pair` does: nothing else is re-encoded, and an existing
   * `provenance` parameter is kept (`fromUrl` then reads the first). A
   * `base` that is not a URL is `Url`.
   */
  toUrl(base: string | URL): URL {
    let url: URL;
    try {
      url = new URL(base);
    } catch (error) {
      throw ProvenanceMarkError.url(error instanceof Error ? error.message : String(error), error);
    }
    const pair = new URLSearchParams([["provenance", this.toUrlEncoding()]]).toString();
    const href = url.href;
    const hashAt = href.indexOf("#");
    const beforeHash = hashAt === -1 ? href : href.slice(0, hashAt);
    const fragment = hashAt === -1 ? "" : href.slice(hashAt);
    const queryAt = beforeHash.indexOf("?");
    const separator = queryAt === -1 ? "?" : queryAt === beforeHash.length - 1 ? "" : "&";
    return new URL(`${beforeHash}${separator}${pair}${fragment}`);
  }

  /**
   * The mark in the URL's first `provenance` query parameter. A string is
   * parsed first (a failure is `Url`); a URL without the parameter is
   * `MissingUrlParameter`.
   */
  static fromUrl(url: string | URL): ProvenanceMark {
    let parsed: URL;
    try {
      parsed = url instanceof URL ? url : new URL(url);
    } catch (error) {
      throw ProvenanceMarkError.url(error instanceof Error ? error.message : String(error), error);
    }
    const param = parsed.searchParams.get("provenance");
    if (param === null) throw ProvenanceMarkError.missingUrlParameter("provenance");
    return ProvenanceMark.fromUrlEncoding(param);
  }

  /** `[res, message]`. */
  untaggedCbor(): Cbor {
    return markUntaggedCbor(this.wire());
  }

  /** Tag `provenance` (1347571542) over `[res, message]`. */
  toCbor(): Cbor {
    return markTaggedCbor(this.wire());
  }

  /** `[TAG_PROVENANCE_MARK]`. */
  cborTags(): Tag[] {
    return [TAG_PROVENANCE_MARK];
  }

  /** The tagged-CBOR codec: `encode` is `toCbor`, `decode` is `fromCbor`. */
  static get codec(): ProvenanceMarkCodec {
    return (CODEC ??= Object.freeze({
      tags: Object.freeze([TAG_PROVENANCE_MARK]),
      encode: (value: ProvenanceMark) => value.toCbor(),
      decode: (cborValue: Cbor) => ProvenanceMark.fromCbor(cborValue),
    }));
  }

  /**
   * The tagged CBOR, decoded; the tag is required. A rejection is `Cbor`
   * with the dcbor error's message (`expected CBOR tag provenance, but got
   * …`, `the decoded CBOR value was not the expected type`, …).
   */
  static fromCbor(cborValue: Cbor): ProvenanceMark {
    return new ProvenanceMark(markFieldsFromTaggedCbor(cborValue));
  }

  /** `[res, message]`, decoded; a rejection is `Cbor` with the dcbor error's message. */
  static fromUntaggedCbor(cborValue: Cbor): ProvenanceMark {
    return new ProvenanceMark(markFieldsFromUntaggedCbor(cborValue));
  }

  /** The bytes of the tagged CBOR, decoded. */
  static fromCborData(data: Uint8Array): ProvenanceMark {
    return new ProvenanceMark(markFieldsFromCborData(data));
  }

  /** `ur:provenance/…` over the untagged CBOR. */
  toUR(): UR {
    return urFor(this);
  }

  /**
   * The mark a `provenance` UR carries. A UR of another type is `Cbor`
   * (`expected UR type provenance, but found …`), as is a body that does
   * not decode.
   */
  static fromUR(ur: UR): ProvenanceMark {
    try {
      return decodeURWith(ur, ProvenanceMark.codec);
    } catch (error) {
      if (CborError.isCborError(error)) throw ProvenanceMarkError.cborDecode(error);
      throw error;
    }
  }

  /** A leaf envelope holding the tagged CBOR. */
  toEnvelope(): Envelope {
    return Envelope.leaf(this.toCbor());
  }

  /**
   * The mark in the envelope's subject leaf. A subject that is not a
   * leaf, or a leaf that is not a mark, is `Cbor`.
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMark {
    let leaf: Cbor;
    try {
      leaf = envelope.subject().expectLeaf();
    } catch (error) {
      if (EnvelopeError.isEnvelopeError(error)) {
        throw ProvenanceMarkError.cbor(`envelope error: ${error.message}`, error);
      }
      throw error;
    }
    try {
      return ProvenanceMark.fromCbor(leaf);
    } catch (error) {
      if (ProvenanceMarkError.isProvenanceMarkError(error) && error.is("Cbor")) {
        throw ProvenanceMarkError.cbor(error.details.message, error.cause);
      }
      throw error;
    }
  }

  /** `seq, date, res, chain_id, key, hash[, info_bytes]`, as the reference serialises. */
  toJSON(): Record<string, unknown> {
    return markFieldsToJSON(this.f);
  }

  /**
   * The JSON shape, read strictly: every field required but `info_bytes`,
   * the resolution its wire number, the date RFC 3339 or `YYYY-MM-DD`,
   * bytes in base64. Any fault is `Json`, worded as serde words it.
   */
  static fromJSON(json: unknown): ProvenanceMark {
    return new ProvenanceMark(markFieldsFromJSON(json));
  }

  // Display -------------------------------------------------------------------

  /** `ProvenanceMark(<idHex>)`. */
  toString(): string {
    return `ProvenanceMark(${this.idHex})`;
  }

  /**
   * Every field, as the reference's `Debug`: hex bytes, the sequence, the
   * date display (the date alone at midnight) and the info in diagnostic
   * notation.
   */
  toDebugString(): string {
    const f = this.f;
    const components = [
      `key: ${bytesToHex(f.key)}`,
      `hash: ${bytesToHex(f.hash)}`,
      `chainID: ${bytesToHex(f.chainId)}`,
      `seq: ${f.seq}`,
      `date: ${dateToDisplay(f.date)}`,
    ];
    const info = this.info;
    if (info !== undefined) components.push(`info: ${diagnostic(info)}`);
    return `ProvenanceMark(${components.join(", ")})`;
  }

  /** Same resolution and message. */
  equals(other: ProvenanceMark): boolean {
    return (
      this.f.res === expectMark(other, "other").f.res && bytesEqual(this.message, other.message)
    );
  }
}

/** A resolution name, or a `RangeError`. */
function expectResolution(res: ProvenanceMarkResolution): ProvenanceMarkResolution {
  if (!isProvenanceMarkResolution(res)) {
    throw new RangeError(
      `res must be "low", "medium", "quartile" or "high", got ${JSON.stringify(res)}`,
    );
  }
  return res;
}
