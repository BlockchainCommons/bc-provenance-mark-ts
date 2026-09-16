/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The key derivation and obfuscation steps a mark's construction uses,
 * over `@blockchaincommons/crypto`'s primitives.
 */

import { sha256, hkdfSha256, chacha20 } from "@blockchaincommons/crypto";

export { sha256 };

/** The first `prefix` bytes of SHA-256(data). */
export function sha256Prefix(data: Uint8Array, prefix: number): Uint8Array {
  return sha256(data).slice(0, prefix);
}

/** HKDF-SHA-256 of `data` with no salt and no info, 32 bytes: the passphrase and obfuscation KDF. */
export function extendKey(data: Uint8Array): Uint8Array {
  return hkdfSha256(data, new Uint8Array(0), { dkLen: 32 });
}

/**
 * XORs `message` with ChaCha20 keyed by `extendKey(key)`, the nonce being
 * the last twelve bytes of the extended key reversed. Applying it twice
 * restores the message; the empty message stays empty.
 */
export function obfuscate(key: Uint8Array, message: Uint8Array): Uint8Array {
  if (message.length === 0) return new Uint8Array(0);
  const extendedKey = extendKey(key);
  const iv = new Uint8Array(12);
  for (let i = 0; i < 12; i++) iv[i] = extendedKey[31 - i];
  return chacha20(extendedKey, iv, message);
}
