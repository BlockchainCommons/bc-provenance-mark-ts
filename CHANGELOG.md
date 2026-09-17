# Changelog

## 1.0.0-beta.3 - 2026-09-16

The second pass against the Rust reference: every remaining behavioural
corner the probe found is closed, three API points move to the sibling
standard, and the repository tooling matches the other packages. The wire
is unchanged.

### Changed

- `ProvenanceMark.from`, `ProvenanceMarkGenerator.next`, `encodeDate` and
  the date displays take a `Date | CborDate` (`DateInput`).
- `ValidationIssue` carries values: `HashMismatch.expected`/`actual` are
  `Uint8Array`s and `DateOrdering.previous`/`next` are `Date`s; the text
  and JSON renderings are unchanged.
- `ProvenanceMarkGenerator.equals(other)`.
- `parseSeed` reads through the seed's serde form: bad base64 or the wrong
  length is `Json` with serde's text (was `Base64` / `InvalidSeedLength`).
  The base64 decoder reports padding faults as the reference's base64
  crate does.
- `ProvenanceMark.from` rejects a key, next key or chain id that is not a
  `Uint8Array` with a `TypeError` (a string was accepted and built a
  corrupt mark).
- `resolutionFromCbor` (every CBOR decoder) reports a resolution number
  above 255 as `Cbor[OutOfRange]`, as the reference's `u8` does.
- The envelope summariser prints the decoder's reason for a tagged leaf
  that is not a mark; the info type's `comment` fault and JSON numbers
  beyond the safe range are worded as serde words them.
- `toUrl` appends the `provenance` parameter to the base's query text as
  the reference's `append_pair` does, re-encoding nothing and keeping an
  existing `provenance` parameter (was: the whole query re-serialised and
  the parameter replaced).
- The 4-byte date codec truncates toward zero, as the reference's
  `num_seconds()` does; an instant in the second before the 2001 epoch
  encodes as the epoch (was: rejected).
- The reference's identifier methods: `idBytewords({ wordCount, prefix })`,
  `idBytemoji`, `idBytewordsMinimal`, `ProvenanceMark.disambiguatedIdBytewords(marks, { prefix })`
  and `disambiguatedIdBytemoji` replace `identifier({ style, words, prefix })`
  and `disambiguatedIdentifiers(marks, { style, prefix })`; `IdentifierStyle`
  and `IDENTIFIER_STYLES` are gone.
- The reference's codec names: `serializeDate(res, date)`,
  `deserializeDate(res, bytes)`, `serializeSeq(res, seq)` and
  `deserializeSeq(res, bytes)` replace `encodeDate`, `decodeDate`,
  `encodeSeq` and `decodeSeq` with their `{ resolution }` option;
  `ResolutionOptions` is gone.
- Positional optionals, as the reference has them: `next(date, info?)`,
  `toBytewords(style?)`, `ProvenanceMarkInfo.from(mark, comment?)`,
  `formatReport(report, format?)`; `NextMarkOptions`, `BytewordsOptions`,
  `MarkInfoOptions` and `FormatReportOptions` are gone.

### Internal

- Vectors: 638 (the seed parser, the info type, disambiguated identifiers,
  the envelope summariser, out-of-range resolution numbers, the pre-epoch
  second, invalid URL bases, JSON floats, `hasIssues` on every report,
  ten more domain cases, 35 URL bases covering every way a query can be
  written and the reference's outputs given back to `fromUrl`, leap-second
  and sub-second date strings). Harness: `pending` class, `port-right` rows
  for the `−1` resolution and the generator's chain-id check, `panic-mapped`
  `toUrl`. Result: `638 vectors - 587 match, 21 panic-mapped, 28 js-only (J1 1, J3 17, J4 10), 2 port-right, 0 pending, 0 unparsable, 0 MISMATCH`.
- `RUST_DIVERGENCES.md` restored: the record of every divergence, the
  JS-only domain, the mapping equivalences and the reference behaviours
  the port declines to reproduce; the harness README keeps the classes.
- Scripts in TypeScript under `scripts/tsconfig.json`; workflow actions
  pinned by SHA; the release publishes `--tag beta` and tags `latest`;
  dependabot reviewers; `ajv` dropped; `lib` without `DOM`.

## 1.0.0-beta.2 - 2026-09-16

- Use `@blockchaincommons/envelope` ^1.0.0-beta.3 

## 1.0.0-beta.1 - 2026-09-16

- Initial beta implementation