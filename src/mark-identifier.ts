/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * Mark IDs and the human-readable identifiers derived from them. Pure over
 * bytes.
 */

import { bytesToHex } from "@blockchaincommons/dcbor";
import { identifier } from "@blockchaincommons/uniform-resources/bytewords";

/** The character that flags a provenance-mark identifier: 🅟. */
export const MARK_ID_PREFIX = "\u{1F15F}";

/** The three renderings of an ID's bytes. */
export type IdStyle = "bytewords" | "minimal" | "bytemoji";

/**
 * The 32-byte Mark ID: the stored hash, filled to 32 bytes from the
 * fingerprint at resolutions whose hash is shorter.
 */
export function markId(hash: Uint8Array, fingerprint: () => Uint8Array): Uint8Array {
  const result = new Uint8Array(32);
  const n = hash.length;
  result.set(hash, 0);
  if (n < 32) result.set(fingerprint().subarray(0, 32 - n), n);
  return result;
}

/** The word count must be an integer from 4 to 32 (the reference asserts it). */
function checkWordCount(wordCount: number): void {
  if (!Number.isInteger(wordCount) || wordCount < 4 || wordCount > 32) {
    throw new RangeError(`wordCount must be an integer from 4 to 32, got ${String(wordCount)}`);
  }
}

function render(bytes: Uint8Array, style: IdStyle, prefix: boolean): string {
  const s = (
    style === "bytewords" ? identifier(bytes) : identifier(bytes, { style })
  ).toUpperCase();
  return prefix ? `${MARK_ID_PREFIX} ${s}` : s;
}

/** The first `wordCount` bytes of `id` in `style`, upper-case, optionally prefixed. */
export function identifierOf(
  id: Uint8Array,
  wordCount: number,
  style: IdStyle,
  prefix: boolean,
): string {
  checkWordCount(wordCount);
  return render(id.subarray(0, wordCount), style, prefix);
}

/**
 * The shortest prefix (in bytes, `4..=32`) each ID needs so that no two
 * IDs share a prefix. Non-colliding IDs get 4; only the colliding ones
 * grow.
 */
export function minimalNoncollidingPrefixLengths(ids: Uint8Array[]): number[] {
  const n = ids.length;
  const lengths: number[] = new Array<number>(n).fill(4);
  const groups = new Map<string, number[]>();
  for (let i = 0; i < n; i++) {
    const key = bytesToHex(ids[i].subarray(0, 4));
    const g = groups.get(key);
    if (g !== undefined) g.push(i);
    else groups.set(key, [i]);
  }
  for (const indices of groups.values()) {
    if (indices.length <= 1) continue;
    resolveCollisionGroup(ids, indices, lengths);
  }
  return lengths;
}

function resolveCollisionGroup(
  ids: Uint8Array[],
  initialIndices: number[],
  lengths: number[],
): void {
  let unresolved: number[] = [...initialIndices];
  for (let prefixLen = 5; prefixLen <= 32; prefixLen++) {
    const subGroups = new Map<string, number[]>();
    for (const i of unresolved) {
      const key = bytesToHex(ids[i].subarray(0, prefixLen));
      const g = subGroups.get(key);
      if (g !== undefined) g.push(i);
      else subGroups.set(key, [i]);
    }
    const nextUnresolved: number[] = [];
    for (const subIndices of subGroups.values()) {
      if (subIndices.length === 1) lengths[subIndices[0]] = prefixLen;
      else nextUnresolved.push(...subIndices);
    }
    if (nextUnresolved.length === 0) return;
    unresolved = nextUnresolved;
  }
  // Identical IDs stay identical at 32 bytes.
  for (const i of unresolved) lengths[i] = 32;
}

/** Identifiers for a set of IDs, each as long as it needs to be unique in the set. */
export function disambiguatedIdentifiers(
  ids: Uint8Array[],
  style: IdStyle,
  prefix: boolean,
): string[] {
  const lengths = minimalNoncollidingPrefixLengths(ids);
  return ids.map((id, i) => render(id.subarray(0, lengths[i]), style, prefix));
}
