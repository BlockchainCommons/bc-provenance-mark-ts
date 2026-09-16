/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The mark's encodings over its `(res, message)` pair: CBOR (tag
 * `provenance`, `[res, message]`), bytewords, the URL query form and the
 * JSON shape. Pure; the class in `mark.ts` wraps them.
 */

import {
  type Cbor,
  CborError,
  cbor,
  decodeCbor,
  encodeCbor,
  expectArray,
  expectBytes,
  extractTaggedContent,
  taggedValue,
  validateTag,
} from "@blockchaincommons/dcbor";
import { TAG_PROVENANCE_MARK } from "@blockchaincommons/tags";
import {
  type BytewordsStyle,
  decodeBytewords,
  encodeBytewords,
} from "@blockchaincommons/uniform-resources/bytewords";

import { ProvenanceMarkError } from "./error.js";
import {
  type ProvenanceMarkResolution,
  encodeSeq,
  resolutionCode,
  resolutionFromCbor,
  resolutionFromCode,
  resolutionToCbor,
} from "./resolution.js";
import { dateFromIso8601, dateToDisplay, encodeDate } from "./date.js";
import { toBase64 } from "./utils.js";
import {
  type JsonObject,
  base64Field,
  customJson,
  decodeBase64Json,
  expectObject,
  stringField,
  unsignedField,
} from "./json.js";
import type { MarkFields } from "./mark-layout.js";
import { parseMessage } from "./mark-layout.js";

/** The resolution and message a CBOR form carries. */
export interface MarkWire {
  res: ProvenanceMarkResolution;
  message: Uint8Array;
}

// CBOR ------------------------------------------------------------------------

export function markUntaggedCbor(w: MarkWire): Cbor {
  return cbor([resolutionToCbor(w.res), cbor(w.message)]);
}

export function markTaggedCbor(w: MarkWire): Cbor {
  return taggedValue(TAG_PROVENANCE_MARK, markUntaggedCbor(w));
}

/**
 * A decoder entry point's rejection: the dcbor error itself, or the mark
 * error's message as a `Custom` dcbor error, as the reference's
 * `from_untagged_cbor` flattens it through `dcbor::Error::from`.
 */
function decodeFailure(error: unknown): ProvenanceMarkError {
  if (CborError.isCborError(error)) return ProvenanceMarkError.cborDecode(error);
  if (ProvenanceMarkError.isProvenanceMarkError(error)) {
    if (error.code === "Cbor" && CborError.isCborError(error.cause)) {
      return ProvenanceMarkError.cborDecode(error.cause);
    }
    return ProvenanceMarkError.cborDecode(CborError.custom(error.message));
  }
  return ProvenanceMarkError.cborDecode(
    CborError.custom(error instanceof Error ? error.message : String(error)),
  );
}

/** `[res, message]`, parsed. A rejection is `Cbor` with the dcbor error's message. */
export function markFieldsFromUntaggedCbor(cborValue: Cbor): MarkFields {
  try {
    const arr = expectArray(cborValue);
    if (arr.length !== 2) throw CborError.custom("Invalid provenance mark length");
    return parseMessage(resolutionFromCbor(arr[0]), expectBytes(arr[1]));
  } catch (error) {
    throw decodeFailure(error);
  }
}

/** Tag `provenance` over `[res, message]`, parsed; the tag is required. */
export function markFieldsFromTaggedCbor(cborValue: Cbor): MarkFields {
  let untagged: Cbor;
  try {
    validateTag(cborValue, [TAG_PROVENANCE_MARK]);
    untagged = extractTaggedContent(cborValue);
  } catch (error) {
    throw decodeFailure(error);
  }
  return markFieldsFromUntaggedCbor(untagged);
}

/** The bytes of the tagged CBOR, parsed. */
export function markFieldsFromCborData(data: Uint8Array): MarkFields {
  let value: Cbor;
  try {
    value = decodeCbor(data);
  } catch (error) {
    throw decodeFailure(error);
  }
  return markFieldsFromTaggedCbor(value);
}

// Bytewords and URL -----------------------------------------------------------

export function messageToBytewords(message: Uint8Array, style: BytewordsStyle): string {
  return encodeBytewords(message, style);
}

/** Standard bytewords decoded; a failure is `Bytewords`. */
export function bytewordsToMessage(bytewords: string): Uint8Array {
  try {
    return decodeBytewords(bytewords, "standard");
  } catch (error) {
    throw ProvenanceMarkError.wrapForeign(error);
  }
}

/** Minimal bytewords of the tagged CBOR: the `provenance` query parameter. */
export function markToUrlEncoding(w: MarkWire): string {
  return encodeBytewords(encodeCbor(markTaggedCbor(w)), "minimal");
}

/**
 * The `provenance` query parameter, parsed: a bytewords failure is
 * `Bytewords`, a CBOR failure `Cbor` with the reference's prefix.
 */
export function markFieldsFromUrlEncoding(urlEncoding: string): MarkFields {
  let bytes: Uint8Array;
  try {
    bytes = decodeBytewords(urlEncoding, "minimal");
  } catch (error) {
    throw ProvenanceMarkError.wrapForeign(error);
  }
  try {
    return markFieldsFromCborData(bytes);
  } catch (error) {
    if (ProvenanceMarkError.isProvenanceMarkError(error) && error.code === "Cbor") {
      throw ProvenanceMarkError.cbor(error.message, error.cause);
    }
    throw error;
  }
}

// JSON ------------------------------------------------------------------------

/**
 * The JSON shape: `seq, date, res, chain_id, key, hash[, info_bytes]`, the
 * resolution as its wire number, the date as the reference displays it
 * (the date alone at midnight, else ISO seconds), bytes in base64.
 */
export function markFieldsToJSON(f: MarkFields): Record<string, unknown> {
  const result: Record<string, unknown> = {
    seq: f.seq,
    date: dateToDisplay(f.date),
    res: resolutionCode(f.res),
    chain_id: toBase64(f.chainId),
    key: toBase64(f.key),
    hash: toBase64(f.hash),
  };
  if (f.infoBytes.length > 0) result["info_bytes"] = toBase64(f.infoBytes);
  return result;
}

/**
 * The JSON shape read as the reference's serde type reads it: every
 * field required but `info_bytes`, `res` a `u8` naming a resolution,
 * `seq` a `u32`, `date` a strict date string, the bytes base64,
 * `info_bytes` valid CBOR when present. Every fault is `Json`.
 */
export function markFieldsFromJSON(value: unknown): MarkFields {
  const json: JsonObject = expectObject(value);
  const res = resolutionFromJson(unsignedField(json, "res", 8));
  const key = base64Field(json, "key");
  const hash = base64Field(json, "hash");
  const chainId = base64Field(json, "chain_id");
  let infoBytes: Uint8Array = new Uint8Array(0);
  if (json["info_bytes"] !== undefined) {
    infoBytes = decodeBase64Json(stringField(json, "info_bytes"));
    // The reference's `deserialize_cbor` refuses malformed info up front.
    try {
      decodeCbor(infoBytes);
    } catch (error) {
      throw customJson(error);
    }
  }
  const seq = unsignedField(json, "seq", 32);
  let date: Date;
  try {
    date = dateFromIso8601(stringField(json, "date"));
  } catch (error) {
    if (ProvenanceMarkError.isProvenanceMarkError(error) && error.code === "InvalidDate") {
      throw customJson(error.cause ?? error);
    }
    throw error;
  }
  try {
    const seqBytes = encodeSeq(seq, { resolution: res });
    const dateBytes = encodeDate(date, { resolution: res });
    return { res, key, hash, chainId, seqBytes, dateBytes, infoBytes, seq, date };
  } catch (error) {
    throw customJson(error);
  }
}

/** A resolution's wire number under serde: a value outside 0 to 3 is `Json` with the resolution error's message. */
export function resolutionFromJson(code: number): ProvenanceMarkResolution {
  try {
    return resolutionFromCode(code);
  } catch (error) {
    throw customJson(error);
  }
}
