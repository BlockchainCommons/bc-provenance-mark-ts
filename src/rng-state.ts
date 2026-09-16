/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The 32 bytes of xoshiro256** state a generator persists between marks.
 */

import { type Cbor, CborError, bytesToHex, cbor, expectBytes } from "@blockchaincommons/dcbor";

import { ProvenanceMarkError } from "./error.js";
import { bytesEqual } from "./utils.js";

/** The state's length in bytes. */
export const RNG_STATE_LENGTH = 32;

/** The 32 bytes of xoshiro256** state a generator persists between marks. Frozen. */
export class RngState {
  private readonly data: Uint8Array;

  private constructor(data: Uint8Array) {
    this.data = data;
    Object.freeze(this);
  }

  /** Exactly 32 bytes; anything else is `InvalidRngStateLength` (a non-byte-string a `TypeError`). */
  static from(bytes: Uint8Array): RngState {
    if (!(bytes instanceof Uint8Array)) throw new TypeError("RNG state must be a Uint8Array");
    if (bytes.length !== RNG_STATE_LENGTH) {
      throw ProvenanceMarkError.invalidRngStateLength(bytes.length);
    }
    return new RngState(new Uint8Array(bytes));
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
  equals(other: RngState): boolean {
    return bytesEqual(this.data, other.data);
  }

  /** A byte string. */
  toCbor(): Cbor {
    return cbor(this.data);
  }

  /**
   * A state from a CBOR byte string. A rejection is `Cbor` with the dcbor
   * error's message, or the length error's, as the reference's
   * `TryFrom<CBOR>` reports it.
   */
  static fromCbor(cborValue: Cbor): RngState {
    try {
      return RngState.from(expectBytes(cborValue));
    } catch (error) {
      if (CborError.isCborError(error)) throw ProvenanceMarkError.cborDecode(error);
      if (ProvenanceMarkError.isProvenanceMarkError(error)) {
        throw ProvenanceMarkError.cborDecode(CborError.custom(error.message));
      }
      throw error;
    }
  }
}
