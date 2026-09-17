/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * Tag registration for envelope formatting: with it, a mark inside an
 * envelope prints as `ProvenanceMark(<id>)` instead of raw tagged CBOR.
 * Marks and generators convert through their own `toEnvelope` and
 * `fromEnvelope`.
 */

import {
  type FormatContext,
  withFormatContext,
  registerTags as envelopeRegisterTags,
  registerTagsIn as envelopeRegisterTagsIn,
} from "@blockchaincommons/envelope/format";
import { type Cbor, type SummarizerResult, CborError } from "@blockchaincommons/dcbor";
import { TAG_PROVENANCE_MARK } from "@blockchaincommons/tags";
import { ProvenanceMarkError } from "./error.js";
import { ProvenanceMark } from "./mark.js";

/**
 * Registers envelope's tags and summarisers, then the provenance-mark
 * summariser, in `context` (the reference's `register_tags_in`).
 */
export function registerTagsIn(context: FormatContext): void {
  envelopeRegisterTagsIn(context);
  markSummarizerIn(context);
}

/** The provenance-mark summariser alone: `ProvenanceMark(<id>)` for tag 1347571542. */
function markSummarizerIn(context: FormatContext): void {
  context.tags.setSummarizer(
    BigInt(TAG_PROVENANCE_MARK.value),
    (untaggedCbor: Cbor, _flat: boolean): SummarizerResult => {
      try {
        return { ok: true, value: ProvenanceMark.fromUntaggedCbor(untaggedCbor).toString() };
      } catch (error) {
        // The decoder's own reason, as the reference's summariser propagates it.
        const cause = ProvenanceMarkError.isProvenanceMarkError(error) ? error.cause : undefined;
        const reason = CborError.isCborError(cause)
          ? cause.message
          : error instanceof Error
            ? error.message
            : String(error);
        return { ok: false, error: CborError.custom(reason) };
      }
    },
  );
}

/**
 * `registerTagsIn` on the global format context (the reference's
 * `register_tags`): envelope's `registerTags()`, which installs the
 * envelope summarisers once, then the provenance-mark summariser.
 */
export function registerTags(): void {
  envelopeRegisterTags();
  withFormatContext((context) => {
    markSummarizerIn(context);
  });
}
