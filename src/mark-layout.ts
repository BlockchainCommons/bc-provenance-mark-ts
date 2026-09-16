/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The mark message layout: `key ‖ obfuscate(key, chainId ‖ hash ‖ seq ‖
 * date ‖ info)`, with every field's width fixed by the resolution. Pure
 * over bytes; the class in `mark.ts` is the only caller.
 */

import { type Cbor, type CborInput, cbor, decodeCbor, encodeCbor } from "@blockchaincommons/dcbor";

import { ProvenanceMarkError } from "./error.js";
import {
  type ProvenanceMarkResolution,
  chainIdRange,
  dateBytesRange,
  decodeSeq,
  encodeSeq,
  fixedLength,
  hashRange,
  infoRangeStart,
  keyRange,
  linkLength,
  seqBytesRange,
} from "./resolution.js";
import { decodeDate, encodeDate } from "./date.js";
import { obfuscate, sha256Prefix } from "./crypto-utils.js";

/** The decoded fields of a mark. */
export interface MarkFields {
  res: ProvenanceMarkResolution;
  key: Uint8Array;
  hash: Uint8Array;
  chainId: Uint8Array;
  seqBytes: Uint8Array;
  dateBytes: Uint8Array;
  infoBytes: Uint8Array;
  seq: number;
  date: Date;
}

function concat(...parts: Uint8Array[]): Uint8Array {
  let n = 0;
  for (const p of parts) n += p.length;
  const out = new Uint8Array(n);
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

/** `sha256(key ‖ nextKey ‖ chainId ‖ seq ‖ date ‖ info)` cut to the link length. */
export function makeHash(
  res: ProvenanceMarkResolution,
  key: Uint8Array,
  nextKey: Uint8Array,
  chainId: Uint8Array,
  seqBytes: Uint8Array,
  dateBytes: Uint8Array,
  infoBytes: Uint8Array,
): Uint8Array {
  return sha256Prefix(
    concat(key, nextKey, chainId, seqBytes, dateBytes, infoBytes),
    linkLength(res),
  );
}

/** The info as its encoded bytes: anything dcbor encodes, or nothing. */
export function infoBytesOf(info: CborInput | undefined): Uint8Array {
  return info === undefined ? new Uint8Array(0) : encodeCbor(cbor(info));
}

/** The fields of a new mark; checks the link lengths, encodes date and sequence. */
export function buildFields(
  res: ProvenanceMarkResolution,
  key: Uint8Array,
  nextKey: Uint8Array,
  chainId: Uint8Array,
  seq: number,
  date: Date,
  info: CborInput | undefined,
): MarkFields {
  const linkLen = linkLength(res);
  if (key.length !== linkLen) throw ProvenanceMarkError.invalidKeyLength(linkLen, key.length);
  if (nextKey.length !== linkLen) {
    throw ProvenanceMarkError.invalidNextKeyLength(linkLen, nextKey.length);
  }
  if (chainId.length !== linkLen) {
    throw ProvenanceMarkError.invalidChainIdLength(linkLen, chainId.length);
  }
  const dateBytes = encodeDate(date, { resolution: res });
  const seqBytes = encodeSeq(seq, { resolution: res });
  // The stored date is the encoded one (day, second or millisecond granularity).
  const normalizedDate = decodeDate(dateBytes, { resolution: res });
  const infoBytes = infoBytesOf(info);
  const hash = makeHash(res, key, nextKey, chainId, seqBytes, dateBytes, infoBytes);
  return {
    res,
    key: new Uint8Array(key),
    hash,
    chainId: new Uint8Array(chainId),
    seqBytes,
    dateBytes,
    infoBytes,
    seq,
    date: normalizedDate,
  };
}

/** The wire message of the fields. */
export function buildMessage(f: MarkFields): Uint8Array {
  const payload = concat(f.chainId, f.hash, f.seqBytes, f.dateBytes, f.infoBytes);
  return concat(f.key, obfuscate(f.key, payload));
}

/** The fields of a wire message; rejects short messages and malformed info CBOR. */
export function parseMessage(res: ProvenanceMarkResolution, message: Uint8Array): MarkFields {
  const minLen = fixedLength(res);
  if (message.length < minLen) {
    throw ProvenanceMarkError.invalidMessageLength(minLen, message.length);
  }
  const linkLen = linkLength(res);
  const keyRng = keyRange(res);
  const key = message.slice(keyRng.start, keyRng.end);
  // Every range below is over the payload, not the message.
  const payload = obfuscate(key, message.slice(linkLen));
  const chainIdRng = chainIdRange(res);
  const chainId = payload.slice(chainIdRng.start, chainIdRng.end);
  const hashRng = hashRange(res);
  const hash = payload.slice(hashRng.start, hashRng.end);
  const seqRng = seqBytesRange(res);
  const seqBytes = payload.slice(seqRng.start, seqRng.end);
  const seq = decodeSeq(seqBytes, { resolution: res });
  const dateRng = dateBytesRange(res);
  const dateBytes = payload.slice(dateRng.start, dateRng.end);
  const date = decodeDate(dateBytes, { resolution: res });
  const infoBytes = payload.slice(infoRangeStart(res));
  if (infoBytes.length > 0) {
    try {
      decodeCbor(infoBytes);
    } catch (e) {
      throw ProvenanceMarkError.invalidInfoCbor(e);
    }
  }
  return {
    res,
    key: new Uint8Array(key),
    hash: new Uint8Array(hash),
    chainId: new Uint8Array(chainId),
    seqBytes: new Uint8Array(seqBytes),
    dateBytes: new Uint8Array(dateBytes),
    infoBytes: new Uint8Array(infoBytes),
    seq,
    date,
  };
}

/** The info the bytes hold, if any. */
export function infoOf(f: MarkFields): Cbor | undefined {
  return f.infoBytes.length === 0 ? undefined : decodeCbor(f.infoBytes);
}
