/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The one error this package throws: a `code` naming what went wrong (the
 * reference's variant names) and `details` typed by that code. Messages
 * are the reference's.
 */

import { type ValidationIssue, formatValidationIssue } from "./validation-issue.js";

/** A seed or RNG state that is not 32 bytes. */
export interface SeedLengthDetails<
  C extends "InvalidSeedLength" | "InvalidRngStateLength" =
    "InvalidSeedLength" | "InvalidRngStateLength",
> {
  /** The discriminant. */
  code: C;
  /** The length given. */
  actual: number;
}

/** A key named in a keyed structure. */
export interface KeyDetails<
  C extends "DuplicateKey" | "MissingKey" | "InvalidKey" =
    "DuplicateKey" | "MissingKey" | "InvalidKey",
> {
  /** The discriminant. */
  code: C;
  /** The key's name. */
  key: string;
}

/** The codes whose details are an expected and an actual count. */
export type ExpectedActualCode =
  | "ExtraKeys"
  | "InvalidKeyLength"
  | "InvalidNextKeyLength"
  | "InvalidChainIdLength"
  | "InvalidMessageLength";

/** A count or length that must match the resolution. */
export interface ExpectedActualDetails<C extends ExpectedActualCode = ExpectedActualCode> {
  /** The discriminant. */
  code: C;
  /** The count or length required. */
  expected: number;
  /** The count or length given. */
  actual: number;
}

/** Info bytes that are not CBOR. */
export interface InvalidInfoCborDetails {
  /** The discriminant. */
  code: "InvalidInfoCbor";
}

/** The codes whose details are a reason in prose. */
export type ReasonCode = "DateOutOfRange" | "InvalidDate" | "ResolutionError";

/** A reason in prose. */
export interface ReasonDetails<C extends ReasonCode = ReasonCode> {
  /** The discriminant. */
  code: C;
  /** The reason, as the reference words it. */
  reason: string;
}

/** A URL without the `provenance` parameter. */
export interface MissingUrlParameterDetails {
  /** The discriminant. */
  code: "MissingUrlParameter";
  /** The parameter's name. */
  parameter: string;
}

/** A year the 2-byte codec cannot carry. */
export interface YearOutOfRangeDetails {
  /** The discriminant. */
  code: "YearOutOfRange";
  /** The year given. */
  year: number;
}

/** A month or day that is not on the calendar. */
export interface InvalidMonthOrDayDetails {
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
export type MessageCode =
  "Bytewords" | "Cbor" | "Url" | "Base64" | "Json" | "TryFromInt" | "Envelope";

/** A wrapped failure from an encoding or a sibling package; the error itself is `cause`. */
export interface MessageDetails<C extends MessageCode = MessageCode> {
  /** The discriminant. */
  code: C;
  /** The wrapped error's message. */
  message: string;
}

/** A mark that does not follow its predecessor. */
export interface ValidationDetails {
  /** The discriminant. */
  code: "Validation";
  /** Why the mark does not follow. */
  issue: ValidationIssue;
}

/** The `details` shape of every code. */
export interface ProvenanceMarkErrorDetailsByCode {
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
export type ProvenanceMarkErrorCode = keyof ProvenanceMarkErrorDetailsByCode;

/** Every code, in one list. */
export const PROVENANCE_MARK_ERROR_CODES: readonly ProvenanceMarkErrorCode[] = Object.freeze([
  "InvalidSeedLength",
  "InvalidRngStateLength",
  "DuplicateKey",
  "MissingKey",
  "InvalidKey",
  "ExtraKeys",
  "InvalidKeyLength",
  "InvalidNextKeyLength",
  "InvalidChainIdLength",
  "InvalidMessageLength",
  "InvalidInfoCbor",
  "DateOutOfRange",
  "InvalidDate",
  "MissingUrlParameter",
  "YearOutOfRange",
  "InvalidMonthOrDay",
  "ResolutionError",
  "Bytewords",
  "Cbor",
  "Url",
  "Base64",
  "Json",
  "TryFromInt",
  "Validation",
  "Envelope",
] as const);

/** `details` is discriminated by `code`. */
export type ProvenanceMarkErrorDetails = ProvenanceMarkErrorDetailsByCode[ProvenanceMarkErrorCode];

/** The `details` of one code. */
export type ProvenanceMarkErrorDetailsFor<C extends ProvenanceMarkErrorCode> =
  ProvenanceMarkErrorDetailsByCode[C];

/** A `ProvenanceMarkError` whose `code` and `details` are narrowed to one code. */
export type ProvenanceMarkErrorTyped<C extends ProvenanceMarkErrorCode = ProvenanceMarkErrorCode> =
  C extends ProvenanceMarkErrorCode
    ? ProvenanceMarkError & {
        /** The condition. */
        readonly code: C;
        /** The condition's fields. */
        readonly details: ProvenanceMarkErrorDetailsFor<C>;
      }
    : never;

const messageOf = (cause: unknown): string =>
  cause instanceof Error ? cause.message : typeof cause === "string" ? cause : String(cause);

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
export class ProvenanceMarkError extends Error {
  /** Always `"ProvenanceMarkError"`. */
  override readonly name = "ProvenanceMarkError";
  /** The condition, one of `ProvenanceMarkErrorCode`. */
  readonly code: ProvenanceMarkErrorCode;
  /** The fields of the condition, discriminated by `code`; frozen. */
  readonly details: ProvenanceMarkErrorDetails;

  private constructor(message: string, details: ProvenanceMarkErrorDetails, cause?: unknown) {
    super(message, cause === undefined ? undefined : { cause });
    this.code = details.code;
    this.details = Object.freeze(details);
  }

  private static make<C extends ProvenanceMarkErrorCode>(
    message: string,
    details: ProvenanceMarkErrorDetailsFor<C>,
    cause?: unknown,
  ): ProvenanceMarkErrorTyped<C> {
    return new ProvenanceMarkError(message, details, cause) as ProvenanceMarkErrorTyped<C>;
  }

  /** Whether `value` is a `ProvenanceMarkError`: an instance of this class. */
  static isProvenanceMarkError(value: unknown): value is ProvenanceMarkError {
    return value instanceof ProvenanceMarkError;
  }

  /** Whether this error's code is `code`, narrowing `details`. */
  is<C extends ProvenanceMarkErrorCode>(code: C): this is ProvenanceMarkErrorTyped<C> {
    return this.code === code;
  }

  // Lengths and keys ----------------------------------------------------------

  /** `InvalidSeedLength`: a seed that is not 32 bytes. */
  static invalidSeedLength(actual: number): ProvenanceMarkErrorTyped<"InvalidSeedLength"> {
    return ProvenanceMarkError.make(`invalid seed length: expected 32 bytes, got ${actual} bytes`, {
      code: "InvalidSeedLength",
      actual,
    });
  }

  /** `InvalidRngStateLength`: an RNG state that is not 32 bytes. */
  static invalidRngStateLength(actual: number): ProvenanceMarkErrorTyped<"InvalidRngStateLength"> {
    return ProvenanceMarkError.make(
      `invalid RNG state length: expected 32 bytes, got ${actual} bytes`,
      { code: "InvalidRngStateLength", actual },
    );
  }

  /** `DuplicateKey`: a key given twice. */
  static duplicateKey(key: string): ProvenanceMarkErrorTyped<"DuplicateKey"> {
    return ProvenanceMarkError.make(`duplicate key: ${key}`, { code: "DuplicateKey", key });
  }

  /** `MissingKey`: a key not given. */
  static missingKey(key: string): ProvenanceMarkErrorTyped<"MissingKey"> {
    return ProvenanceMarkError.make(`missing key: ${key}`, { code: "MissingKey", key });
  }

  /** `InvalidKey`: a key with the wrong value. */
  static invalidKey(key: string): ProvenanceMarkErrorTyped<"InvalidKey"> {
    return ProvenanceMarkError.make(`invalid key: ${key}`, { code: "InvalidKey", key });
  }

  /** `ExtraKeys`: a keyed structure with the wrong number of keys. */
  static extraKeys(expected: number, actual: number): ProvenanceMarkErrorTyped<"ExtraKeys"> {
    return ProvenanceMarkError.make(`wrong number of keys: expected ${expected}, got ${actual}`, {
      code: "ExtraKeys",
      expected,
      actual,
    });
  }

  /** `InvalidKeyLength`: a key that is not the link length. */
  static invalidKeyLength(
    expected: number,
    actual: number,
  ): ProvenanceMarkErrorTyped<"InvalidKeyLength"> {
    return ProvenanceMarkError.make(`invalid key length: expected ${expected}, got ${actual}`, {
      code: "InvalidKeyLength",
      expected,
      actual,
    });
  }

  /** `InvalidNextKeyLength`: a next key that is not the link length. */
  static invalidNextKeyLength(
    expected: number,
    actual: number,
  ): ProvenanceMarkErrorTyped<"InvalidNextKeyLength"> {
    return ProvenanceMarkError.make(
      `invalid next key length: expected ${expected}, got ${actual}`,
      { code: "InvalidNextKeyLength", expected, actual },
    );
  }

  /** `InvalidChainIdLength`: a chain id that is not the link length. */
  static invalidChainIdLength(
    expected: number,
    actual: number,
  ): ProvenanceMarkErrorTyped<"InvalidChainIdLength"> {
    return ProvenanceMarkError.make(
      `invalid chain ID length: expected ${expected}, got ${actual}`,
      { code: "InvalidChainIdLength", expected, actual },
    );
  }

  /** `InvalidMessageLength`: a message shorter than the resolution's fixed part. */
  static invalidMessageLength(
    expected: number,
    actual: number,
  ): ProvenanceMarkErrorTyped<"InvalidMessageLength"> {
    return ProvenanceMarkError.make(
      `invalid message length: expected at least ${expected}, got ${actual}`,
      { code: "InvalidMessageLength", expected, actual },
    );
  }

  /** `InvalidInfoCbor`: info bytes that are not CBOR. */
  static invalidInfoCbor(cause?: unknown): ProvenanceMarkErrorTyped<"InvalidInfoCbor"> {
    return ProvenanceMarkError.make(
      "invalid CBOR data in info field",
      { code: "InvalidInfoCbor" },
      cause,
    );
  }

  // Dates and resolutions -----------------------------------------------------

  /** `DateOutOfRange`: a date the codec cannot carry. */
  static dateOutOfRange(reason: string): ProvenanceMarkErrorTyped<"DateOutOfRange"> {
    return ProvenanceMarkError.make(`date out of range: ${reason}`, {
      code: "DateOutOfRange",
      reason,
    });
  }

  /** `InvalidDate`: a date string or `Date` that holds no date. */
  static invalidDate(reason: string, cause?: unknown): ProvenanceMarkErrorTyped<"InvalidDate"> {
    return ProvenanceMarkError.make(
      `invalid date: ${reason}`,
      { code: "InvalidDate", reason },
      cause,
    );
  }

  /** `YearOutOfRange`: a year outside 2023 to 2150 for the 2-byte codec. */
  static yearOutOfRange(year: number): ProvenanceMarkErrorTyped<"YearOutOfRange"> {
    return ProvenanceMarkError.make(
      `year out of range for 2-byte serialization: must be between 2023-2150, got ${year}`,
      { code: "YearOutOfRange", year },
    );
  }

  /** `InvalidMonthOrDay`: a month or day that is not on the calendar. */
  static invalidMonthOrDay(
    year: number,
    month: number,
    day: number,
  ): ProvenanceMarkErrorTyped<"InvalidMonthOrDay"> {
    return ProvenanceMarkError.make(`invalid month (${month}) or day (${day}) for year ${year}`, {
      code: "InvalidMonthOrDay",
      year,
      month,
      day,
    });
  }

  /** `ResolutionError`: a resolution number, sequence number or field length the resolution refuses. */
  static resolution(reason: string): ProvenanceMarkErrorTyped<"ResolutionError"> {
    return ProvenanceMarkError.make(`resolution serialization error: ${reason}`, {
      code: "ResolutionError",
      reason,
    });
  }

  /** `MissingUrlParameter`: a URL without the parameter. */
  static missingUrlParameter(parameter: string): ProvenanceMarkErrorTyped<"MissingUrlParameter"> {
    return ProvenanceMarkError.make(`missing required URL parameter: ${parameter}`, {
      code: "MissingUrlParameter",
      parameter,
    });
  }

  // Wrapped encodings ---------------------------------------------------------

  private static wrapped<C extends MessageCode>(
    code: C,
    prefix: string,
    message: string,
    cause?: unknown,
  ): ProvenanceMarkErrorTyped<C> {
    return ProvenanceMarkError.make(
      `${prefix}: ${message}`,
      { code, message } as ProvenanceMarkErrorDetailsFor<C>,
      cause,
    );
  }

  /** `Bytewords`: a bytewords decode failure (`bytewords error: …`). */
  static bytewords(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Bytewords"> {
    return ProvenanceMarkError.wrapped("Bytewords", "bytewords error", message, cause);
  }

  /** `Cbor`: a CBOR failure (`CBOR error: …`). */
  static cbor(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Cbor"> {
    return ProvenanceMarkError.wrapped("Cbor", "CBOR error", message, cause);
  }

  /**
   * `Cbor` from a CBOR or UR decoder entry point, where the reference
   * returns the dcbor error itself: the message is the dcbor error's.
   */
  static cborDecode(cause: Error): ProvenanceMarkErrorTyped<"Cbor"> {
    return ProvenanceMarkError.make(cause.message, { code: "Cbor", message: cause.message }, cause);
  }

  /** `Url`: a URL that does not parse (`URL parsing error: …`). */
  static url(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Url"> {
    return ProvenanceMarkError.wrapped("Url", "URL parsing error", message, cause);
  }

  /** `Base64`: base64 that does not decode (`base64 decoding error: …`). */
  static base64(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Base64"> {
    return ProvenanceMarkError.wrapped("Base64", "base64 decoding error", message, cause);
  }

  /** `Json`: JSON that does not deserialise (`JSON error: …`, worded as serde words it). */
  static json(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Json"> {
    return ProvenanceMarkError.wrapped("Json", "JSON error", message, cause);
  }

  /** `TryFromInt`: an integer outside its type (`integer conversion error: …`). */
  static tryFromInt(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"TryFromInt"> {
    return ProvenanceMarkError.wrapped("TryFromInt", "integer conversion error", message, cause);
  }

  /** `Envelope`: an envelope that is not a generator's, or an envelope failure (`envelope error: …`). */
  static envelope(message: string, cause?: unknown): ProvenanceMarkErrorTyped<"Envelope"> {
    return ProvenanceMarkError.wrapped("Envelope", "envelope error", message, cause);
  }

  /** `Cbor`, `Bytewords` or `Envelope` for a sibling error caught inside a decoder; other values pass through. */
  static wrapForeign(error: unknown): unknown {
    if (ProvenanceMarkError.isProvenanceMarkError(error)) return error;
    const named = error as { name?: unknown; code?: unknown };
    if (named.name === "CborError") return ProvenanceMarkError.cbor(messageOf(error), error);
    if (named.name === "URError") {
      return named.code === "Cbor"
        ? ProvenanceMarkError.cbor(messageOf(error), error)
        : ProvenanceMarkError.bytewords(messageOf(error), error);
    }
    if (named.name === "EnvelopeError")
      return ProvenanceMarkError.envelope(messageOf(error), error);
    return error;
  }

  // Validation ----------------------------------------------------------------

  /** `Validation`: a mark that does not follow its predecessor; `details.issue` says why. */
  static validation(issue: ValidationIssue): ProvenanceMarkErrorTyped<"Validation"> {
    return ProvenanceMarkError.make(`validation error: ${formatValidationIssue(issue)}`, {
      code: "Validation",
      issue,
    });
  }
}
