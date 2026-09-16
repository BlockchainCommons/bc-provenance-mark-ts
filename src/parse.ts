/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The two user-input parsers the reference's `util` module offers.
 */

import { ProvenanceMarkError } from "./error.js";
import { ProvenanceSeed } from "./seed.js";
import { Base64DecodeError, fromBase64 } from "./utils.js";
import { dateFromIso8601 } from "./date.js";

/** A base64 32-byte seed; bad base64 is `Base64`, the wrong length `InvalidSeedLength`. */
export function parseSeed(s: string): ProvenanceSeed {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(s);
  } catch (error) {
    if (error instanceof Base64DecodeError) throw ProvenanceMarkError.base64(error.message, error);
    throw error;
  }
  return ProvenanceSeed.from(bytes);
}

/**
 * RFC 3339 with a zone, or `YYYY-MM-DD` (UTC midnight), as the
 * reference's `Date::from_string`; anything else is `InvalidDate`.
 */
export function parseDate(s: string): Date {
  return dateFromIso8601(s);
}
