# Divergences from the Rust reference implementation

This library is a TypeScript port of
[`BlockchainCommons/provenance-mark-rust`](https://github.com/BlockchainCommons/provenance-mark-rust),
tracked at version **0.24.0**
([`1732c79c`](https://github.com/BlockchainCommons/provenance-mark-rust/commit/1732c79c89a72c3bfd66d6b23537d50e79fff9b5)).

The tracked version and commit are recorded in
[`.github/versions.yml`](./.github/versions.yml), and the `upstream.yml`
workflow opens a tracking issue whenever the reference implementation moves
ahead of it.

This document is the deliberate record of every place the TypeScript behaviour
differs from the Rust reference. It has four kinds of entry:

1. **True behavioral divergences** - the same input produces a different outcome.
2. **JS-only input domain** - inputs that have no Rust analog, so there is nothing to diverge from.
3. **Mapping equivalences** - the reference's surface reached through TypeScript's shapes, validated through the bytes and text they produce.
4. **Reference behaviours the port declines to reproduce** - defects on the reference's side, with their upstream status.

Every entry below is checked by `tests/rust-validation`, a Rust program that
replays `tests/vectors/vectors.json` against the published `provenance-mark`
0.24.0 crate (its [README](./tests/rust-validation/README.md) describes the
recipes and the harness classes). The current run: **638 vectors - 587
match, 21 panic-mapped, 28 js-only (J1 1, J3 17, J4 10), 2 port-right, 0
pending, 0 unparsable, 0 MISMATCH.**

## 1. True behavioral divergences

_None on any output._ Every mark, message, CBOR, UR, bytewords, URL, JSON,
envelope and validation report is byte- and text-identical for every input
both sides accept. `toUrl` appends the `provenance` parameter to the base's
query text as the reference's `append_pair` does, re-encoding nothing and
keeping an existing `provenance` parameter; the 4-byte date codec truncates
toward zero as the reference's `num_seconds()` does, so an instant inside the
second before the 2001 epoch encodes as the epoch on both sides.

## 2. JS-only input domain

The reference's types rule these out; the port rejects each before any
state changes. The harness counts them as `js-only`.

- **Arguments of the wrong type or value.** A non-`Uint8Array` where bytes
  go, a non-`ProvenanceMark` where a mark goes, a non-array to `validate`, a
  non-string comment or seed text: `TypeError`. A resolution name or report
  format outside its set, an identifier word count outside 4 to 32 or not an
  integer: `RangeError`. An invalid `Date`: `InvalidDate`.
- **JSON read from values.** `fromJSON` takes what `JSON.parse` produced, so
  `1.0` reads as the integer 1 and `-0` as 0, and a duplicate key keeps its
  last value; the reference's serde reads text and rejects the float and the
  duplicate.
- **Where the reference panics, the port throws.** An identifier word count
  outside 4 to 32 (`assert!`) is `RangeError`; a date the resolution cannot
  encode inside `next` (`.unwrap()`) is `YearOutOfRange`, `DateOutOfRange` or
  `InvalidMonthOrDay`, thrown before the generator's state changes, where the
  reference advances the state first; a base that is not a URL in `toUrl`
  (`.unwrap()`) is `Url`. The harness counts these rows as `panic-mapped`,
  compared by code.

## 3. Mapping equivalences

- `ProvenanceMarkGenerator.from`, `fromPassphrase`, `random`, `fromState` are
  `new_with_seed`, `new_with_passphrase`, `new_using`/`new_random` and `new`;
  `ProvenanceSeed.from`, `random`, `fromPassphrase` are
  `from_bytes`/`from_slice`, `new`/`new_using`, `new_with_passphrase`;
  `RngState.from` is `from_bytes`/`from_slice`, and its wrong-length error is
  `InvalidRngStateLength` where the reference returns a bare string (through
  CBOR both sides report `Cbor[Custom]`).
- `idBytewords`, `idBytemoji`, `idBytewordsMinimal`,
  `disambiguatedIdBytewords` and `disambiguatedIdBytemoji` are the
  reference's methods with their two trailing parameters as
  `{ wordCount, prefix }` and `{ prefix }`; `serializeDate`,
  `deserializeDate`, `serializeSeq` and `deserializeSeq` take the resolution
  first, since a resolution is a string here. `next(date, info?)`,
  `toBytewords(style?)`, `ProvenanceMarkInfo.from(mark, comment?)` and
  `formatReport(report, format?)` are the reference's positional optionals.
  `validate(marks)` is `ProvenanceMark::validate` and
  `ValidationReport::validate`; `hasIssues`, `chainIdHex` and `formatReport`
  are the report's methods as free functions over a frozen plain record.
- Accessors are getters returning copies; `checkPrecedes` is `precedes_opt`;
  `fromCbor` is `from_tagged_cbor`; `toUR`/`fromUR` are `ur_string`/`from_ur`;
  every date input is a `Date` or a `CborDate`, and a `Date` holds
  milliseconds where chrono holds nanoseconds (every codec stores day, second
  or millisecond precision, so the bytes agree). A leap second (`:60`) is
  read as the next minute, which is what the reference encodes for it too;
  the reference's `Date` display keeps `:60` where a `Date` cannot.
- `fromUrl` also takes a string and parses it with the WHATWG `URL`, the same
  specification the reference's `url` crate implements; every base in the
  corpus parses to the same string on both sides.
- `parseSeed`, `fromJSON` and the generator's and info's JSON readers reject
  as the reference's serde types do, with serde's wording; base64 is decoded
  with the base64 crate's rules and messages.

## 4. Reference behaviours the port declines to reproduce

| # | Reference | Port | Upstream |
|---|---|---|---|
| 1 | `ProvenanceMarkGenerator`'s derived `Deserialize` skips the chain-id length check its constructor makes; a short chain id is accepted and the first `next` panics. | `fromJSON` rejects it (`Json`, with the constructor's message). | not yet filed |
| 2 | A negative resolution number in CBOR reaches the reference as 255 (`bc-dcbor-rust`'s `u8::try_from` wraps it) and is reported as an unknown resolution. | `Cbor[WrongType]`. | not yet filed, on `bc-dcbor-rust` |

The harness counts these two rows as `port-right`.

Reproduced on purpose: `toUrl` on a base that already carries `provenance`
appends a second parameter, and `fromUrl` then reads the first. Not yet
filed either.

## 5. Dependencies

SHA-256, HKDF-SHA-256 and ChaCha20 are `@blockchaincommons/crypto`'s;
xoshiro256\*\* is `@blockchaincommons/rand`'s `SeededRng`; bytewords, URs and
their errors are `@blockchaincommons/uniform-resources`'; date strings are
parsed by dcbor's `CborDate.fromString`, whose grammar equals the reference's
`Date::from_string`; envelopes are `@blockchaincommons/envelope`'s and the
mark's CBOR tag is `@blockchaincommons/tags`'s `TAG_PROVENANCE_MARK`. The
reference's `crypto_utils` and `xoshiro256starstar` modules are therefore not
re-exported; `extendKey` and `obfuscate`, the specification's steps, are.

## Maintenance

When the upstream reference moves:

1. Review the diff via the link in the `upstream.yml` tracking issue.
2. Port the relevant changes.
3. Update `.github/versions.yml` with the new version and commit, and the
   `provenance-mark` pin in `tests/rust-validation/Cargo.toml`.
4. Update the tracked version at the top of this file.
5. Add, amend, or remove divergence entries as the port requires, and keep
   the harness classes in `tests/rust-validation/src/main.rs` in step. A
   `MISMATCH` from the harness is a bug on one side, never a new class. An
   input only JavaScript can express is a `domain` row in the vector
   adapter and a `js-only` class in the harness, not an entry above. When
   an item of §4 is fixed upstream, the port follows and the row goes.
