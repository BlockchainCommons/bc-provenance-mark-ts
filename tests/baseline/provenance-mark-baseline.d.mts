import { Cbor } from "@blockchaincommons/dcbor-compat";
import { BytewordsStyle, UR } from "@blockchaincommons/uniform-resources";
import { Envelope, FormatContext, FormatContext as FormatContext$1 } from "@blockchaincommons/envelope";
//#region src/error.d.ts
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 */
/**
 * Error types for Provenance Mark operations.
 */
declare enum ProvenanceMarkErrorType {
  /** Invalid Seed length */
  InvalidSeedLength = "InvalidSeedLength",
  /** Duplicate key */
  DuplicateKey = "DuplicateKey",
  /** Missing key */
  MissingKey = "MissingKey",
  /** Invalid key */
  InvalidKey = "InvalidKey",
  /** Extra keys */
  ExtraKeys = "ExtraKeys",
  /** Invalid key length for the given resolution */
  InvalidKeyLength = "InvalidKeyLength",
  /** Invalid next key length for the given resolution */
  InvalidNextKeyLength = "InvalidNextKeyLength",
  /** Invalid chain ID length for the given resolution */
  InvalidChainIdLength = "InvalidChainIdLength",
  /** Invalid message length for the given resolution */
  InvalidMessageLength = "InvalidMessageLength",
  /** Invalid CBOR data in info field */
  InvalidInfoCbor = "InvalidInfoCbor",
  /** Date out of range for serialization */
  DateOutOfRange = "DateOutOfRange",
  /** Invalid date components */
  InvalidDate = "InvalidDate",
  /** Missing required URL parameter */
  MissingUrlParameter = "MissingUrlParameter",
  /** Year out of range for 2-byte serialization */
  YearOutOfRange = "YearOutOfRange",
  /** Invalid month or day */
  InvalidMonthOrDay = "InvalidMonthOrDay",
  /** Resolution serialization error */
  ResolutionError = "ResolutionError",
  /** Bytewords encoding/decoding error */
  BytewordsError = "BytewordsError",
  /** CBOR encoding/decoding error */
  CborError = "CborError",
  /** URL parsing error */
  UrlError = "UrlError",
  /** Base64 decoding error */
  Base64Error = "Base64Error",
  /** JSON serialization error */
  JsonError = "JsonError",
  /** Integer conversion error */
  IntegerConversionError = "IntegerConversionError",
  /** Validation error */
  ValidationError = "ValidationError",
  /**
   * Envelope serialization/deserialization error.
   *
   * Mirrors Rust `Error::Envelope(...)`
   * (`provenance-mark-rust/src/error.rs`). The Rust enum surfaces
   * envelope-format failures as their own variant; in earlier
   * revisions of this port they collapsed into `CborError`. Both
   * shapes are still emitted in practice (CBOR errors during envelope
   * round-trip stay as `CborError`); this variant exists for the
   * structural-level mismatches the Rust port tags as
   * `Error::Envelope`.
   */
  EnvelopeError = "EnvelopeError"
}
/**
 * Error class for Provenance Mark operations.
 */
declare class ProvenanceMarkError extends Error {
  readonly type: ProvenanceMarkErrorType;
  readonly details?: Record<string, unknown> | undefined;
  constructor(type: ProvenanceMarkErrorType, message?: string, details?: Record<string, unknown>);
  private static defaultMessage;
}
/**
 * Result type for Provenance Mark operations.
 */
type ProvenanceMarkResult<T> = T;
//#endregion
//#region src/resolution.d.ts
/**
 * Resolution levels for provenance marks.
 * Higher resolution provides more security but larger mark sizes.
 */
declare enum ProvenanceMarkResolution {
  Low = 0,
  Medium = 1,
  Quartile = 2,
  High = 3
}
/**
 * Convert a resolution to its numeric value.
 */
declare function resolutionToNumber(res: ProvenanceMarkResolution): number;
/**
 * Create a resolution from a numeric value.
 */
declare function resolutionFromNumber(value: number): ProvenanceMarkResolution;
/**
 * Get the link length (key/hash/chainID length) for a resolution.
 */
declare function linkLength(res: ProvenanceMarkResolution): number;
/**
 * Get the sequence bytes length for a resolution.
 */
declare function seqBytesLength(res: ProvenanceMarkResolution): number;
/**
 * Get the date bytes length for a resolution.
 */
declare function dateBytesLength(res: ProvenanceMarkResolution): number;
/**
 * Get the fixed-length portion size for a resolution.
 */
declare function fixedLength(res: ProvenanceMarkResolution): number;
/**
 * Get the key range for a resolution.
 */
declare function keyRange(res: ProvenanceMarkResolution): {
  start: number;
  end: number;
};
/**
 * Get the chain ID range for a resolution.
 */
declare function chainIdRange(res: ProvenanceMarkResolution): {
  start: number;
  end: number;
};
/**
 * Get the hash range for a resolution.
 */
declare function hashRange(res: ProvenanceMarkResolution): {
  start: number;
  end: number;
};
/**
 * Get the sequence bytes range for a resolution.
 */
declare function seqBytesRange(res: ProvenanceMarkResolution): {
  start: number;
  end: number;
};
/**
 * Get the date bytes range for a resolution.
 */
declare function dateBytesRange(res: ProvenanceMarkResolution): {
  start: number;
  end: number;
};
/**
 * Get the info range start for a resolution.
 */
declare function infoRangeStart(res: ProvenanceMarkResolution): number;
/**
 * Serialize a Date into bytes based on the resolution.
 */
declare function serializeDate(res: ProvenanceMarkResolution, date: Date): Uint8Array;
/**
 * Deserialize bytes into a Date based on the resolution.
 */
declare function deserializeDate(res: ProvenanceMarkResolution, data: Uint8Array): Date;
/**
 * Serialize a sequence number into bytes based on the resolution.
 *
 * Mirrors Rust's typed `u32` parameter (`generator.rs::serialize_seq`)
 * — the input must be a non-negative integer in `[0, 2^32-1]` (a u32).
 * For Low resolution the upper bound additionally narrows to `2^16-1`
 * (a u16) per Rust `if seq > 0xFFFF`. Earlier revisions of this port
 * accepted any JS `number` for the 4-byte branch and would silently
 * truncate values above `2^32-1`; now we raise `ResolutionError` so
 * the wire output never deviates from Rust's u32 contract.
 */
declare function serializeSeq(res: ProvenanceMarkResolution, seq: number): Uint8Array;
/**
 * Deserialize bytes into a sequence number based on the resolution.
 */
declare function deserializeSeq(res: ProvenanceMarkResolution, data: Uint8Array): number;
/**
 * Get the string representation of a resolution.
 */
declare function resolutionToString(res: ProvenanceMarkResolution): string;
/**
 * Convert a resolution to CBOR.
 */
declare function resolutionToCbor(res: ProvenanceMarkResolution): Cbor;
/**
 * Create a resolution from CBOR.
 */
declare function resolutionFromCbor(cborValue: Cbor): ProvenanceMarkResolution;
//#endregion
//#region src/date.d.ts
/**
 * Interface for serializable date operations.
 */
interface SerializableDate {
  serialize2Bytes(): Uint8Array;
  serialize4Bytes(): Uint8Array;
  serialize6Bytes(): Uint8Array;
}
/**
 * Serialize a date to 2 bytes (year + month + day only, day precision).
 * Year range: 2023-2150 (128 years)
 * Format: YYYYYYY MMMM DDDDD (7 bits year offset, 4 bits month, 5 bits day)
 */
declare function serialize2Bytes(date: Date): Uint8Array;
/**
 * Deserialize 2 bytes to a date.
 */
declare function deserialize2Bytes(bytes: Uint8Array): Date;
/**
 * Serialize a date to 4 bytes (seconds since 2001-01-01).
 */
declare function serialize4Bytes(date: Date): Uint8Array;
/**
 * Deserialize 4 bytes to a date.
 */
declare function deserialize4Bytes(bytes: Uint8Array): Date;
/**
 * Serialize a date to 6 bytes (milliseconds since 2001-01-01).
 */
declare function serialize6Bytes(date: Date): Uint8Array;
/**
 * Deserialize 6 bytes to a date.
 */
declare function deserialize6Bytes(bytes: Uint8Array): Date;
/**
 * Get the range of valid days in a month.
 */
declare function rangeOfDaysInMonth(year: number, month: number): {
  min: number;
  max: number;
};
/**
 * Format a date as ISO8601 string.
 */
declare function dateToIso8601(date: Date): string;
/**
 * Parse an ISO8601 string to a Date.
 */
declare function dateFromIso8601(str: string): Date;
/**
 * Format a date as a simple date string (YYYY-MM-DD).
 */
declare function dateToDateString(date: Date): string;
/**
 * Renders a `Date` the way Rust's `dcbor::Date::Display` does
 * (`bc-dcbor-rust/src/date.rs:485-492`):
 *
 * - When the UTC time is exactly `00:00:00` (subsecond precision is
 *   ignored — Rust's check is `hour == 0 && minute == 0 && second == 0`,
 *   matching `chrono::SecondsFormat::Secs`), emit just `YYYY-MM-DD`.
 * - Otherwise emit RFC 3339 with second precision (no fractional
 *   seconds), e.g. `2023-02-08T15:30:45Z`.
 *
 * This is the canonical "Rust string" for dates across the
 * provenance-mark public surface — `mark.toDebugString`,
 * `mark.precedesOpt` `DateOrdering` issue, `markdownSummary`, and the
 * validation report's `DateOrdering` payload all use it. Centralising
 * here keeps every call site in lockstep with the Rust output.
 *
 * @example
 * ```typescript
 * dateToDisplay(new Date("2023-06-20T00:00:00Z"));   // "2023-06-20"
 * dateToDisplay(new Date("2023-06-20T15:30:45Z"));   // "2023-06-20T15:30:45Z"
 * dateToDisplay(new Date("2023-06-20T15:30:45.123Z")); // "2023-06-20T15:30:45Z"
 * ```
 */
declare function dateToDisplay(date: Date): string;
//#endregion
//#region src/seed.d.ts
declare const PROVENANCE_SEED_LENGTH = 32;
/**
 * A seed for generating provenance marks.
 */
declare class ProvenanceSeed {
  private readonly data;
  private constructor();
  /**
   * Create a new random seed using secure random number generation.
   */
  static new(): ProvenanceSeed;
  /**
   * Create a new seed using custom random data.
   */
  static newUsing(randomData: Uint8Array): ProvenanceSeed;
  /**
   * Create a new seed from a passphrase.
   */
  static newWithPassphrase(passphrase: string): ProvenanceSeed;
  /**
   * Get the raw bytes.
   */
  toBytes(): Uint8Array;
  /**
   * Create from a 32-byte array.
   */
  static fromBytes(bytes: Uint8Array): ProvenanceSeed;
  /**
   * Create from a slice (validates length).
   */
  static fromSlice(bytes: Uint8Array): ProvenanceSeed;
  /**
   * Get the hex representation.
   */
  hex(): string;
  /**
   * Convert to CBOR (byte string).
   */
  toCbor(): Cbor;
  /**
   * Create from CBOR (byte string).
   */
  static fromCbor(cborValue: Cbor): ProvenanceSeed;
}
//#endregion
//#region src/utils.d.ts
/**
 * Parse a base64-encoded provenance seed.
 *
 * Mirrors Rust's `parse_seed` user helper
 * (`provenance-mark-rust/src/util.rs:34-38`), which round-trips the
 * input through serde JSON / `deserialize_block` and so requires the
 * decoded bytes to be exactly {@link PROVENANCE_SEED_LENGTH} (32) long.
 * The TS equivalent decodes the base64 directly and delegates to
 * {@link ProvenanceSeed.fromBytes} for the length check.
 *
 * @param s - Base64-encoded 32-byte seed string.
 * @returns The decoded {@link ProvenanceSeed}.
 * @throws {ProvenanceMarkError} If the input is not valid base64 or the
 *   decoded length is not exactly 32 bytes.
 */
declare function parseSeed(s: string): ProvenanceSeed;
/**
 * Parse a date string (`YYYY-MM-DD` or full RFC 3339) into a `Date`.
 *
 * Mirrors Rust's `parse_date` user helper
 * (`provenance-mark-rust/src/util.rs:40-42`), which delegates to
 * `Date::from_string` (the same parser the JSON deserializer uses).
 * Accepts the same shapes the Rust parser does:
 *
 * - `YYYY-MM-DD` (interpreted as UTC midnight, matching JS spec).
 * - Full RFC 3339, e.g. `2023-06-20T15:30:45Z` or
 *   `2023-06-20T15:30:45.123Z`.
 *
 * @throws {ProvenanceMarkError} If the input fails to parse.
 */
declare function parseDate(s: string): Date;
//#endregion
//#region src/crypto-utils.d.ts
declare const SHA256_SIZE = 32;
/**
 * Compute SHA-256 hash of data.
 */
declare function sha256(data: Uint8Array): Uint8Array;
/**
 * Compute SHA-256 hash and return a prefix of the given length.
 */
declare function sha256Prefix(data: Uint8Array, prefix: number): Uint8Array;
/**
 * Extend a key to 32 bytes using HKDF-HMAC-SHA-256.
 */
declare function extendKey(data: Uint8Array): Uint8Array;
/**
 * Compute HKDF-HMAC-SHA-256 for the given key material.
 */
declare function hkdfHmacSha256(keyMaterial: Uint8Array, salt: Uint8Array, keyLen: number): Uint8Array;
/**
 * Obfuscate (or deobfuscate) a message using ChaCha20.
 * The function is symmetric - applying it twice returns the original message.
 */
declare function obfuscate(key: Uint8Array, message: Uint8Array): Uint8Array;
//#endregion
//#region src/xoshiro256starstar.d.ts
/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 */
/**
 * Xoshiro256** PRNG implementation.
 * A fast, high-quality pseudorandom number generator.
 */
declare class Xoshiro256StarStar {
  private s;
  private constructor();
  /**
   * Get the internal state as an array of 4 u64 values.
   */
  toState(): [bigint, bigint, bigint, bigint];
  /**
   * Create a new PRNG from a state array.
   */
  static fromState(state: [bigint, bigint, bigint, bigint]): Xoshiro256StarStar;
  /**
   * Serialize the state to 32 bytes (little-endian).
   */
  toData(): Uint8Array;
  /**
   * Create a new PRNG from 32 bytes of seed data (little-endian).
   */
  static fromData(data: Uint8Array): Xoshiro256StarStar;
  /**
   * Generate the next u64 value.
   */
  nextU64(): bigint;
  /**
   * Generate the next u32 value (upper bits of u64 for better quality).
   */
  nextU32(): number;
  /**
   * Generate the next byte.
   */
  nextByte(): number;
  /**
   * Generate the next n bytes.
   */
  nextBytes(len: number): Uint8Array;
  /**
   * Fill a buffer with random bytes.
   */
  fillBytes(dest: Uint8Array): void;
  /**
   * The starstar transformation: x * 5, rotate left 7, * 9
   */
  private starstarU64;
  /**
   * Rotate a 64-bit value left by n bits.
   */
  private rotateLeft64;
  /**
   * Advance the PRNG state.
   */
  private advance;
}
//#endregion
//#region src/rng-state.d.ts
declare const RNG_STATE_LENGTH = 32;
/**
 * RNG state for provenance marks (32 bytes).
 */
declare class RngState {
  private readonly data;
  private constructor();
  /**
   * Get the raw bytes.
   */
  toBytes(): Uint8Array;
  /**
   * Create from a 32-byte array.
   */
  static fromBytes(bytes: Uint8Array): RngState;
  /**
   * Create from a slice (validates length).
   */
  static fromSlice(bytes: Uint8Array): RngState;
  /**
   * Get the hex representation.
   */
  hex(): string;
  /**
   * Convert to CBOR (byte string).
   */
  toCbor(): Cbor;
  /**
   * Create from CBOR (byte string).
   */
  static fromCbor(cborValue: Cbor): RngState;
}
//#endregion
//#region src/validate.d.ts
/**
 * Format for validation report output.
 */
declare enum ValidationReportFormat {
  /** Human-readable text format */
  Text = "text",
  /** Compact JSON format (no whitespace) */
  JsonCompact = "json-compact",
  /** Pretty-printed JSON format (with indentation) */
  JsonPretty = "json-pretty"
}
/**
 * Issue flagged during validation.
 */
type ValidationIssue = {
  type: "HashMismatch";
  expected: string;
  actual: string;
} | {
  type: "KeyMismatch";
} | {
  type: "SequenceGap";
  expected: number;
  actual: number;
} | {
  type: "DateOrdering";
  previous: string;
  next: string;
} | {
  type: "NonGenesisAtZero";
} | {
  type: "InvalidGenesisKey";
};
/**
 * Format a validation issue as a string.
 */
declare function formatValidationIssue(issue: ValidationIssue): string;
/**
 * A mark with any issues flagged during validation.
 */
interface FlaggedMark {
  mark: ProvenanceMark;
  issues: ValidationIssue[];
}
/**
 * Report for a contiguous sequence of marks within a chain.
 */
interface SequenceReport {
  startSeq: number;
  endSeq: number;
  marks: FlaggedMark[];
}
/**
 * Report for a chain of marks with the same chain ID.
 */
interface ChainReport {
  chainId: Uint8Array;
  hasGenesis: boolean;
  marks: ProvenanceMark[];
  sequences: SequenceReport[];
}
/**
 * Get the chain ID as a hex string for display.
 */
declare function chainIdHex(report: ChainReport): string;
/**
 * Complete validation report.
 */
interface ValidationReport {
  marks: ProvenanceMark[];
  chains: ChainReport[];
}
/**
 * Check if the validation report has any issues.
 */
declare function hasIssues(report: ValidationReport): boolean;
/**
 * Format the validation report.
 */
declare function formatReport(report: ValidationReport, format: ValidationReportFormat): string;
/**
 * Validate a collection of provenance marks.
 */
declare function validate(marks: ProvenanceMark[]): ValidationReport;
//#endregion
//#region src/mark.d.ts
/**
 * A cryptographically-secured provenance mark.
 */
declare class ProvenanceMark {
  private readonly _res;
  private readonly _key;
  private readonly _hash;
  private readonly _chainId;
  private readonly _seqBytes;
  private readonly _dateBytes;
  private readonly _infoBytes;
  private readonly _seq;
  private readonly _date;
  private constructor();
  res(): ProvenanceMarkResolution;
  key(): Uint8Array;
  hash(): Uint8Array;
  chainId(): Uint8Array;
  seqBytes(): Uint8Array;
  dateBytes(): Uint8Array;
  seq(): number;
  date(): Date;
  /**
   * Get the message (serialized bytes) of this mark.
   */
  message(): Uint8Array;
  /**
   * Get the info field as CBOR, if present.
   */
  info(): Cbor | undefined;
  /**
   * Create a new provenance mark.
   */
  static new(res: ProvenanceMarkResolution, key: Uint8Array, nextKey: Uint8Array, chainId: Uint8Array, seq: number, date: Date, info?: Cbor): ProvenanceMark;
  /**
   * Create a provenance mark from a serialized message.
   */
  static fromMessage(res: ProvenanceMarkResolution, message: Uint8Array): ProvenanceMark;
  private static makeHash;
  /**
   * The 32-byte Mark ID.
   *
   * The first `linkLength` bytes are the mark's stored hash. The remaining
   * bytes come from the mark's fingerprint (SHA-256 of CBOR encoding),
   * ensuring a full 32-byte value is always available regardless of
   * resolution.
   */
  id(): Uint8Array;
  /**
   * The full 32-byte Mark ID as a 64-character hex string.
   */
  idHex(): string;
  /**
   * The first `wordCount` bytes of the Mark ID as upper-case ByteWords.
   *
   * @param wordCount Number of bytes to encode, must be in `4..=32`.
   * @param prefix If `true`, prepends the provenance-mark prefix character.
   * @throws if `wordCount` is not in the range `4..=32`.
   */
  idBytewords(wordCount: number, prefix: boolean): string;
  /**
   * The first `wordCount` bytes of the Mark ID as Bytemoji.
   *
   * @param wordCount Number of bytes to encode, must be in `4..=32`.
   * @param prefix If `true`, prepends the provenance-mark prefix character.
   * @throws if `wordCount` is not in the range `4..=32`.
   */
  idBytemoji(wordCount: number, prefix: boolean): string;
  /**
   * The first `wordCount` bytes of the Mark ID as upper-case minimal
   * ByteWords (2 letters per byte, concatenated without separator).
   *
   * @param wordCount Number of bytes to encode, must be in `4..=32`.
   * @param prefix If `true`, prepends the provenance-mark prefix character.
   * @throws if `wordCount` is not in the range `4..=32`.
   */
  idBytewordsMinimal(wordCount: number, prefix: boolean): string;
  /**
   * Legacy 8-character hex identifier — the first 4 bytes of the Mark ID.
   *
   * @deprecated Use {@link idHex} for the full 64-char hex, or
   *   `idHex().slice(0, 8)` for this legacy short form. Retained for
   *   backwards compatibility; will be removed in a future alpha.
   */
  identifier(): string;
  /**
   * Legacy 4-byte upper-case ByteWords identifier.
   *
   * @deprecated Equivalent to `idBytewords(4, prefix)`. Retained for
   *   backwards compatibility; will be removed in a future alpha.
   */
  bytewordsIdentifier(prefix: boolean): string;
  /**
   * Legacy 8-letter minimal ByteWords identifier (first+last letter of each
   * of the 4 ByteWords). Example: "ABLE ACID ALSO APEX" -> "AEADAOAX".
   *
   * @deprecated Equivalent to `idBytewordsMinimal(4, prefix)`. Retained
   *   for backwards compatibility; will be removed in a future alpha.
   */
  bytewordsMinimalIdentifier(prefix: boolean): string;
  /**
   * Legacy 4-byte upper-case Bytemoji identifier.
   *
   * @deprecated Equivalent to `idBytemoji(4, prefix)`. Retained for
   *   backwards compatibility; will be removed in a future alpha.
   */
  bytemojiIdentifier(prefix: boolean): string;
  /**
   * Computes the minimum prefix length (in bytes, `4..=32`) each mark needs
   * so that every mark in the set has a unique Mark ID prefix.
   *
   * Non-colliding marks get the minimum of 4. Only marks whose 4-byte
   * prefixes collide are extended.
   */
  private static minimalNoncollidingPrefixLengths;
  private static resolveCollisionGroup;
  /**
   * Returns disambiguated upper-case ByteWords Mark IDs for a set of marks.
   *
   * Non-colliding marks get 4-word identifiers. Only marks whose 4-byte
   * prefixes collide are extended with additional words (up to 32 bytes
   * per identifier).
   */
  static disambiguatedIdBytewords(marks: ProvenanceMark[], prefix: boolean): string[];
  /**
   * Returns disambiguated Bytemoji Mark IDs for a set of marks.
   *
   * Non-colliding marks get 4-emoji identifiers. Only marks whose 4-byte
   * prefixes collide are extended with additional emojis (up to 32 bytes
   * per identifier).
   */
  static disambiguatedIdBytemoji(marks: ProvenanceMark[], prefix: boolean): string[];
  /**
   * Check if this mark precedes another mark in the chain.
   */
  precedes(next: ProvenanceMark): boolean;
  /**
   * Check if this mark precedes another mark, throwing on validation errors.
   * Errors carry a structured `validationIssue` in their details, matching Rust's
   * `Error::Validation(ValidationIssue)` pattern.
   */
  precedesOpt(next: ProvenanceMark): void;
  /**
   * Check if a sequence of marks is valid.
   */
  static isSequenceValid(marks: ProvenanceMark[]): boolean;
  /**
   * Check if this is a genesis mark (seq 0 and key equals chain_id).
   */
  isGenesis(): boolean;
  /**
   * Encode as bytewords with the given style.
   */
  toBytewordsWithStyle(style: BytewordsStyle): string;
  /**
   * Encode as standard bytewords.
   */
  toBytewords(): string;
  /**
   * Decode from bytewords.
   */
  static fromBytewords(res: ProvenanceMarkResolution, bytewords: string): ProvenanceMark;
  /**
   * Encode for URL (minimal bytewords of tagged CBOR).
   */
  toUrlEncoding(): string;
  /**
   * Decode from URL encoding.
   */
  static fromUrlEncoding(urlEncoding: string): ProvenanceMark;
  /**
   * Returns the {@link UR} representation of this mark (untagged CBOR
   * with type `"provenance"`).
   *
   * Mirrors Rust `UREncodable::ur()` for `ProvenanceMark` — the
   * blanket impl on `CBORTaggedEncodable` produces a UR whose
   * payload is the *untagged* CBOR (the type name itself stands in
   * for the tag). See `bc-ur-rust/src/ur_encodable.rs:8-18`.
   */
  ur(): UR;
  /**
   * Get the UR string representation (e.g., "ur:provenance/...").
   */
  urString(): string;
  /**
   * Create from a UR string.
   */
  static fromURString(urString: string): ProvenanceMark;
  /**
   * Build a URL with this mark as a query parameter.
   */
  toUrl(base: string): URL;
  /**
   * Parse a provenance mark from a URL.
   */
  static fromUrl(url: URL): ProvenanceMark;
  /**
   * Get the untagged CBOR representation.
   */
  untaggedCbor(): Cbor;
  /**
   * Get the tagged CBOR representation.
   */
  taggedCbor(): Cbor;
  /**
   * Serialize to CBOR bytes (tagged).
   */
  toCborData(): Uint8Array;
  /**
   * Create from untagged CBOR.
   */
  static fromUntaggedCbor(cborValue: Cbor): ProvenanceMark;
  /**
   * Create from tagged CBOR.
   */
  static fromTaggedCbor(cborValue: Cbor): ProvenanceMark;
  /**
   * Create from CBOR bytes.
   */
  static fromCborData(data: Uint8Array): ProvenanceMark;
  /**
   * Get the fingerprint (SHA-256 of CBOR data).
   */
  fingerprint(): Uint8Array;
  /**
   * Debug string representation.
   *
   * As of provenance-mark v0.24, this includes the full 64-character Mark ID
   * hex (matching rust's `Display` impl). Pre-v0.24 callers that depended on
   * the 8-character prefix should use `idHex().slice(0, 8)` directly.
   */
  toString(): string;
  /**
   * Detailed debug representation.
   *
   * Mirrors Rust `Mark::Debug` exactly: every field is rendered
   * Rust-style (hex bytes for keys/hashes/IDs, plain integer for
   * `seq`, `Date::Display` for the date). The Low-resolution test
   * vector in Rust `tests/mark.rs::test_low_resolution` ends with
   * `date: 2023-06-20` — i.e. midnight-UTC dates are rendered without
   * a time suffix. We use {@link dateToDisplay} to mirror that
   * exactly; earlier revisions of this port stripped just the
   * `.000Z` fractional component, which left `2023-06-20T00:00:00Z`
   * and broke the Low-resolution debug-string parity.
   */
  toDebugString(): string;
  /**
   * Check equality with another mark.
   */
  equals(other: ProvenanceMark): boolean;
  /**
   * JSON serialization. Field order, names, and date format mirror Rust's
   * `#[derive(Serialize)]` on `ProvenanceMark` (provenance-mark-rust/src/mark.rs):
   * `seq, date, res, chain_id, key, hash[, info_bytes]`. The date uses
   * `dateToDisplay()` (date-only when midnight, RFC3339-seconds with `Z`
   * otherwise), matching Rust's `serialize_iso8601` / `Date::to_string()`.
   */
  toJSON(): Record<string, unknown>;
  /**
   * Create from JSON object.
   */
  static fromJSON(json: Record<string, unknown>): ProvenanceMark;
  /**
   * Validate a collection of provenance marks.
   *
   * Matches Rust: `ProvenanceMark::validate()` which delegates to
   * `ValidationReport::validate()`.
   */
  static validate(marks: ProvenanceMark[]): ValidationReport;
  /**
   * Convert this provenance mark to a Gordian Envelope.
   *
   * Creates a leaf envelope containing the tagged CBOR representation.
   * Matches Rust: `Envelope::new(mark.to_cbor())` which creates a CBOR leaf.
   */
  intoEnvelope(): Envelope;
  /**
   * Extract a ProvenanceMark from a Gordian Envelope.
   *
   * Matches Rust: `envelope.subject().try_leaf()?.try_into()`
   *
   * @param envelope - The envelope to extract from
   * @returns The extracted provenance mark
   * @throws ProvenanceMarkError if extraction fails
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMark;
}
//#endregion
//#region src/generator.d.ts
/**
 * Generator for creating provenance mark chains.
 */
declare class ProvenanceMarkGenerator {
  private readonly _res;
  private readonly _seed;
  private readonly _chainId;
  private _nextSeq;
  private _rngState;
  private constructor();
  res(): ProvenanceMarkResolution;
  seed(): ProvenanceSeed;
  chainId(): Uint8Array;
  nextSeq(): number;
  rngState(): RngState;
  /**
   * Create a new generator with a seed.
   */
  static newWithSeed(res: ProvenanceMarkResolution, seed: ProvenanceSeed): ProvenanceMarkGenerator;
  /**
   * Create a new generator with a passphrase.
   */
  static newWithPassphrase(res: ProvenanceMarkResolution, passphrase: string): ProvenanceMarkGenerator;
  /**
   * Create a new generator with custom random data.
   */
  static newUsing(res: ProvenanceMarkResolution, randomData: Uint8Array): ProvenanceMarkGenerator;
  /**
   * Create a new generator with random seed.
   */
  static newRandom(res: ProvenanceMarkResolution): ProvenanceMarkGenerator;
  /**
   * Create a new generator with all parameters.
   */
  static new(res: ProvenanceMarkResolution, seed: ProvenanceSeed, chainId: Uint8Array, nextSeq: number, rngState: RngState): ProvenanceMarkGenerator;
  /**
   * Generate the next provenance mark in the chain.
   */
  next(date: Date, info?: Cbor): ProvenanceMark;
  /**
   * String representation.
   *
   * Mirrors Rust `Display for ProvenanceMarkGenerator`
   * (`provenance-mark-rust/src/generator.rs:135-147`):
   *
   * ```rust
   * write!(f, "ProvenanceMarkGenerator(chainID: {}, res: {}, seed: {}, nextSeq: {}, rngState: {:?})",
   *     hex::encode(&self.chain_id), self.res, self.seed.hex(), self.next_seq, self.rng_state)
   * ```
   *
   * The `rngState` field uses Rust's `{:?}` (Debug) format, which on a
   * `RngState([u8; 32])` tuple struct produces `RngState([n0, n1, ...])`
   * with each byte rendered as a decimal integer. Earlier revisions of
   * this port omitted `rngState` entirely from `toString()`, so the
   * output diverged from Rust's `Display`.
   */
  toString(): string;
  /**
   * JSON serialization.
   */
  toJSON(): Record<string, unknown>;
  /**
   * Create from JSON object.
   */
  static fromJSON(json: Record<string, unknown>): ProvenanceMarkGenerator;
  /**
   * Convert this generator to a Gordian Envelope.
   *
   * The envelope contains structured assertions for all generator fields:
   * - isA: "provenance-generator"
   * - res: The resolution
   * - seed: The seed
   * - next-seq: The next sequence number
   * - rng-state: The RNG state
   *
   * Note: Use provenanceMarkGeneratorToEnvelope() for a standalone function alternative.
   */
  intoEnvelope(): Envelope;
  /**
   * Extract a ProvenanceMarkGenerator from a Gordian Envelope.
   *
   * @param envelope - The envelope to extract from
   * @returns The extracted generator
   * @throws ProvenanceMarkError if extraction fails
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMarkGenerator;
}
//#endregion
//#region src/mark-info.d.ts
/**
 * Wrapper for a provenance mark with additional display information.
 */
declare class ProvenanceMarkInfo {
  private readonly _mark;
  private readonly _ur;
  private readonly _bytewords;
  private readonly _bytemoji;
  private readonly _comment;
  private constructor();
  /**
   * Create a new ProvenanceMarkInfo from a mark.
   *
   * Mirrors Rust `ProvenanceMarkInfo::new`
   * (`provenance-mark-rust/src/mark_info.rs`), which calls
   * `mark.ur()` — i.e. the `UREncodable` implementation, whose
   * payload is the **untagged** CBOR with type `"provenance"`. Earlier
   * revisions of this port called `decodeCbor(mark.toCborData())` and
   * wrapped the resulting *tagged* CBOR in `UR.new("provenance", ...)`,
   * which prepended the CBOR tag to the UR bytewords and broke
   * cross-impl interop (UR strings produced by Rust would not parse,
   * and vice versa).
   */
  static new(mark: ProvenanceMark, comment?: string): ProvenanceMarkInfo;
  mark(): ProvenanceMark;
  ur(): UR;
  bytewords(): string;
  bytemoji(): string;
  comment(): string;
  /**
   * Generate a markdown summary of the mark.
   *
   * Date rendering uses {@link dateToDisplay} so midnight-UTC dates
   * appear as `YYYY-MM-DD` (matching Rust `format!("{}",
   * self.mark.date())`), not as `YYYY-MM-DDT00:00:00Z`.
   */
  markdownSummary(): string;
  /**
   * JSON serialization. Field order mirrors Rust's `#[derive(Serialize)]`
   * on `ProvenanceMarkInfo` (provenance-mark-rust/src/mark_info.rs):
   * `ur, bytewords, bytemoji, [comment,] mark` — `comment` (when present)
   * comes BEFORE `mark`. Rust uses `skip_serializing_if = "String::is_empty"`,
   * matched here by the `if (...length > 0)` guard.
   */
  toJSON(): Record<string, unknown>;
  /**
   * Create from JSON object.
   *
   * Decodes the UR string through {@link ProvenanceMark.fromURString},
   * which correctly handles the **untagged** CBOR payload that
   * `mark.ur()` produces — symmetric with the constructor.
   */
  static fromJSON(json: Record<string, unknown>): ProvenanceMarkInfo;
}
//#endregion
//#region src/envelope.d.ts
/**
 * Registers provenance mark tags in the global format context.
 *
 * Matches Rust: register_tags()
 */
declare function registerTags(): void;
/**
 * Registers provenance mark tags in a specific format context.
 *
 * Matches Rust: register_tags_in()
 *
 * @param context - The format context to register tags in
 */
declare function registerTagsIn(context: FormatContext$1): void;
/**
 * Convert a ProvenanceMark to an Envelope.
 *
 * Delegates to ProvenanceMark.intoEnvelope() — single source of truth.
 *
 * @param mark - The provenance mark to convert
 * @returns An envelope containing the mark
 */
declare function provenanceMarkToEnvelope(mark: ProvenanceMark): Envelope;
/**
 * Extract a ProvenanceMark from an Envelope.
 *
 * Delegates to ProvenanceMark.fromEnvelope() — single source of truth.
 *
 * @param envelope - The envelope to extract from
 * @returns The extracted provenance mark
 * @throws ProvenanceMarkError if extraction fails
 */
declare function provenanceMarkFromEnvelope(envelope: Envelope): ProvenanceMark;
/**
 * Convert a ProvenanceMarkGenerator to an Envelope.
 *
 * Delegates to ProvenanceMarkGenerator.intoEnvelope() — single source of truth.
 *
 * @param generator - The generator to convert
 * @returns An envelope containing the generator
 */
declare function provenanceMarkGeneratorToEnvelope(generator: ProvenanceMarkGenerator): Envelope;
/**
 * Extract a ProvenanceMarkGenerator from an Envelope.
 *
 * Delegates to ProvenanceMarkGenerator.fromEnvelope() — single source of truth.
 *
 * @param envelope - The envelope to extract from
 * @returns The extracted generator
 * @throws ProvenanceMarkError if extraction fails
 */
declare function provenanceMarkGeneratorFromEnvelope(envelope: Envelope): ProvenanceMarkGenerator;
//#endregion
export { type ChainReport, type FlaggedMark, FormatContext, PROVENANCE_SEED_LENGTH, ProvenanceMark, ProvenanceMarkError, ProvenanceMarkErrorType, ProvenanceMarkGenerator, ProvenanceMarkInfo, ProvenanceMarkResolution, type ProvenanceMarkResult, ProvenanceSeed, RNG_STATE_LENGTH, RngState, SHA256_SIZE, type SequenceReport, type SerializableDate, type ValidationIssue, type ValidationReport, ValidationReportFormat, Xoshiro256StarStar, chainIdHex, chainIdRange, dateBytesLength, dateBytesRange, dateFromIso8601, dateToDateString, dateToDisplay, dateToIso8601, deserialize2Bytes, deserialize4Bytes, deserialize6Bytes, deserializeDate, deserializeSeq, extendKey, fixedLength, formatReport, formatValidationIssue, hasIssues, hashRange, hkdfHmacSha256, infoRangeStart, keyRange, linkLength, obfuscate, parseDate, parseSeed, provenanceMarkFromEnvelope, provenanceMarkGeneratorFromEnvelope, provenanceMarkGeneratorToEnvelope, provenanceMarkToEnvelope, rangeOfDaysInMonth, registerTags, registerTagsIn, resolutionFromCbor, resolutionFromNumber, resolutionToCbor, resolutionToNumber, resolutionToString, seqBytesLength, seqBytesRange, serialize2Bytes, serialize4Bytes, serialize6Bytes, serializeDate, serializeSeq, sha256, sha256Prefix, validate };
//# sourceMappingURL=index.d.mts.map