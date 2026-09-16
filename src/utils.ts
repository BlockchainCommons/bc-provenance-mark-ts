/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * Byte helpers and the strict base64 codec the JSON forms use; internal.
 */

export { bytesToHex, hexToBytes } from "@blockchaincommons/dcbor";

/** Whether two byte strings are equal. */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const VALUES: Int16Array = new Int16Array(128).fill(-1);
for (let i = 0; i < ALPHABET.length; i++) VALUES[ALPHABET.charCodeAt(i)] = i;

/** Standard base64 with padding. */
export function toBase64(data: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 2 < data.length; i += 3) {
    const n = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
    out +=
      ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63] + ALPHABET[(n >> 6) & 63] + ALPHABET[n & 63];
  }
  if (i < data.length) {
    const n = (data[i] << 16) | ((data[i + 1] ?? 0) << 8);
    out += ALPHABET[n >> 18] + ALPHABET[(n >> 12) & 63];
    out += i + 1 < data.length ? ALPHABET[(n >> 6) & 63] : "=";
    out += "=";
  }
  return out;
}

/** Why a base64 string does not decode, as the reference's base64 crate words it. */
export class Base64DecodeError extends Error {
  override readonly name = "Base64DecodeError";
}

/**
 * Standard base64 with canonical padding, strictly: no whitespace, no
 * URL-safe symbols, padding only where it belongs. The messages are the
 * reference's (`Invalid symbol <byte>, offset <index>.`, `Invalid
 * padding`, `Invalid input length: <n>`, `Invalid last symbol …`).
 */
export function fromBase64(base64: string): Uint8Array {
  const n = base64.length;
  let end = n;
  while (end > 0 && base64[end - 1] === "=") end--;
  const padding = n - end;
  for (let i = 0; i < end; i++) {
    const c = base64.charCodeAt(i);
    if (c > 127 || VALUES[c] < 0) throw new Base64DecodeError(`Invalid symbol ${c}, offset ${i}.`);
  }
  if (padding > 2 || (padding > 0 && n % 4 !== 0)) {
    throw new Base64DecodeError(`Invalid symbol 61, offset ${end + (padding > 2 ? 2 : 0)}.`);
  }
  if (end % 4 === 1) throw new Base64DecodeError(`Invalid input length: ${end}`);
  if (n % 4 !== 0) throw new Base64DecodeError("Invalid padding");
  const out = new Uint8Array(Math.floor((end * 3) / 4));
  let o = 0;
  let acc = 0;
  let bits = 0;
  for (let i = 0; i < end; i++) {
    acc = (acc << 6) | VALUES[base64.charCodeAt(i)];
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[o++] = (acc >> bits) & 0xff;
    }
  }
  // The bits left over in the last symbol must be zero, as the reference requires.
  if (bits > 0 && (acc & ((1 << bits) - 1)) !== 0) {
    throw new Base64DecodeError(
      `Invalid last symbol ${base64.charCodeAt(end - 1)}, offset ${end - 1}.`,
    );
  }
  return out;
}
