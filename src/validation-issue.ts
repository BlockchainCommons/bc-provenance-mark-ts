/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * What `checkPrecedes` and `validate` can flag on a mark.
 */

import { bytesToHex } from "@blockchaincommons/dcbor";

import { displayDate } from "./date-display.js";

/** Why a mark does not follow its predecessor. The payloads are values; the renderers format them. */
export type ValidationIssue =
  | {
      /** The predecessor's hash does not commit to this mark's key. */
      type: "HashMismatch";
      /** The hash the predecessor should carry. */
      expected: Uint8Array;
      /** The hash it carries. */
      actual: Uint8Array;
    }
  | {
      /** The predecessor's hash was not made from this mark's key. */
      type: "KeyMismatch";
    }
  | {
      /** The sequence number is not the predecessor's plus one. */
      type: "SequenceGap";
      /** The sequence number expected. */
      expected: number;
      /** The sequence number found. */
      actual: number;
    }
  | {
      /** The date is earlier than the predecessor's. */
      type: "DateOrdering";
      /** The predecessor's date. */
      previous: Date;
      /** This mark's date. */
      next: Date;
    }
  | {
      /** A mark at sequence 0 that is not a genesis mark. */
      type: "NonGenesisAtZero";
    }
  | {
      /** A genesis mark whose key is not its chain id. */
      type: "InvalidGenesisKey";
    };

/** The issue as the reference displays it. */
export function formatValidationIssue(issue: ValidationIssue): string {
  switch (issue.type) {
    case "HashMismatch":
      return `hash mismatch: expected ${bytesToHex(issue.expected)}, got ${bytesToHex(issue.actual)}`;
    case "KeyMismatch":
      return "key mismatch: current hash was not generated from next key";
    case "SequenceGap":
      return `sequence number gap: expected ${issue.expected}, got ${issue.actual}`;
    case "DateOrdering":
      return `date must be equal or later: previous is ${displayDate(issue.previous)}, next is ${displayDate(issue.next)}`;
    case "NonGenesisAtZero":
      return "non-genesis mark at sequence 0";
    case "InvalidGenesisKey":
      return "genesis mark must have key equal to chain_id";
  }
}
