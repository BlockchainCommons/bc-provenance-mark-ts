# Rust reference cross-validation

Replays `tests/vectors/vectors.json` against the `provenance-mark`
reference: the published `provenance-mark` 0.24.0 crate from crates.io
(sources `provenance-mark-rust` commit `1732c79c`) over the published
`bc-envelope` 0.43.0, `bc-ur` 0.19.2, `dcbor` 0.25.2 and `known-values`
0.15.5. Nothing is patched. The toolchain is pinned
(`rust-toolchain.toml`: 1.98.1).

```sh
cd tests/rust-validation
cargo run --release --offline -- ../vectors/vectors.json
cargo run --release --offline -- ../vectors/vectors.json --verbose   # every row's class
DUMP=/tmp/rust.json cargo run --release --offline -- ../vectors/vectors.json   # every reference outcome by name
```

Result line on 2026-09-16:

```
638 vectors - 587 match, 21 panic-mapped, 28 js-only (J1 1, J3 17, J4 10), 2 port-right, 0 pending, 0 unparsable, 0 MISMATCH
```

## What is compared

Every recipe (`tests/vectors/recipes.ts`) yields one outcome string on
each side and the two are compared textually. The TypeScript outcome is
the vector's `expect`, materialised by `scripts/generate-vectors.ts` with
the working tree (`tests/vectors/working-tree-adapter.ts`); the
reference's is computed by `src/main.rs`.

- `generator`: a seeded or passphrase chain at a resolution; every mark's
  debug and display strings, message, tagged CBOR, UR, URL encoding,
  three bytewords styles, identifiers, JSON and envelope format, then the
  generator's JSON. Info payloads are text or hex CBOR (`infoHex`).
- `decode`: a message, tagged CBOR bytes, a UR string (in the reference's
  three steps: the UR grammar, the type check flattened into
  `dcbor::Error::Custom`, the decoder), a URL encoding or bytewords, at a
  resolution, into the debug string.
- `validate`: chains of messages into a report, as text and as JSON
  (compact or pretty), then `hasIssues`.
- `date`: the date codecs at a resolution, encoding a date string or
  decoding hex bytes.
- `json`: persisted JSON given to the mark's or the generator's
  deserialiser; `genEnvelope`: a generator envelope with stray
  assertions; `url` / `fromurl`: `toUrl` over a base and `fromUrl` over a
  string; `cbor`: bytes given to the tagged decoder (`fromCbor`, the
  codec), the untagged one (`fromUntaggedCbor`) or `fromCborData`;
  `identifier`: a word count and style (`idBytewords`, `idBytemoji`,
  `idBytewordsMinimal`); `parse`: `parseDate`; `bytes`: a
  CBOR byte string given to `ProvenanceSeed.fromCbor` or
  `RngState.fromCbor`; `seed`: a string given to `parseSeed` (the
  reference's `Result<_, String>` renders as the port's `Json`); `url`
  bases cover every way a query can be written, since the parameter is
  appended to the query text as it stands; `info`:
  `ProvenanceMarkInfo` from the reference chain's genesis mark with a
  comment, or read from JSON — the Markdown summary and the JSON;
  `disambiguate`: `disambiguated_id_bytewords`/`_bytemoji` over marks of
  the reference chain by index; `summary`: the envelope format of a leaf
  holding tagged CBOR (the summariser's text, good or malformed).
- A rejection is `throw:<code>[<inner code>]|<message>`: the reference's
  error variant, the variant it wraps for `Bytewords`, `Cbor` and
  `Envelope`, and its `Display`. A decoder entry point (`fromCbor`,
  `fromUntaggedCbor`, `fromCborData`, `fromUR`, the seed and RNG state
  decoders) returns the dcbor error itself in the reference, so its row
  reads `throw:Cbor[<dcbor variant>]|<dcbor message>`; a package error
  raised inside the untagged decoder is flattened to `Cbor[Custom]` with
  its message, as the reference's `dcbor::Error::from` flattens it. A JSON
  fault is `throw:Json|JSON error: <serde text>`; a date that does not
  parse is `throw:InvalidDate|invalid date: <reason>`.
- The harness pins the known-values directory configuration first
  (`set_directory_config(DirectoryConfig::new())`), as the test setup file
  and the generator pin the port's, so no row reads the runner's home
  directory; then registers envelope's and provenance-mark's tags, as the
  setup file does.
- Where the reference panics at a call the port rejects with a typed
  error, `PANIC_MAPPED` in `src/main.rs` names the port's code and the
  row is `panic-mapped`, compared by code only: the identifier renderers
  assert the word count (`RangeError`), and `next` unwraps the date codec
  (`YearOutOfRange`, `DateOutOfRange`, `InvalidMonthOrDay`).
- Where the port is right and the reference is not, `PORT_RIGHT` in
  `src/main.rs` names the row and the reason and the row is `port-right`,
  not compared: the generator's JSON deserialiser checks the chain id's
  length where the reference's serde derive skips the check its
  constructor makes; a negative resolution number is `WrongType` where
  dcbor's `u8::try_from` wraps it to 255. Why each row is right, and
  whether it has been reported, is recorded in
  [`RUST_DIVERGENCES.md`](../../RUST_DIVERGENCES.md). `toUrl` on a base
  that is not a URL is `panic-mapped` (`Url`).
- A row whose difference is a known, not yet fixed finding is `pending`
  when `PENDING` in `src/main.rs` names it; the list is empty at a release.
- `domain` rows are the JavaScript input domain (`js-only`), in three
  classes here: J1 a non-integer number (a fractional word count), J3 a
  value the reference's types cannot express (an invalid `Date`, a `null`
  or an empty object where JSON goes, a string where a resolution or a
  seed goes, an unknown report format, `-0` and `1.0` in JSON) and J4 a
  reference surface the port reaches differently (`fromUrl` over a
  string, `next` with a text or number info, the copied-out `date`, the
  RNG state's own length code, frozen values, `CborDate` inputs, a leap
  second read as the next minute, generator equality).
- A recipe field this program cannot read is `unparsable`. An unhandled
  panic, or any other difference, is a MISMATCH. Both make the process
  exit 1.

## Rows that guard the sibling packages

| Sibling behaviour                                                                                                                         | Rows                                                                                |
| ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| uniform-resources: bytewords decoding (invalid word, length, checksum; case-sensitive), UR grammar and type errors                        | `decode bytewords …`, `decode url …`, `decode ur …`, `fromurl …`, the `casing` rows |
| dcbor: tag and type errors named as the reference names them; date strings parsed as `Date::from_string` parses them; diagnostic notation | the `cbor` rows, the `json … date` and `parse` rows, `generator … info` rows        |
| envelope: assertion counting, typed envelopes, leaf extraction                                                                            | the `genEnvelope` rows, every `envelope=` line                                      |
| rand: xoshiro256** key draws                                                                                                              | every `generator` row                                                               |
| crypto: SHA-256, HKDF, ChaCha20                                                                                                           | every `generator` and `decode message` row                                          |

## Self-checks

`mismatch.json` holds one row with a value flipped; the run must exit 1
with `1 MISMATCH`. `fixtures/classes.json` holds one row per class and
must count them as `1 match, 1 panic-mapped, 3 js-only (J1 1, J3 1, J4
1), 1 port-right`; `fixtures/malformed.json` has a recipe kind this
program cannot read (`1 unparsable`) and must exit 1.

## CI

The `rust-validation` job in `.github/workflows/ci.yml` points `HOME` at an
empty directory, checks the golden file against the working tree
(`bun run test:golden`), builds the harness against the pinned crates and
toolchain (`cargo run --locked --offline` after `cargo fetch --locked`),
runs the golden file, then the mismatch and class fixtures. A MISMATCH
anywhere fails the job.

## Maintenance

When the reference moves: update the pins in `Cargo.toml`, run
`cargo update -p provenance-mark`, check the toolchain pin, regenerate the
vectors (`bun run vectors:generate`), run the replay and copy the result
line above. A new difference is a bug on one side: fix it, or add the
js-only class, the panic mapping or the port-right row with its reason in
`src/main.rs` and here.
