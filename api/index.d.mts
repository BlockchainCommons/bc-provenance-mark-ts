import { Cbor, CborCodec, CborInput, CborTagged, Tag, ToCbor } from "@blockchaincommons/dcbor";
import { RngOptions } from "@blockchaincommons/rand";
import "@blockchaincommons/crypto";
import { ToUR, UR } from "@blockchaincommons/uniform-resources";
import { Envelope, ToEnvelope } from "@blockchaincommons/envelope";
import { BytewordsStyle } from "@blockchaincommons/uniform-resources/bytewords";
import { FormatContext } from "@blockchaincommons/envelope/format";
//#region src/validation-issue.d.ts
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * What `checkPrecedes` and `validate` can flag on a mark.
 */
/** Why a mark does not follow its predecessor. */
type ValidationIssue = {
  /** The predecessor's hash does not commit to this mark's key. */
  type: "HashMismatch";
  /** The hash the predecessor should carry, as hex. */
  expected: string;
  /** The hash it carries, as hex. */
  actual: string;
} | {
  /** The predecessor's hash was not made from this mark's key. */
  type: "KeyMismatch";
} | {
  /** The sequence number is not the predecessor's plus one. */
  type: "SequenceGap";
  /** The sequence number expected. */
  expected: number;
  /** The sequence number found. */
  actual: number;
} | {
  /** The date is earlier than the predecessor's. */
  type: "DateOrdering";
  /** The predecessor's date, displayed. */
  previous: string;
  /** This mark's date, displayed. */
  next: string;
} | {
  /** A mark at sequence 0 that is not a genesis mark. */
  type: "NonGenesisAtZero";
} | {
  /** A genesis mark whose key is not its chain id. */
  type: "InvalidGenesisKey";
};
/** The issue as the reference displays it. */
declare function formatValidationIssue(issue: ValidationIssue): string;
//#endregion
//#region src/error.d.ts
/** A seed or RNG state that is not 32 bytes. */
interface SeedLengthDetails<C extends "InvalidSeedLength" | "InvalidRngStateLength" = "InvalidSeedLength" | "InvalidRngStateLength"> {
  /** The discriminant. */
  code: C;
  /** The length given. */
  actual: number;
}
/** A key named in a keyed structure. */
interface KeyDetails<C extends "DuplicateKey" | "MissingKey" | "InvalidKey" = "DuplicateKey" | "MissingKey" | "InvalidKey"> {
  /** The discriminant. */
  code: C;
  /** The key's name. */
  key: string;
}
/** The codes whose details are an expected and an actual count. */
type ExpectedActualCode = "ExtraKeys" | "InvalidKeyLength" | "InvalidNextKeyLength" | "InvalidChainIdLength" | "InvalidMessageLength";
/** A count or length that must match the resolution. */
interface ExpectedActualDetails<C extends ExpectedActualCode = ExpectedActualCode> {
  /** The discriminant. */
  code: C;
  /** The count or length required. */
  expected: number;
  /** The count or length given. */
  actual: number;
}
/** Info bytes that are not CBOR. */
interface InvalidInfoCborDetails {
  /** The discriminant. */
  code: "InvalidInfoCbor";
}
/** The codes whose details are a reason in prose. */
type ReasonCode = "DateOutOfRange" | "InvalidDate" | "ResolutionError";
/** A reason in prose. */
interface ReasonDetails<C extends ReasonCode = ReasonCode> {
  /** The discriminant. */
  code: C;
  /** The reason, as the reference words it. */
  reason: string;
}
/** A URL without the `provenance` parameter. */
interface MissingUrlParameterDetails {
  /** The discriminant. */
  code: "MissingUrlParameter";
  /** The parameter's name. */
  parameter: string;
}
/** A year the 2-byte codec cannot carry. */
interface YearOutOfRangeDetails {
  /** The discriminant. */
  code: "YearOutOfRange";
  /** The year given. */
  year: number;
}
/** A month or day that is not on the calendar. */
interface InvalidMonthOrDayDetails {
  /** The discriminant. */
  code: "InvalidMonthOrDay";
  /** The year. */
  year: number;
  /** The month, 1 to 12. */
  month: number;
  /** The day of the month. */
  day: number;
}
/** The codes that wrap an encoding's or a sibling package's failure. */
type MessageCode = "Bytewords" | "Cbor" | "Url" | "Base64" | "Json" | "TryFromInt" | "Envelope";
/** A wrapped failure from an encoding or a sibling package; the error itself is `cause`. */
interface MessageDetails<C extends MessageCode = MessageCode> {
  /** The discriminant. */
  code: C;
  /** The wrapped error's message. */
  message: string;
}
/** A mark that does not follow its predecessor. */
interface ValidationDetails {
  /** The discriminant. */
  code: "Validation";
  /** Why the mark does not follow. */
  issue: ValidationIssue;
}
/** The `details` shape of every code. */
interface ProvenanceMarkErrorDetailsByCode {
  /** A seed that is not 32 bytes. */
  InvalidSeedLength: SeedLengthDetails<"InvalidSeedLength">;
  /** An RNG state that is not 32 bytes. */
  InvalidRngStateLength: SeedLengthDetails<"InvalidRngStateLength">;
  /** A key given twice. */
  DuplicateKey: KeyDetails<"DuplicateKey">;
  /** A key not given. */
  MissingKey: KeyDetails<"MissingKey">;
  /** A key with the wrong value. */
  InvalidKey: KeyDetails<"InvalidKey">;
  /** A keyed structure with the wrong number of keys. */
  ExtraKeys: ExpectedActualDetails<"ExtraKeys">;
  /** A key that is not the link length. */
  InvalidKeyLength: ExpectedActualDetails<"InvalidKeyLength">;
  /** A next key that is not the link length. */
  InvalidNextKeyLength: ExpectedActualDetails<"InvalidNextKeyLength">;
  /** A chain id that is not the link length. */
  InvalidChainIdLength: ExpectedActualDetails<"InvalidChainIdLength">;
  /** A message shorter than the resolution's fixed part. */
  InvalidMessageLength: ExpectedActualDetails<"InvalidMessageLength">;
  /** Info bytes that are not CBOR. */
  InvalidInfoCbor: InvalidInfoCborDetails;
  /** A date the codec cannot carry. */
  DateOutOfRange: ReasonDetails<"DateOutOfRange">;
  /** A date string or `Date` that holds no date. */
  InvalidDate: ReasonDetails<"InvalidDate">;
  /** A URL without the `provenance` parameter. */
  MissingUrlParameter: MissingUrlParameterDetails;
  /** A year outside 2023 to 2150 for the 2-byte codec. */
  YearOutOfRange: YearOutOfRangeDetails;
  /** A month or day that is not on the calendar. */
  InvalidMonthOrDay: InvalidMonthOrDayDetails;
  /** A resolution number, sequence number or field length the resolution refuses. */
  ResolutionError: ReasonDetails<"ResolutionError">;
  /** A bytewords decode failure. */
  Bytewords: MessageDetails<"Bytewords">;
  /** A CBOR failure. */
  Cbor: MessageDetails<"Cbor">;
  /** A URL that does not parse. */
  Url: MessageDetails<"Url">;
  /** Base64 that does not decode. */
  Base64: MessageDetails<"Base64">;
  /** JSON that does not deserialise. */
  Json: MessageDetails<"Json">;
  /** An integer outside its type. */
  TryFromInt: MessageDetails<"TryFromInt">;
  /** A mark that does not follow its predecessor. */
  Validation: ValidationDetails;
  /** An envelope that is not a generator's, or an envelope failure. */
  Envelope: MessageDetails<"Envelope">;
}
/**
 * Every code a `ProvenanceMarkError` can carry: the reference's `Error`
 * variant names, plus `InvalidRngStateLength`, whose reference counterpart
 * is a bare string.
 */
type ProvenanceMarkErrorCode = keyof ProvenanceMarkErrorDetailsByCode;
/** Every code, in one list. */
declare const PROVENANCE_MARK_ERROR_CODES: readonly ProvenanceMarkErrorCode[];
/** `details` is discriminated by `code`. */
type ProvenanceMarkErrorDetails = ProvenanceMarkErrorDetailsByCode[ProvenanceMarkErrorCode];
/** The `details` of one code. */
type ProvenanceMarkErrorDetailsFor<C extends ProvenanceMarkErrorCode> = ProvenanceMarkErrorDetailsByCode[C];
/** A `ProvenanceMarkError` whose `code` and `details` are narrowed to one code. */
type ProvenanceMarkErrorTyped<C extends ProvenanceMarkErrorCode = ProvenanceMarkErrorCode> = C extends ProvenanceMarkErrorCode ? ProvenanceMarkError & {
  /** The condition. */
  readonly code: C;
  /** The condition's fields. */
  readonly details: ProvenanceMarkErrorDetailsFor<C>;
} : never;
/**
 * The error every operation of this package throws. `code` names the
 * condition (the reference's variant names), `details` is discriminated
 * by it, and `cause` carries the sibling error when a decoder wrapped one.
 *
 * ```ts
 * try {
 *   ProvenanceMark.fromBytewords("low", words);
 * } catch (e) {
 *   if (ProvenanceMarkError.isProvenanceMarkError(e) && e.is("Bytewords")) console.log(e.details.message);
 * }
 * ```
 */
declare class ProvenanceMarkError extends Error {
  /** Always `"ProvenanceMarkError"`. */
  override readonly name = "ProvenanceMarkError";
  /** The condition, one of `ProvenanceMarkErrorCode`. */
  readonly code: ProvenanceMarkErrorCode;
  /** The fields of the condition, discriminated by `code`; frozen. */
  readonly details: ProvenanceMarkErrorDetails;
  private constructor();
  private static make;
  /** Whether `value` is a `ProvenanceMarkError`: an instance of this class. */
  static isProvenanceMarkError(value: unknown): value is ProvenanceMarkError;
  /** Whether this error's code is `code`, narrowing `details`. */
  is<C extends ProvenanceMarkErrorCode>(code: C): this is ProvenanceMarkErrorTyped<C>;
  /** `InvalidSeedLength`: a seed that is not 32 bytes. */
  static invalidSeedLength(actual: number): ProvenanceMarkErrorTyped<"InvalidSeedLength">;
  /** `InvalidRngStateLength`: an RNG state that is not 32 bytes. */
  static invalidRngStateLength(actual: number): ProvenanceMarkErrorTyped<"InvalidRngStateLength">;
  /** `DuplicateKey`: a key given twice. */
  static duplicateKey(key: string): ProvenanceMarkErrorTyped<"DuplicateKey">;
  /** `MissingKey`: a key not given. */
  static missingKey(key: string): ProvenanceMarkErrorTyped<"MissingKey">;
  /** `InvalidKey`: a key with the wrong value. */
  static invalidKey(key: string): ProvenanceMarkErrorTyped<"InvalidKey">;
  /** `ExtraKeys`: a keyed structure with the wrong number of keys. */
  static extraKeys(expected: number, actual: number): ProvenanceMarkErrorTyped<"ExtraKeys">;
  /** `InvalidKeyLength`: a key that is not the link length. */
  static invalidKeyLength(expected: number, actual: number): ProvenanceMarkErrorTyped<"InvalidKeyLength">;
  /** `InvalidNextKeyLength`: a next key that is not the link length. */
  static invalidNextKeyLength(expected: number, actual: number): ProvenanceMarkErrorTyped<"InvalidNextKeyLength">;
  /** `InvalidChainIdLength`: a chain id that is not the link length. */
  static invalidChainIdLength(expected: number, actual: number): ProvenanceMarkErrorTyped<"InvalidChainIdLength">;
  /** `InvalidMessageLength`: a message shorter than the resolution's fixed part. */
  static invalidMessageLength(expected: number, actual: number): ProvenanceMarkErrorTyped<"InvalidMessageLength">;
  /** `InvalidInfoCbor`: info bytes that are not CBOR. */
  static invalidInfoCbor(cause?: unknown): ProvenanceMarkErrorTyped<"InvalidInfoCbor">;
  /** `DateOutOfRange`: a date the codec cannot carry. */
  static dateOutOfRange(reason: string): ProvenanceMarkErrorTyped<"DateOutOfRange">;
  /** `InvalidDate`: a date string or `Date` that holds no date. */
  static invalidDate(reason: string, cause?: unknown): ProvenanceMarkErrorTyped<"InvalidDate">;
  /** `YearOutOfRange`: a year outside 2023 to 2150 for the 2-byte codec. */
  static yearOutOfRange(year: number): ProvenanceMarkErrorTyped<"YearOutOfRange">;
  /** `InvalidMonthOrDay`: a month or day that is not on the calendar. */
  static invalidMonthOrDay(year: number, month: number, day: number): ProvenanceMarkErrorTyped<"InvalidMonthOrDay">;
  /** `ResolutionError`: a resolution number, sequence number or field length the resolution refuses. */
  static resolution(reason: string): ProvenanceMarkErrorTyped<"ResolutionError">;
  /** `MissingUrlParameter`: a URL without the parameter. */
  static missingUrlParameter(parameter: string): ProvenanceMarkErrorTyped<"MissingUrlParameter">;
  private static wrapped;
  /** `Bytewords`: a bytewords decode failure (`bytewords error: …`). */
  static bytewords(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Bytewords">;
  /** `Cbor`: a CBOR failure (`CBOR error: …`). */
  static cbor(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Cbor">;
  /**
   * `Cbor` from a CBOR or UR decoder entry point, where the reference
   * returns the dcbor error itself: the message is the dcbor error's.
   */
  static cborDecode(cause: Error): ProvenanceMarkErrorTyped<"Cbor">;
  /** `Url`: a URL that does not parse (`URL parsing error: …`). */
  static url(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Url">;
  /** `Base64`: base64 that does not decode (`base64 decoding error: …`). */
  static base64(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Base64">;
  /** `Json`: JSON that does not deserialise (`JSON error: …`, worded as serde words it). */
  static json(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Json">;
  /** `TryFromInt`: an integer outside its type (`integer conversion error: …`). */
  static tryFromInt(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"TryFromInt">;
  /** `Envelope`: an envelope that is not a generator's, or an envelope failure (`envelope error: …`). */
  static envelope(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Envelope">;
  /** `Cbor`, `Bytewords` or `Envelope` for a sibling error caught inside a decoder; other values pass through. */
  static wrapForeign(error: unknown): unknown;
  /** `Validation`: a mark that does not follow its predecessor; `details.issue` says why. */
  static validation(issue: ValidationIssue): ProvenanceMarkErrorTyped<"Validation">;
}
//#endregion
//#region src/resolution.d.ts
/**
 * How much of a mark is security and how much is size: the link length
 * (key, hash and chain id) grows from 4 to 32 bytes, the date from day to
 * millisecond precision.
 */
type ProvenanceMarkResolution = "low" | "medium" | "quartile" | "high";
/** The four resolutions, in wire-number order. */
declare const PROVENANCE_MARK_RESOLUTIONS: readonly ProvenanceMarkResolution[];
/** Whether `value` is one of the four resolution names. */
declare function isProvenanceMarkResolution(value: unknown): value is ProvenanceMarkResolution;
/** The resolution's wire number, 0 to 3. */
declare function resolutionCode(res: ProvenanceMarkResolution): number;
/** The resolution a wire number names; `ResolutionError` for anything but 0 to 3. */
declare function resolutionFromCode(code: number): ProvenanceMarkResolution;
/** The length of the key, hash and chain id. */
declare function linkLength(res: ProvenanceMarkResolution): number;
/** The length of the sequence number: two bytes at low, four otherwise. */
declare function seqBytesLength(res: ProvenanceMarkResolution): number;
/** The length of the date: two bytes at low, four at medium, six otherwise. */
declare function dateBytesLength(res: ProvenanceMarkResolution): number;
/** The length of a message without its info. */
declare function fixedLength(res: ProvenanceMarkResolution): number;
/** Options naming the resolution a codec works at. */
interface ResolutionOptions {
  /** The resolution. */
  resolution: ProvenanceMarkResolution;
}
/**
 * The sequence number as big-endian bytes: two at low resolution (so at
 * most 65,535), four otherwise (at most 2^32 - 1); a u32 like the
 * reference's.
 */
declare function encodeSeq(seq: number, { resolution }: ResolutionOptions): Uint8Array;
/** The sequence number the bytes carry at the resolution; the length must match. */
declare function decodeSeq(data: Uint8Array, { resolution }: ResolutionOptions): number;
//#endregion
//#region src/date.d.ts
/** A `Date` that holds a time; `InvalidDate` otherwise. */
declare function expectDate(date: Date): Date;
/**
 * The date as the resolution stores it: two bytes (day precision, years
 * 2023 to 2150) at low, four (second precision from 2001) at medium, six
 * (millisecond precision) at quartile and high. A `Date` that holds no
 * time is `InvalidDate`.
 */
declare function encodeDate(date: Date, { resolution }: ResolutionOptions): Uint8Array;
/** The date the bytes carry at the resolution; the length must match. */
declare function decodeDate(bytes: Uint8Array, { resolution }: ResolutionOptions): Date;
/** The valid days of a month, inclusive. */
interface DayRange {
  /** The first day, 1. */
  min: number;
  /** The last day, 28 to 31. */
  max: number;
}
/** The valid days of a month, `min` to `max` inclusive. */
declare function rangeOfDaysInMonth(year: number, month: number): DayRange;
/** ISO 8601 with milliseconds, as `Date.toISOString`. */
declare function dateToIso8601(date: Date): string;
/**
 * The reference's `Date::from_string`: RFC 3339 with a zone (`Z` or an
 * offset; fractions kept to the millisecond), or a bare `YYYY-MM-DD` read
 * as UTC midnight, calendar-checked. Anything else (a time without a
 * zone, prose, an impossible date, an epoch number) is `InvalidDate`.
 */
declare function dateFromIso8601(str: string): Date;
/** `YYYY-MM-DD` in UTC. */
declare function dateToDateString(date: Date): string;
/**
 * The reference's `Date` display: `YYYY-MM-DD` when the UTC time is
 * exactly midnight (subseconds ignored), else RFC 3339 at second
 * precision such as `2023-02-08T15:30:45Z`. Every date string this
 * package emits (debug strings, JSON, validation issues, summaries) is
 * this one.
 */
declare function dateToDisplay(date: Date): string;
//#endregion
//#region src/seed.d.ts
/** The seed's length in bytes. */
declare const PROVENANCE_SEED_LENGTH = 32;
/** The 32 bytes a generator's whole chain derives from. Frozen. */
declare class ProvenanceSeed {
  private readonly data;
  private constructor();
  /** Exactly 32 bytes; anything else is `InvalidSeedLength` (a non-byte-string a `TypeError`). */
  static from(bytes: Uint8Array): ProvenanceSeed;
  /** Fresh randomness, from `rng` or the secure default. */
  static random({ rng }?: RngOptions): ProvenanceSeed;
  /** HKDF-SHA-256 of the passphrase's UTF-8 bytes. */
  static fromPassphrase(passphrase: string): ProvenanceSeed;
  /** A copy of the bytes. */
  get bytes(): Uint8Array;
  /** The bytes as hex. */
  get hex(): string;
  /** Same bytes. */
  equals(other: ProvenanceSeed): boolean;
  /** A byte string. */
  toCbor(): Cbor;
  /**
   * A seed from a CBOR byte string. A rejection is `Cbor` with the dcbor
   * error's message, or the seed error's, as the reference's
   * `TryFrom<CBOR>` reports it.
   */
  static fromCbor(cborValue: Cbor): ProvenanceSeed;
}
//#endregion
//#region src/parse.d.ts
/** A base64 32-byte seed; bad base64 is `Base64`, the wrong length `InvalidSeedLength`. */
declare function parseSeed(s: string): ProvenanceSeed;
/**
 * RFC 3339 with a zone, or `YYYY-MM-DD` (UTC midnight), as the
 * reference's `Date::from_string`; anything else is `InvalidDate`.
 */
declare function parseDate(s: string): Date;
//#endregion
//#region src/crypto-utils.d.ts
/** HKDF-SHA-256 of `data` with no salt and no info, 32 bytes: the passphrase and obfuscation KDF. */
declare function extendKey(data: Uint8Array): Uint8Array;
/**
 * XORs `message` with ChaCha20 keyed by `extendKey(key)`, the nonce being
 * the last twelve bytes of the extended key reversed. Applying it twice
 * restores the message; the empty message stays empty.
 */
declare function obfuscate(key: Uint8Array, message: Uint8Array): Uint8Array;
//#endregion
//#region src/rng-state.d.ts
/** The state's length in bytes. */
declare const RNG_STATE_LENGTH = 32;
/** The 32 bytes of xoshiro256** state a generator persists between marks. Frozen. */
declare class RngState {
  private readonly data;
  private constructor();
  /** Exactly 32 bytes; anything else is `InvalidRngStateLength` (a non-byte-string a `TypeError`). */
  static from(bytes: Uint8Array): RngState;
  /** A copy of the bytes. */
  get bytes(): Uint8Array;
  /** The bytes as hex. */
  get hex(): string;
  /** Same bytes. */
  equals(other: RngState): boolean;
  /** A byte string. */
  toCbor(): Cbor;
  /**
   * A state from a CBOR byte string. A rejection is `Cbor` with the dcbor
   * error's message, or the length error's, as the reference's
   * `TryFrom<CBOR>` reports it.
   */
  static fromCbor(cborValue: Cbor): RngState;
}
//#endregion
//#region src/mark-identifier.d.ts
/** The character that flags a provenance-mark identifier: 🅟. */
declare const MARK_ID_PREFIX = "🅟";
/** The three identifier styles. */
type IdentifierStyle = "bytewords" | "minimal" | "bytemoji";
/** The three identifier styles, for checks. */
declare const IDENTIFIER_STYLES: readonly IdentifierStyle[];
//#endregion
//#region src/mark.d.ts
/** What `ProvenanceMark.from` takes. */
interface ProvenanceMarkInput {
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
  /** The date; stored at the resolution's precision. */
  date: Date;
  /** Any CBOR the mark carries: a `Cbor`, a `ToCbor`, or a value dcbor encodes (text, numbers, bytes, arrays, maps). */
  info?: CborInput | undefined;
}
/** How to render a Mark ID. */
interface IdentifierOptions {
  /** `bytewords` (four upper-case words), `minimal` (two letters a byte) or `bytemoji`. */
  style?: IdentifierStyle | undefined;
  /** How many ID bytes to render, 4 to 32. */
  words?: number | undefined;
  /** Whether to lead with the 🅟 marker. */
  prefix?: boolean | undefined;
}
/** Options for a set of identifiers that must stay distinct. */
interface DisambiguatedIdentifierOptions {
  /** `bytewords`, `minimal` or `bytemoji`. */
  style?: IdentifierStyle | undefined;
  /** Whether to lead with the 🅟 marker. */
  prefix?: boolean | undefined;
}
/** How `toBytewords` renders. */
interface BytewordsOptions {
  /** `standard` (space-separated words), `uri` (hyphens) or `minimal` (two letters a word). */
  style?: BytewordsStyle | undefined;
}
/** A tagged-CBOR codec for marks, with the `provenance` tag. */
interface ProvenanceMarkCodec extends CborCodec<ProvenanceMark> {
  /** `[TAG_PROVENANCE_MARK]`. */
  readonly tags: readonly Tag[];
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
declare class ProvenanceMark implements ToCbor, CborTagged, ToUR, ToEnvelope {
  private readonly f;
  private constructor();
  /**
   * A mark from its parts; the hash is computed. The key, next key and
   * chain id must have the resolution's link length, the sequence number
   * must fit the resolution, the date must be one the resolution encodes.
   */
  static from({ res, key, nextKey, chainId, seq, date, info }: ProvenanceMarkInput): ProvenanceMark;
  /** A mark from its wire message at a resolution: `key ‖ obfuscated payload`. */
  static fromMessage(res: ProvenanceMarkResolution, message: Uint8Array): ProvenanceMark;
  /** The resolution. */
  get res(): ProvenanceMarkResolution;
  /** A copy of the key. */
  get key(): Uint8Array;
  /** A copy of the hash, which commits to the next mark's key. */
  get hash(): Uint8Array;
  /** A copy of the chain id. */
  get chainId(): Uint8Array;
  /** A copy of the sequence number's bytes. */
  get seqBytes(): Uint8Array;
  /** A copy of the date's bytes. */
  get dateBytes(): Uint8Array;
  /** The sequence number. */
  get seq(): number;
  /** A copy of the date, at the resolution's precision. */
  get date(): Date;
  /** The info CBOR, freshly decoded, if the mark carries any. */
  get info(): Cbor | undefined;
  /** The wire message. */
  get message(): Uint8Array;
  /** Sequence 0 with the key equal to the chain id. */
  get isGenesis(): boolean;
  /**
   * The 32-byte Mark ID: the hash, filled from the fingerprint at
   * resolutions whose hash is shorter.
   */
  get id(): Uint8Array;
  /** The Mark ID as 64 hex characters. */
  get idHex(): string;
  /** SHA-256 of the tagged CBOR. */
  fingerprint(): Uint8Array;
  /**
   * The Mark ID rendered for people: four upper-case bytewords by default;
   * `{ style: "bytemoji" }`, `{ words: 8 }`, `{ prefix: true }` for 🅟.
   * `words` outside 4 to 32, or a style that is not one of the three, is
   * a `RangeError`.
   */
  identifier({ style, words, prefix }?: IdentifierOptions): string;
  /**
   * Identifiers for a set of marks, each only as long as it must be to
   * differ from the others: four words unless two IDs share a prefix.
   */
  static disambiguatedIdentifiers(marks: readonly ProvenanceMark[], { style, prefix }?: DisambiguatedIdentifierOptions): string[];
  /** Whether `next` follows this mark in its chain. */
  precedes(next: ProvenanceMark): boolean;
  /**
   * Throws `Validation`, whose `details.issue` says why `next` does not
   * follow this mark: a genesis in second place, a sequence gap, a date
   * going backwards, or a hash that does not commit to `next`'s key.
   */
  checkPrecedes(next: ProvenanceMark): void;
  /** Whether each mark precedes the next; at least two marks, a genesis first if at 0. */
  static isSequenceValid(marks: readonly ProvenanceMark[]): boolean;
  private wire;
  /** The message as bytewords; `standard` unless a style is given. */
  toBytewords({ style }?: BytewordsOptions): string;
  /** Standard bytewords at a resolution; a decode failure is `Bytewords`. */
  static fromBytewords(res: ProvenanceMarkResolution, bytewords: string): ProvenanceMark;
  /** The `provenance` query parameter: minimal bytewords of the tagged CBOR. */
  toUrlEncoding(): string;
  /** The `provenance` query parameter, parsed; a decode failure is `Bytewords` or `Cbor`. */
  static fromUrlEncoding(urlEncoding: string): ProvenanceMark;
  /**
   * `base` with the mark as its `provenance` query parameter; an existing
   * `provenance` parameter is replaced. A `base` that is not a URL is
   * `Url`.
   */
  toUrl(base: string | URL): URL;
  /**
   * The mark in the URL's first `provenance` query parameter. A string is
   * parsed first (a failure is `Url`); a URL without the parameter is
   * `MissingUrlParameter`.
   */
  static fromUrl(url: string | URL): ProvenanceMark;
  /** `[res, message]`. */
  untaggedCbor(): Cbor;
  /** Tag `provenance` (1347571542) over `[res, message]`. */
  toCbor(): Cbor;
  /** `[TAG_PROVENANCE_MARK]`. */
  cborTags(): Tag[];
  /** The tagged-CBOR codec: `encode` is `toCbor`, `decode` is `fromCbor`. */
  static get codec(): ProvenanceMarkCodec;
  /**
   * The tagged CBOR, decoded; the tag is required. A rejection is `Cbor`
   * with the dcbor error's message (`expected CBOR tag provenance, but got
   * …`, `the decoded CBOR value was not the expected type`, …).
   */
  static fromCbor(cborValue: Cbor): ProvenanceMark;
  /** `[res, message]`, decoded; a rejection is `Cbor` with the dcbor error's message. */
  static fromUntaggedCbor(cborValue: Cbor): ProvenanceMark;
  /** The bytes of the tagged CBOR, decoded. */
  static fromCborData(data: Uint8Array): ProvenanceMark;
  /** `ur:provenance/…` over the untagged CBOR. */
  toUR(): UR;
  /**
   * The mark a `provenance` UR carries. A UR of another type is `Cbor`
   * (`expected UR type provenance, but found …`), as is a body that does
   * not decode.
   */
  static fromUR(ur: UR): ProvenanceMark;
  /** A leaf envelope holding the tagged CBOR. */
  toEnvelope(): Envelope;
  /**
   * The mark in the envelope's subject leaf. A subject that is not a
   * leaf, or a leaf that is not a mark, is `Cbor`.
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMark;
  /** `seq, date, res, chain_id, key, hash[, info_bytes]`, as the reference serialises. */
  toJSON(): Record<string, unknown>;
  /**
   * The JSON shape, read strictly: every field required but `info_bytes`,
   * the resolution its wire number, the date RFC 3339 or `YYYY-MM-DD`,
   * bytes in base64. Any fault is `Json`, worded as serde words it.
   */
  static fromJSON(json: unknown): ProvenanceMark;
  /** `ProvenanceMark(<idHex>)`. */
  toString(): string;
  /**
   * Every field, as the reference's `Debug`: hex bytes, the sequence, the
   * date display (the date alone at midnight) and the info in diagnostic
   * notation.
   */
  toDebugString(): string;
  /** Same resolution and message. */
  equals(other: ProvenanceMark): boolean;
}
//#endregion
//#region src/generator.d.ts
/** What `ProvenanceMarkGenerator.from` takes. */
interface ProvenanceMarkGeneratorInput {
  /** The resolution of every mark the chain will hold. */
  res: ProvenanceMarkResolution;
  /** The seed the chain derives from. */
  seed: ProvenanceSeed;
}
/** A persisted generator, as `fromState` takes it. */
interface ProvenanceMarkGeneratorState extends ProvenanceMarkGeneratorInput {
  /** The chain id, of the resolution's link length. */
  chainId: Uint8Array;
  /** The sequence number the next mark gets. */
  nextSeq: number;
  /** The RNG state the next key is drawn from. */
  rngState: RngState;
}
/** What `next` takes besides the date. */
interface NextMarkOptions {
  /** Any CBOR the mark carries: a `Cbor`, a `ToCbor`, or a value dcbor encodes. */
  info?: CborInput | undefined;
}
/**
 * Produces a chain of marks from a seed: the chain id and the RNG state
 * derive from the seed, each `next` draws the next key and advances the
 * state. Persist it between marks with `toJSON` or `toEnvelope`.
 *
 * ```ts
 * const generator = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
 * const genesis = generator.next(new Date("2023-06-20T12:00:00Z"));
 * const second = generator.next(new Date("2023-06-21T12:00:00Z"), { info: "second work" });
 * genesis.precedes(second); // true
 * ```
 */
declare class ProvenanceMarkGenerator implements ToEnvelope {
  private readonly _res;
  private readonly _seed;
  private readonly _chainId;
  private _nextSeq;
  private _rngState;
  private constructor();
  /** A fresh chain from a seed: the chain id is `sha256(seed)` cut to the link length. */
  static from({ res, seed }: ProvenanceMarkGeneratorInput): ProvenanceMarkGenerator;
  /** A fresh chain from `ProvenanceSeed.fromPassphrase`. */
  static fromPassphrase(res: ProvenanceMarkResolution, passphrase: string): ProvenanceMarkGenerator;
  /** A fresh chain from a random seed. */
  static random(res: ProvenanceMarkResolution, options?: RngOptions): ProvenanceMarkGenerator;
  /**
   * A generator restored mid-chain. The chain id must have the link
   * length (`InvalidChainIdLength`), the next sequence number must be a
   * u32 (`ResolutionError`).
   */
  static fromState(state: ProvenanceMarkGeneratorState): ProvenanceMarkGenerator;
  /** The resolution. */
  get res(): ProvenanceMarkResolution;
  /** The seed. */
  get seed(): ProvenanceSeed;
  /** A copy of the chain id. */
  get chainId(): Uint8Array;
  /** The sequence number the next mark gets. */
  get nextSeq(): number;
  /** The RNG state the next key is drawn from. */
  get rngState(): RngState;
  /**
   * The next mark: the genesis mark's key is the chain id, every later
   * key is drawn from the RNG (which advances); the next key is drawn
   * from a copy so the hash commits to it. A date the resolution cannot
   * encode (`YearOutOfRange`, `DateOutOfRange`, `InvalidDate`) throws
   * before any state changes.
   */
  next(date: Date, { info }?: NextMarkOptions): ProvenanceMark;
  /** `ProvenanceMarkGenerator(chainID: <hex>, res: <name>, seed: <hex>, nextSeq: <n>, rngState: <hex>)`. */
  toString(): string;
  /** `res` (wire number), `seed`, `chainID`, `nextSeq`, `rngState`, bytes in base64. */
  toJSON(): Record<string, unknown>;
  /**
   * The JSON shape, read strictly: every field required, `res` a wire
   * number, `nextSeq` a u32, `seed` and `rngState` 32 bytes of base64,
   * `chainID` base64 of the link length. Any fault is `Json`, worded as
   * serde words it.
   */
  static fromJSON(json: unknown): ProvenanceMarkGenerator;
  /**
   * The chain id as the subject, typed `provenance-generator`, with `res`,
   * `seed`, `next-seq` and `rng-state` assertions.
   */
  toEnvelope(): Envelope;
  /**
   * A generator from its envelope. An envelope not typed
   * `provenance-generator`, or missing a field, is `Envelope`; more or
   * fewer than five assertions is `ExtraKeys`; a field of the wrong
   * shape is `Cbor`.
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMarkGenerator;
}
//#endregion
//#region src/validate.d.ts
/** How `formatReport` renders: prose, one-line JSON, or indented JSON. */
type ValidationReportFormat = "text" | "jsonCompact" | "jsonPretty";
/** What `formatReport` takes besides the report. */
interface FormatReportOptions {
  /** `text` unless given. */
  format?: ValidationReportFormat | undefined;
}
/** A mark with the issues found where it joins its predecessor. */
interface FlaggedMark {
  /** The mark. */
  readonly mark: ProvenanceMark;
  /** Why it does not follow its predecessor; empty when it does. */
  readonly issues: readonly ValidationIssue[];
}
/** A run of marks that verify against one another. */
interface SequenceReport {
  /** The first mark's sequence number. */
  readonly startSeq: number;
  /** The last mark's sequence number. */
  readonly endSeq: number;
  /** The marks, in sequence order. */
  readonly marks: readonly FlaggedMark[];
}
/** Every mark sharing one chain id. */
interface ChainReport {
  /** The chain id. */
  readonly chainId: Uint8Array;
  /** Whether the chain's first mark is its genesis. */
  readonly hasGenesis: boolean;
  /** The marks, sorted by sequence number. */
  readonly marks: readonly ProvenanceMark[];
  /** The runs the chain splits into where a mark fails to follow. */
  readonly sequences: readonly SequenceReport[];
}
/** What `validate` returns. Frozen. */
interface ValidationReport {
  /** The input without exact duplicates. */
  readonly marks: readonly ProvenanceMark[];
  /** Sorted by chain id. */
  readonly chains: readonly ChainReport[];
}
/** The chain id as hex. */
declare function chainIdHex(report: ChainReport): string;
/**
 * Whether anything is wrong: a chain without genesis, a flagged mark, more
 * than one chain, or a chain in more than one sequence.
 */
declare function hasIssues(report: ValidationReport): boolean;
/**
 * The report as text (empty when there is nothing to report) or JSON. A
 * format that is not one of the three is a `RangeError`.
 */
declare function formatReport(report: ValidationReport, { format }?: FormatReportOptions): string;
/**
 * Validates a set of marks: drops exact duplicates, bins by chain id,
 * sorts each chain by sequence, splits it into verifying runs, and orders
 * the chains by id.
 */
declare function validate(marks: readonly ProvenanceMark[]): ValidationReport;
//#endregion
//#region src/mark-info.d.ts
/** What `ProvenanceMarkInfo.from` takes besides the mark. */
interface MarkInfoOptions {
  /** Free text to show with the mark; empty by default. */
  comment?: string | undefined;
}
/** A mark with its UR and identifiers rendered once, plus a comment, for display. Frozen. */
declare class ProvenanceMarkInfo {
  private readonly _mark;
  private readonly _ur;
  private readonly _bytewords;
  private readonly _bytemoji;
  private readonly _comment;
  private constructor();
  /** The mark's UR and its 🅟-prefixed four-word identifiers. */
  static from(mark: ProvenanceMark, { comment }?: MarkInfoOptions): ProvenanceMarkInfo;
  /** The mark. */
  get mark(): ProvenanceMark;
  /** The mark's UR. */
  get ur(): UR;
  /** The 🅟-prefixed bytewords identifier. */
  get bytewords(): string;
  /** The 🅟-prefixed bytemoji identifier. */
  get bytemoji(): string;
  /** The comment, possibly empty. */
  get comment(): string;
  /** A Markdown block: rule, date, the UR and bytewords as headings, the bytemoji, the comment. */
  markdownSummary(): string;
  /** `ur, bytewords, bytemoji[, comment], mark`, as the reference serialises. */
  toJSON(): Record<string, unknown>;
  /**
   * The JSON shape, read strictly: `ur`, `bytewords` and `bytemoji`
   * required strings, `comment` optional, the mark taken from the UR.
   * Any fault is `Json`.
   */
  static fromJSON(json: unknown): ProvenanceMarkInfo;
}
//#endregion
//#region src/envelope.d.ts
/**
 * Registers envelope's tags and summarisers, then the provenance-mark
 * summariser, in `context` (the reference's `register_tags_in`).
 */
declare function registerTagsIn(context: FormatContext): void;
/**
 * `registerTagsIn` on the global format context (the reference's
 * `register_tags`): envelope's `registerTags()`, which installs the
 * envelope summarisers once, then the provenance-mark summariser.
 */
declare function registerTags(): void;
//#endregion
export { type BytewordsOptions, type ChainReport, type DayRange, type DisambiguatedIdentifierOptions, type ExpectedActualCode, type ExpectedActualDetails, type FlaggedMark, type FormatReportOptions, IDENTIFIER_STYLES, type IdentifierOptions, type IdentifierStyle, type InvalidInfoCborDetails, type InvalidMonthOrDayDetails, type KeyDetails, MARK_ID_PREFIX, type MarkInfoOptions, type MessageCode, type MessageDetails, type MissingUrlParameterDetails, type NextMarkOptions, PROVENANCE_MARK_ERROR_CODES, PROVENANCE_MARK_RESOLUTIONS, PROVENANCE_SEED_LENGTH, ProvenanceMark, type ProvenanceMarkCodec, ProvenanceMarkError, type ProvenanceMarkErrorCode, type ProvenanceMarkErrorDetails, type ProvenanceMarkErrorDetailsByCode, type ProvenanceMarkErrorDetailsFor, type ProvenanceMarkErrorTyped, ProvenanceMarkGenerator, type ProvenanceMarkGeneratorInput, type ProvenanceMarkGeneratorState, ProvenanceMarkInfo, type ProvenanceMarkInput, type ProvenanceMarkResolution, ProvenanceSeed, RNG_STATE_LENGTH, type ReasonCode, type ReasonDetails, type ResolutionOptions, RngState, type SeedLengthDetails, type SequenceReport, type ValidationDetails, type ValidationIssue, type ValidationReport, type ValidationReportFormat, type YearOutOfRangeDetails, chainIdHex, dateBytesLength, dateFromIso8601, dateToDateString, dateToDisplay, dateToIso8601, decodeDate, decodeSeq, encodeDate, encodeSeq, expectDate, extendKey, fixedLength, formatReport, formatValidationIssue, hasIssues, isProvenanceMarkResolution, linkLength, obfuscate, parseDate, parseSeed, rangeOfDaysInMonth, registerTags, registerTagsIn, resolutionCode, resolutionFromCode, seqBytesLength, validate };
//# sourceMappingURL=index.d.mts.map