/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The generator that turns a seed into a chain of marks, and its persisted
 * forms (JSON and envelope).
 */

import {
  type Cbor,
  type CborInput,
  CborError,
  bytesToHex,
  expectBytes,
  expectUnsigned,
} from "@blockchaincommons/dcbor";
import { type RngOptions, SeededRng, randomBytes } from "@blockchaincommons/rand";
import { Envelope, EnvelopeError, type ToEnvelope } from "@blockchaincommons/envelope";
import { addType, hasType } from "@blockchaincommons/envelope/types";

import { ProvenanceMarkError } from "./error.js";
import {
  type ProvenanceMarkResolution,
  isProvenanceMarkResolution,
  linkLength,
  resolutionCode,
  resolutionFromCbor,
} from "./resolution.js";
import { ProvenanceSeed } from "./seed.js";
import { RngState } from "./rng-state.js";
import { sha256 } from "./crypto-utils.js";
import { ProvenanceMark } from "./mark.js";
import { toBase64 } from "./utils.js";
import { resolutionFromJson } from "./mark-encodings.js";
import { base64Field, customJson, expectObject, unsignedField } from "./json.js";

/** What `ProvenanceMarkGenerator.from` takes. */
export interface ProvenanceMarkGeneratorInput {
  /** The resolution of every mark the chain will hold. */
  res: ProvenanceMarkResolution;
  /** The seed the chain derives from. */
  seed: ProvenanceSeed;
}

/** A persisted generator, as `fromState` takes it. */
export interface ProvenanceMarkGeneratorState extends ProvenanceMarkGeneratorInput {
  /** The chain id, of the resolution's link length. */
  chainId: Uint8Array;
  /** The sequence number the next mark gets. */
  nextSeq: number;
  /** The RNG state the next key is drawn from. */
  rngState: RngState;
}

/** What `next` takes besides the date. */
export interface NextMarkOptions {
  /** Any CBOR the mark carries: a `Cbor`, a `ToCbor`, or a value dcbor encodes. */
  info?: CborInput | undefined;
}

/** The number of assertions a generator envelope carries: its type and four fields. */
const ENVELOPE_ASSERTION_COUNT = 5;

/**
 * Produces a chain of marks from a seed: the chain id and the RNG state
 * derive from the seed, each `next` draws the next key and advances the
 * state. Persist it between marks with `toJSON` or `toEnvelope`.
 *
 * ```ts
 * const generator = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
 * const genesis = generator.next(new Date("2023-06-20T12:00:00Z"));
 * const second = generator.next(new Date("2023-06-21T12:00:00Z"), { info: "second work" });
 * genesis.precedes(second); // true
 * ```
 */
export class ProvenanceMarkGenerator implements ToEnvelope {
  private readonly _res: ProvenanceMarkResolution;
  private readonly _seed: ProvenanceSeed;
  private readonly _chainId: Uint8Array;
  private _nextSeq: number;
  private _rngState: RngState;

  private constructor(s: ProvenanceMarkGeneratorState) {
    this._res = s.res;
    this._seed = s.seed;
    this._chainId = new Uint8Array(s.chainId);
    this._nextSeq = s.nextSeq;
    this._rngState = s.rngState;
    Object.seal(this);
  }

  /** A fresh chain from a seed: the chain id is `sha256(seed)` cut to the link length. */
  static from({ res, seed }: ProvenanceMarkGeneratorInput): ProvenanceMarkGenerator {
    expectResolution(res);
    if (!(seed instanceof ProvenanceSeed)) throw new TypeError("seed must be a ProvenanceSeed");
    // The bare seed is never the chain id.
    const digest1 = sha256(seed.bytes);
    const chainId = digest1.slice(0, linkLength(res));
    const digest2 = sha256(digest1);
    return new ProvenanceMarkGenerator({
      res,
      seed,
      chainId,
      nextSeq: 0,
      rngState: RngState.from(digest2),
    });
  }

  /** A fresh chain from `ProvenanceSeed.fromPassphrase`. */
  static fromPassphrase(
    res: ProvenanceMarkResolution,
    passphrase: string,
  ): ProvenanceMarkGenerator {
    return ProvenanceMarkGenerator.from({ res, seed: ProvenanceSeed.fromPassphrase(passphrase) });
  }

  /** A fresh chain from a random seed. */
  static random(res: ProvenanceMarkResolution, options: RngOptions = {}): ProvenanceMarkGenerator {
    return ProvenanceMarkGenerator.from({ res, seed: ProvenanceSeed.random(options) });
  }

  /**
   * A generator restored mid-chain. The chain id must have the link
   * length (`InvalidChainIdLength`), the next sequence number must be a
   * u32 (`ResolutionError`).
   */
  static fromState(state: ProvenanceMarkGeneratorState): ProvenanceMarkGenerator {
    expectResolution(state.res);
    if (!(state.seed instanceof ProvenanceSeed))
      throw new TypeError("seed must be a ProvenanceSeed");
    if (!(state.rngState instanceof RngState)) throw new TypeError("rngState must be an RngState");
    if (!(state.chainId instanceof Uint8Array)) throw new TypeError("chainId must be a Uint8Array");
    const linkLen = linkLength(state.res);
    if (state.chainId.length !== linkLen) {
      throw ProvenanceMarkError.invalidChainIdLength(linkLen, state.chainId.length);
    }
    if (!Number.isInteger(state.nextSeq) || state.nextSeq < 0 || state.nextSeq > 0xffffffff) {
      throw ProvenanceMarkError.resolution(
        `sequence number must be an integer in 0..4294967295, got ${String(state.nextSeq)}`,
      );
    }
    return new ProvenanceMarkGenerator(state);
  }

  /** The resolution. */
  get res(): ProvenanceMarkResolution {
    return this._res;
  }

  /** The seed. */
  get seed(): ProvenanceSeed {
    return this._seed;
  }

  /** A copy of the chain id. */
  get chainId(): Uint8Array {
    return new Uint8Array(this._chainId);
  }

  /** The sequence number the next mark gets. */
  get nextSeq(): number {
    return this._nextSeq;
  }

  /** The RNG state the next key is drawn from. */
  get rngState(): RngState {
    return this._rngState;
  }

  /**
   * The next mark: the genesis mark's key is the chain id, every later
   * key is drawn from the RNG (which advances); the next key is drawn
   * from a copy so the hash commits to it. A date the resolution cannot
   * encode (`YearOutOfRange`, `DateOutOfRange`, `InvalidDate`) throws
   * before any state changes.
   */
  next(date: Date, { info }: NextMarkOptions = {}): ProvenanceMark {
    const rng = new SeededRng(this._rngState.bytes);
    const seq = this._nextSeq;
    let key: Uint8Array;
    if (seq === 0) {
      key = new Uint8Array(this._chainId);
    } else {
      // The randomness is portable across implementations.
      key = randomBytes(linkLength(this._res), { rng });
    }
    const nextKey = randomBytes(linkLength(this._res), { rng: rng.clone() });
    const mark = ProvenanceMark.from({
      res: this._res,
      key,
      nextKey,
      chainId: new Uint8Array(this._chainId),
      seq,
      date,
      info,
    });
    this._nextSeq = seq + 1;
    if (seq !== 0) this._rngState = RngState.from(rng.state);
    return mark;
  }

  /** `ProvenanceMarkGenerator(chainID: <hex>, res: <name>, seed: <hex>, nextSeq: <n>, rngState: <hex>)`. */
  toString(): string {
    return `ProvenanceMarkGenerator(chainID: ${bytesToHex(this._chainId)}, res: ${this._res}, seed: ${this._seed.hex}, nextSeq: ${this._nextSeq}, rngState: ${this._rngState.hex})`;
  }

  /** `res` (wire number), `seed`, `chainID`, `nextSeq`, `rngState`, bytes in base64. */
  toJSON(): Record<string, unknown> {
    return {
      res: resolutionCode(this._res),
      seed: toBase64(this._seed.bytes),
      chainID: toBase64(this._chainId),
      nextSeq: this._nextSeq,
      rngState: toBase64(this._rngState.bytes),
    };
  }

  /**
   * The JSON shape, read strictly: every field required, `res` a wire
   * number, `nextSeq` a u32, `seed` and `rngState` 32 bytes of base64,
   * `chainID` base64 of the link length. Any fault is `Json`, worded as
   * serde words it.
   */
  static fromJSON(json: unknown): ProvenanceMarkGenerator {
    const obj = expectObject(json);
    const res = resolutionFromJson(unsignedField(obj, "res", 8));
    const seed = seedBlock(base64Field(obj, "seed"), "seed");
    const chainId = base64Field(obj, "chainID");
    const nextSeq = unsignedField(obj, "nextSeq", 32);
    const rngState = seedBlock(base64Field(obj, "rngState"), "rngState");
    try {
      return ProvenanceMarkGenerator.fromState({
        res,
        seed: ProvenanceSeed.from(seed),
        chainId,
        nextSeq,
        rngState: RngState.from(rngState),
      });
    } catch (error) {
      throw customJson(error);
    }
  }

  /**
   * The chain id as the subject, typed `provenance-generator`, with `res`,
   * `seed`, `next-seq` and `rng-state` assertions.
   */
  toEnvelope(): Envelope {
    return addType(Envelope.from(this._chainId), "provenance-generator")
      .addAssertion("res", resolutionCode(this._res))
      .addAssertion("seed", this._seed.bytes)
      .addAssertion("next-seq", this._nextSeq)
      .addAssertion("rng-state", this._rngState.bytes);
  }

  /**
   * A generator from its envelope. An envelope not typed
   * `provenance-generator`, or missing a field, is `Envelope`; more or
   * fewer than five assertions is `ExtraKeys`; a field of the wrong
   * shape is `Cbor`.
   */
  static fromEnvelope(envelope: Envelope): ProvenanceMarkGenerator {
    if (!(envelope instanceof Envelope)) throw new TypeError("envelope must be an Envelope");
    if (!hasType(envelope, "provenance-generator")) {
      throw ProvenanceMarkError.envelope("Envelope is not a provenance-generator");
    }
    const chainId = leafOf(envelope.subject(), expectBytes);
    const count = envelope.assertions().length;
    if (count !== ENVELOPE_ASSERTION_COUNT) {
      throw ProvenanceMarkError.extraKeys(ENVELOPE_ASSERTION_COUNT, count);
    }
    const res = leafOf(objectFor(envelope, "res"), resolutionFromCbor);
    const seed = leafOf(objectFor(envelope, "seed"), (c) => ProvenanceSeed.fromCbor(c));
    const nextSeq = leafOf(objectFor(envelope, "next-seq"), (c) => {
      const n = expectUnsigned(c);
      if (n > 0xffffffffn) throw CborError.custom("integer out of range");
      return Number(n);
    });
    const rngState = leafOf(objectFor(envelope, "rng-state"), (c) => RngState.fromCbor(c));
    return ProvenanceMarkGenerator.fromState({ res, seed, chainId, nextSeq, rngState });
  }
}

/** The object of the assertion with `predicate`; a missing or ambiguous one is `Envelope`. */
function objectFor(envelope: Envelope, predicate: string): Envelope {
  try {
    return envelope.objectForPredicate(predicate);
  } catch (error) {
    if (EnvelopeError.isEnvelopeError(error)) {
      throw ProvenanceMarkError.envelope(error.message, error);
    }
    throw error;
  }
}

/** The envelope's leaf, decoded; not a leaf is `Envelope`, a leaf the decoder refuses is `Cbor`. */
function leafOf<T>(envelope: Envelope, decode: (c: Cbor) => T | undefined): T {
  let leaf: Cbor;
  try {
    leaf = envelope.expectLeaf();
  } catch (error) {
    if (EnvelopeError.isEnvelopeError(error)) {
      throw ProvenanceMarkError.envelope(error.message, error);
    }
    throw error;
  }
  try {
    const value = decode(leaf);
    if (value === undefined) throw CborError.wrongType();
    return value;
  } catch (error) {
    if (CborError.isCborError(error)) throw ProvenanceMarkError.cbor(error.message, error);
    if (ProvenanceMarkError.isProvenanceMarkError(error) && error.is("Cbor")) {
      throw ProvenanceMarkError.cbor(error.details.message, error.cause);
    }
    throw error;
  }
}

/** The reference's `deserialize_block`: exactly 32 bytes, else `Json`. */
function seedBlock(bytes: Uint8Array, _field: string): Uint8Array {
  if (bytes.length !== 32) {
    throw ProvenanceMarkError.json(`seed length is ${bytes.length}, expected 32`);
  }
  return bytes;
}

/** A resolution name, or a `RangeError`. */
function expectResolution(res: ProvenanceMarkResolution): void {
  if (!isProvenanceMarkResolution(res)) {
    throw new RangeError(
      `res must be "low", "medium", "quartile" or "high", got ${JSON.stringify(res)}`,
    );
  }
}
