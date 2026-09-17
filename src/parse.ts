/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The two user-input parsers the reference's `util` module offers.
 */

import { ProvenanceSeed } from "./seed.js";
import { block32, decodeBase64Json } from "./json.js";
import { dateFromIso8601 } from "./date.js";

/**
 * A base64 32-byte seed, read as the reference's `parse_seed` reads it:
 * through the seed's serde form, so bad base64 or the wrong length is
 * `Json` with serde's text (`Invalid symbol 33, offset 0.`, `seed length is
 * 3, expected 32`).
 */
export function parseSeed(s: string): ProvenanceSeed {
  if (typeof s !== "string") throw new TypeError("seed must be a string");
  return ProvenanceSeed.from(block32(decodeBase64Json(s)));
}

/**
 * RFC 3339 with a zone, or `YYYY-MM-DD` (UTC midnight), as the
 * reference's `Date::from_string`; anything else is `InvalidDate`.
 */
export function parseDate(s: string): Date {
  return dateFromIso8601(s);
}
