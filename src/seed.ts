/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The 32-byte seed a generator's whole chain derives from.
 */

import { type Cbor, CborError, bytesToHex, cbor, expectBytes } from "@blockchaincommons/dcbor";
import { type RngOptions, randomBytes } from "@blockchaincommons/rand";

import { ProvenanceMarkError } from "./error.js";
import { extendKey } from "./crypto-utils.js";
import { bytesEqual } from "./utils.js";

/** The seed's length in bytes. */
export const PROVENANCE_SEED_LENGTH = 32;

/** The 32 bytes a generator's whole chain derives from. Frozen. */
export class ProvenanceSeed {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    this.data = data;
    Object.freeze(this);
  }

  /** Exactly 32 bytes; anything else is `InvalidSeedLength` (a non-byte-string a `TypeError`). */
  static from(bytes: Uint8Array): ProvenanceSeed {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("seed must be a Uint8Array");
    if (bytes.length !== PROVENANCE_SEED_LENGTH) {
      throw ProvenanceMarkError.invalidSeedLength(bytes.length);
    }
    return new ProvenanceSeed(new Uint8Array(bytes));
  }

  /** Fresh randomness, from `rng` or the secure default. */
  static random({ rng }: RngOptions = {}): ProvenanceSeed {
    return new ProvenanceSeed(
      randomBytes(PROVENANCE_SEED_LENGTH, rng === undefined ? {} : { rng }),
    );
  }

  /** HKDF-SHA-256 of the passphrase's UTF-8 bytes. */
  static fromPassphrase(passphrase: string): ProvenanceSeed {
    return new ProvenanceSeed(extendKey(new TextEncoder().encode(passphrase)));
  }

  /** A copy of the bytes. */
  get bytes(): Uint8Array {
    return new Uint8Array(this.data);
  }

  /** The bytes as hex. */
  get hex(): string {
    return bytesToHex(this.data);
  }

  /** Same bytes. */
  equals(other: ProvenanceSeed): boolean {
    return bytesEqual(this.data, other.data);
  }

  /** A byte string. */
  toCbor(): Cbor {
    return cbor(this.data);
  }

  /**
   * A seed from a CBOR byte string. A rejection is `Cbor` with the dcbor
   * error's message, or the seed error's, as the reference's
   * `TryFrom<CBOR>` reports it.
   */
  static fromCbor(cborValue: Cbor): ProvenanceSeed {
    try {
      return ProvenanceSeed.from(expectBytes(cborValue));
    } catch (error) {
      if (CborError.isCborError(error)) throw ProvenanceMarkError.cborDecode(error);
      if (ProvenanceMarkError.isProvenanceMarkError(error)) {
        throw ProvenanceMarkError.cborDecode(CborError.custom(error.message));
      }
      throw error;
    }
  }
}
