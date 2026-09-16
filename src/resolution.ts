/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The four resolutions and the field widths each fixes.
 */

import { type Cbor, cbor, expectUnsigned } from "@blockchaincommons/dcbor";

import { ProvenanceMarkError } from "./error.js";

// LOW (16 bytes)       key 4 | hash 4 | id 4 | seq 2 | date 2
// MEDIUM (32 bytes)    key 8 | hash 8 | id 8 | seq 4 | date 4
// QUARTILE (58 bytes)  key 16 | hash 16 | id 16 | seq 4 | date 6
// HIGH (106 bytes)     key 32 | hash 32 | id 32 | seq 4 | date 6

/**
 * How much of a mark is security and how much is size: the link length
 * (key, hash and chain id) grows from 4 to 32 bytes, the date from day to
 * millisecond precision.
 */
export type ProvenanceMarkResolution = "low" | "medium" | "quartile" | "high";

/** The four resolutions, in wire-number order. */
export const PROVENANCE_MARK_RESOLUTIONS: readonly ProvenanceMarkResolution[] = Object.freeze([
  "low",
  "medium",
  "quartile",
  "high",
]);

/** Whether `value` is one of the four resolution names. */
export function isProvenanceMarkResolution(value: unknown): value is ProvenanceMarkResolution {
  return (PROVENANCE_MARK_RESOLUTIONS as readonly unknown[]).includes(value);
}

/** The resolution's wire number, 0 to 3. */
export function resolutionCode(res: ProvenanceMarkResolution): number {
  return PROVENANCE_MARK_RESOLUTIONS.indexOf(res);
}

/** The resolution a wire number names; `ResolutionError` for anything but 0 to 3. */
export function resolutionFromCode(code: number): ProvenanceMarkResolution {
  const res = PROVENANCE_MARK_RESOLUTIONS[code];
  if (res === undefined || !Number.isInteger(code)) {
    throw ProvenanceMarkError.resolution(
      `invalid provenance mark resolution value: ${String(code)}`,
    );
  }
  return res;
}

/** The length of the key, hash and chain id. */
export function linkLength(res: ProvenanceMarkResolution): number {
  switch (res) {
    case "low":
      return 4;
    case "medium":
      return 8;
    case "quartile":
      return 16;
    case "high":
      return 32;
  }
}

/** The length of the sequence number: two bytes at low, four otherwise. */
export function seqBytesLength(res: ProvenanceMarkResolution): number {
  return res === "low" ? 2 : 4;
}

/** The length of the date: two bytes at low, four at medium, six otherwise. */
export function dateBytesLength(res: ProvenanceMarkResolution): number {
  switch (res) {
    case "low":
      return 2;
    case "medium":
      return 4;
    case "quartile":
    case "high":
      return 6;
  }
}

/** The length of a message without its info. */
export function fixedLength(res: ProvenanceMarkResolution): number {
  return linkLength(res) * 3 + seqBytesLength(res) + dateBytesLength(res);
}

/** A half-open byte range. */
export interface ByteRange {
  /** The first byte. */
  start: number;
  /** One past the last byte. */
  end: number;
}

/** @internal */
export function keyRange(res: ProvenanceMarkResolution): ByteRange {
  return { start: 0, end: linkLength(res) };
}

/** @internal */
export function chainIdRange(res: ProvenanceMarkResolution): ByteRange {
  return { start: 0, end: linkLength(res) };
}

/** @internal */
export function hashRange(res: ProvenanceMarkResolution): ByteRange {
  const chainIdEnd = chainIdRange(res).end;
  return { start: chainIdEnd, end: chainIdEnd + linkLength(res) };
}

/** @internal */
export function seqBytesRange(res: ProvenanceMarkResolution): ByteRange {
  const hashEnd = hashRange(res).end;
  return { start: hashEnd, end: hashEnd + seqBytesLength(res) };
}

/** @internal */
export function dateBytesRange(res: ProvenanceMarkResolution): ByteRange {
  const seqEnd = seqBytesRange(res).end;
  return { start: seqEnd, end: seqEnd + dateBytesLength(res) };
}

/** @internal */
export function infoRangeStart(res: ProvenanceMarkResolution): number {
  return dateBytesRange(res).end;
}

/** Options naming the resolution a codec works at. */
export interface ResolutionOptions {
  /** The resolution. */
  resolution: ProvenanceMarkResolution;
}

/**
 * The sequence number as big-endian bytes: two at low resolution (so at
 * most 65,535), four otherwise (at most 2^32 - 1); a u32 like the
 * reference's.
 */
export function encodeSeq(seq: number, { resolution }: ResolutionOptions): Uint8Array {
  if (!Number.isInteger(seq) || seq < 0 || seq > 0xffffffff) {
    throw ProvenanceMarkError.resolution(
      `sequence number must be an integer in 0..4294967295, got ${String(seq)}`,
    );
  }
  if (seqBytesLength(resolution) === 2) {
    if (seq > 0xffff) {
      throw ProvenanceMarkError.resolution(
        `sequence number ${seq} out of range for 2-byte format (max ${0xffff})`,
      );
    }
    return new Uint8Array([(seq >> 8) & 0xff, seq & 0xff]);
  }
  return new Uint8Array([(seq >>> 24) & 0xff, (seq >>> 16) & 0xff, (seq >>> 8) & 0xff, seq & 0xff]);
}

/** The sequence number the bytes carry at the resolution; the length must match. */
export function decodeSeq(data: Uint8Array, { resolution }: ResolutionOptions): number {
  const len = seqBytesLength(resolution);
  if (data.length !== len) {
    throw ProvenanceMarkError.resolution(
      `invalid sequence number length: expected 2 or 4 bytes, got ${data.length}`,
    );
  }
  if (len === 2) return (data[0] << 8) | data[1];
  return ((data[0] << 24) | (data[1] << 16) | (data[2] << 8) | data[3]) >>> 0;
}

/** The wire number as CBOR. */
export function resolutionToCbor(res: ProvenanceMarkResolution): Cbor {
  return cbor(resolutionCode(res));
}

/** The resolution a CBOR unsigned integer names. */
export function resolutionFromCbor(cborValue: Cbor): ProvenanceMarkResolution {
  return resolutionFromCode(Number(expectUnsigned(cborValue)));
}
