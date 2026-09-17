# Migrating to `@blockchaincommons/provenance-mark`

## From `1.0.0-beta.2` to `1.0.0-beta.3`

- **Dates in.** Every date input (`ProvenanceMark.from({ date })`,
  `generator.next(date)`, `serializeDate`, the date displays) takes a
  `Date | CborDate`; nothing you pass today changes.
- **Validation issues.** `HashMismatch.expected`/`actual` are `Uint8Array`s
  (were hex strings) and `DateOrdering.previous`/`next` are `Date`s (were
  display strings). `formatValidationIssue`, `formatReport` and the JSON
  report render exactly as before; only code reading the fields changes.
- **`parseSeed`.** A bad string is `Json` (`JSON error: Invalid symbol 33,
  offset 0.`, `JSON error: seed length is 3, expected 32`), no longer
  `Base64` or `InvalidSeedLength`, matching the reference's `parse_seed`.
- **Key bytes.** `ProvenanceMark.from` throws a `TypeError` when `key`,
  `nextKey` or `chainId` is not a `Uint8Array` (a string used to build a
  corrupt mark).
- **Resolution numbers in CBOR.** `[300, …]` is `Cbor` with the inner code
  `OutOfRange` (was `Custom`).
- **New.** `ProvenanceMarkGenerator.equals`, the `DateInput` type.
- **`toUrl`.** Appends `provenance=…` to the base's query text as the
  reference's `append_pair` does: the query is no longer re-serialised
  (`?q=a%20b` and `?a` stay as written) and an existing `provenance`
  parameter is kept rather than replaced, so `fromUrl` on such a URL reads
  the first one, as the reference does.
- **The 4-byte date codec** truncates toward zero, as the reference's
  `num_seconds()` does: an instant inside the second before the 2001 epoch
  encodes as the epoch instead of being rejected.
- **The reference's names.** `identifier({ style, words, prefix })` is
  `idBytewords({ wordCount, prefix })`, `idBytemoji(…)` and
  `idBytewordsMinimal(…)`; `disambiguatedIdentifiers(marks, { style, prefix })`
  is `ProvenanceMark.disambiguatedIdBytewords(marks, { prefix })` and
  `disambiguatedIdBytemoji(marks, { prefix })` (no minimal form, as in the
  reference); `encodeDate(date, { resolution })`, `decodeDate`, `encodeSeq`
  and `decodeSeq` are `serializeDate(res, date)`, `deserializeDate(res, bytes)`,
  `serializeSeq(res, seq)` and `deserializeSeq(res, bytes)`. `IdentifierStyle`,
  `IDENTIFIER_STYLES`, `ResolutionOptions` and `BytewordsOptions` are gone.
- **Positional optionals.** `next(date, { info })` is `next(date, info)`,
  `toBytewords({ style })` is `toBytewords(style)`,
  `ProvenanceMarkInfo.from(mark, { comment })` is `from(mark, comment)` and
  `formatReport(report, { format })` is `formatReport(report, format)`.
  `NextMarkOptions`, `MarkInfoOptions` and `FormatReportOptions` are gone.

## From `@bcts/provenance-mark`

`@blockchaincommons/provenance-mark` is the successor to `@bcts/provenance-mark`.

## 0. Checklist

- [ ] Replace the `@bcts/provenance-mark` dependency and import specifiers with `@blockchaincommons/provenance-mark` (appendix).
- [ ] Resolutions are strings: `"low" | "medium" | "quartile" | "high"` (§1).
- [ ] Match on `error.code` (the reference's variant names: `Bytewords`, `Cbor`, `Url`, `Base64`, `Json`, `TryFromInt`, `Validation`, `Envelope`, …) and read `error.details`; `error.is("Validation")` narrows `error.details.issue` (§2).
- [ ] Catch `ProvenanceMarkError` where you caught a sibling's error out of a decoder (`URError`, `CborError`, `EnvelopeError`, a `DOMException` from `atob`): they are wrapped, with the original as `cause` (§2).
- [ ] Constructors take an options object: `ProvenanceMark.from({ … })`, `ProvenanceMarkGenerator.from({ res, seed })`; the identifier methods take `{ wordCount, prefix }`; `next(date, info?)`, `toBytewords(style?)`, `formatReport(report, format?)` and `ProvenanceMarkInfo.from(mark, comment?)` keep their positional optionals (§3–§5).
- [ ] Give `fromCbor` (and `codec.decode`) the tagged form; hold the `[res, message]` array? Call `fromUntaggedCbor` (§3).
- [ ] Give `parseDate`, `dateFromIso8601` and `fromJSON` RFC 3339 strings with a zone (`2023-06-20T12:00:00Z`, `…+02:00`) or bare dates (`2023-06-20`); a zoneless time, prose or an epoch number is `InvalidDate` (§5).
- [ ] Persisted JSON: a mark's `chainID` key and `info_bytes: ""` are rejected; a generator's `nextSeq` must be an integer in 0..2³², its `seed` and `rngState` 32 bytes, its `chainID` the link length. `fromJSON` takes `unknown`, so drop the casts (§3, §4).
- [ ] A generator envelope with assertions beyond the five is `ExtraKeys` (§4).
- [ ] `idBytewords({ wordCount })` outside 4 to 32, an unknown `formatReport` format, an unknown resolution name: `RangeError` (§3, §5).
- [ ] `mark.date` is a copy: mutating it does not change the mark. Marks, seeds, RNG states, infos and reports are frozen (§3).
- [ ] A URL's empty `provenance=` parameter is a `Bytewords` rejection, only a missing one is `MissingUrlParameter`; `fromUrl` and `toUrl` take a string or a `URL` (§3).
- [ ] Upper-case bytewords and URL encodings are rejected (bytewords are case-sensitive, as the reference's) (§3).

## 1. Resolutions are strings

| Before | After |
|---|---|
| `ProvenanceMarkResolution.Low` … `.High` (numeric enum) | `"low" \| "medium" \| "quartile" \| "high"` (`ProvenanceMarkResolution`, `PROVENANCE_MARK_RESOLUTIONS`, frozen) |
| `resolutionToNumber(res)` / `resolutionFromNumber(n)` | `resolutionCode(res)` / `resolutionFromCode(n)` (the 0–3 wire number; JSON and CBOR still carry it; anything outside 0 to 3 is `ResolutionError`) |
| `resolutionToString(res)` | the value itself |
| an unknown resolution given to a constructor: undefined behaviour | `RangeError` |

`linkLength`, `seqBytesLength`, `dateBytesLength` and `fixedLength` keep
their names and take the string. The byte ranges are internal.

## 2. Errors

| Before | After |
|---|---|
| `ProvenanceMarkErrorType` enum, `error.type`, untyped `error.details` | `ProvenanceMarkError { code, details }` — `code` is a string union (`ProvenanceMarkErrorCode`, `PROVENANCE_MARK_ERROR_CODES`), `details` is typed per code (`ProvenanceMarkErrorDetailsByCode`, `ProvenanceMarkErrorDetailsFor<C>`) and frozen; `error.is(code)` narrows it |
| `BytewordsError`, `CborError`, `UrlError`, `Base64Error`, `JsonError`, `IntegerConversionError`, `ValidationError`, `EnvelopeError` | `Bytewords`, `Cbor`, `Url`, `Base64`, `Json`, `TryFromInt`, `Validation`, `Envelope` (the reference's variant names); the other codes keep their names |
| `new ProvenanceMarkError(type, message, details)` | static factories: `ProvenanceMarkError.invalidKeyLength(expected, actual)`, `.cbor(message, cause?)`, `.validation(issue)`, … |
| `error.details.validationIssue` | `error.details.issue` (when `code === "Validation"`) |
| `error.details.details` (a reason string) | `error.details.reason` |
| `ProvenanceMarkResult<T>` | gone (it was `T`) |
| a `URError`/`CborError`/`EnvelopeError`/`DOMException` escaping a decoder | a `ProvenanceMarkError` (`Bytewords`, `Cbor`, `Envelope`, `Base64`) with the sibling error as `cause` and its message as `details.message` |
| `fromCbor`/`fromUR`/`fromCborData` with a `CborError` message prefixed `CBOR error:` | the dcbor error's message bare, as the reference's `TryFrom<CBOR>` returns it; `fromEnvelope` and `fromUrlEncoding` keep the prefix |
| `RngState` with the wrong length → `InvalidSeedLength` | `InvalidRngStateLength` |
| a wrong-typed argument (a string where bytes go, a number where a mark goes) | `TypeError` |

Messages are the reference's; a `Validation` error reads
`validation error: <issue>` as the reference prints it.
`ProvenanceMarkError.isProvenanceMarkError(e)` is an `instanceof` check.

## 3. `ProvenanceMark`

| Before | After |
|---|---|
| `ProvenanceMark.new(res, key, nextKey, chainId, seq, date, info?)` | `ProvenanceMark.from({ res, key, nextKey, chainId, seq, date, info })`; `info` is any `CborInput` (text, numbers, bytes, arrays, maps, a `Cbor` or a `ToCbor`); an invalid `Date` is `InvalidDate` |
| `mark.res()`, `key()`, `hash()`, `chainId()`, `seqBytes()`, `dateBytes()`, `seq()`, `date()`, `info()`, `message()`, `id()`, `idHex()`, `isGenesis()` | getters: `mark.res`, `mark.key`, … `mark.isGenesis`; every byte array and `mark.date` is a copy; the mark is frozen |
| `idBytewords(n, prefix)` / `idBytemoji(n, prefix)` / `idBytewordsMinimal(n, prefix)` | `idBytewords({ wordCount: n, prefix })` / `idBytemoji(…)` / `idBytewordsMinimal(…)` (defaults 4, no prefix); a `wordCount` outside 4 to 32 or fractional is a `RangeError` |
| `bytewordsIdentifier(prefix)` / `bytemojiIdentifier(prefix)` / `bytewordsMinimalIdentifier(prefix)` | `idBytewords({ prefix })`, `idBytemoji({ prefix })`, `idBytewordsMinimal({ prefix })` |
| `identifier()` (8 hex characters) | `idHex.slice(0, 8)` |
| `disambiguatedIdBytewords(marks, prefix)` / `disambiguatedIdBytemoji(marks, prefix)` | `ProvenanceMark.disambiguatedIdBytewords(marks, { prefix })` / `disambiguatedIdBytemoji(marks, { prefix })` |
| `precedesOpt(next)` | `checkPrecedes(next)` (throws `Validation`) |
| `toBytewords()` / `toBytewordsWithStyle(style)` | `toBytewords(style?)` (`"standard"` unless given) |
| `fromBytewords(res, s)`: upper-case words accepted; a `URError` on failure | case-sensitive; `Bytewords` on failure |
| `untaggedCbor()`, `taggedCbor()`, `toCborData()` | `untaggedCbor()`, `toCbor()` (tagged), `toCbor().toData()` |
| `fromTaggedCbor(cbor)` / `fromUntaggedCbor(cbor)` | `fromCbor(cbor)` (tagged only) / `fromUntaggedCbor(cbor)`; `ProvenanceMark.codec` (a `ProvenanceMarkCodec`) for `decodeURWith` and friends |
| `fromCborData(bytes)` | unchanged; a failure is `Cbor` |
| `urString()` / `fromURString(s)` | `toUR().toString()` / `fromUR(UR.parse(s))`; a UR of another type is `Cbor` (`expected UR type provenance, but found …`) |
| `intoEnvelope()` / `provenanceMarkToEnvelope(mark)` / `provenanceMarkFromEnvelope(e)` | `toEnvelope()` (`ToEnvelope`) / `ProvenanceMark.fromEnvelope(e)` (`Cbor` when the subject is not a mark) |
| `toUrl(base: string)` (a `TypeError` on a bad base) | `toUrl(base: string \| URL)`; `Url` when it does not parse; the parameter is appended to the query text as it stands and an existing `provenance` parameter is kept, as the reference keeps it |
| `fromUrl(url: URL)`; `?provenance=` → `MissingUrlParameter` | `fromUrl(url: string \| URL)` (`Url` when it does not parse); `?provenance=` decoded → `Bytewords`; only a missing parameter is `MissingUrlParameter` |
| `fromUrlEncoding(s)`: upper-case accepted; a `URError`/`CborError` on failure | case-sensitive; `Bytewords` or `Cbor` (`CBOR error: …`) on failure |
| `fromJSON(json)`: lenient (`chainID`, `info_bytes: ""`, any `seq`, dates via `new Date`) | `fromJSON(json: unknown)`: every fault is `Json` with serde's wording (`missing field \`res\``, `invalid type: string "0", expected u32`, …); `chain_id` only; `info_bytes` valid CBOR or absent; `seq` a u32; the date RFC 3339 or `YYYY-MM-DD` |
| `toDebugString()` interpolated text info raw | text info through diagnostic notation, quotes escaped (`info: "a\"b"`) |
| `fingerprint()`, `toUrlEncoding`, `fromMessage`, `toJSON`, `equals`, `toString`, `precedes`, `isSequenceValid`, `validate` | unchanged |

## 4. `ProvenanceMarkGenerator`, `ProvenanceSeed`, `RngState`

| Before | After |
|---|---|
| `ProvenanceMarkGenerator.newWithSeed(res, seed)` | `ProvenanceMarkGenerator.from({ res, seed })` |
| `newWithPassphrase(res, passphrase)` | `fromPassphrase(res, passphrase)` |
| `newRandom(res)` / `newUsing(res, randomData)` | `random(res, { rng })` |
| `new(res, seed, chainId, nextSeq, rngState)` | `fromState({ res, seed, chainId, nextSeq, rngState })` (`InvalidChainIdLength`, `ResolutionError` for a `nextSeq` that is not a u32) |
| `g.res()`, `seed()`, `chainId()`, `nextSeq()`, `rngState()` | getters |
| `g.next(date, info)` | unchanged; a date the resolution cannot encode (`YearOutOfRange`, `DateOutOfRange`, `InvalidDate`) throws before any state changes |
| `intoEnvelope()` / `provenanceMarkGeneratorToEnvelope(g)` / `provenanceMarkGeneratorFromEnvelope(e)` | `toEnvelope()` / `ProvenanceMarkGenerator.fromEnvelope(e)`: exactly five assertions (`ExtraKeys`), a field of the wrong shape `Cbor`, a missing or duplicated one `Envelope` |
| `fromJSON(json)`: cast every field | `fromJSON(json: unknown)`: `res` 0 to 3, `nextSeq` a u32, `seed`/`rngState` 32 bytes, `chainID` the link length; every fault `Json` with serde's wording |
| `g.toString()` printed the resolution's number and the RNG state as a byte list | prints the resolution's name, as the reference's `Display` does, and the RNG state as hex |
| `ProvenanceSeed.new()` / `newUsing(data)` / `newWithPassphrase(p)` / `fromBytes(b)` / `fromSlice(b)` | `random({ rng })` / `from(bytes)` (exactly 32, `InvalidSeedLength`) / `fromPassphrase(p)`; frozen |
| `seed.toBytes()` / `seed.hex()` | `seed.bytes` / `seed.hex` (+ `equals`, `toCbor`, `fromCbor`) |
| `RngState.fromBytes(b)` / `fromSlice(b)`, `toBytes()`, `hex()` | `RngState.from(b)` (exactly 32, `InvalidRngStateLength`), `.bytes`, `.hex` (+ `equals`, `toCbor`, `fromCbor`); frozen |
| `ProvenanceMarkInfo.new(mark, comment)`, `info.mark()`, `toUR()`, `bytewords()`, `bytemoji()`, `comment()` | `ProvenanceMarkInfo.from(mark, comment?)`, getters `mark`, `ur`, `bytewords`, `bytemoji`, `comment`; frozen; `fromJSON` requires `ur`, `bytewords` and `bytemoji` strings |

## 5. Dates, validation, tags

| Before | After |
|---|---|
| `serializeDate(res, d)` / `deserializeDate(res, b)` | unchanged; an invalid `Date` is `InvalidDate`; the messages are the reference's (`invalid date length: expected 2, 4, or 6 bytes, got N`, `seconds value too large for u32`, …) |
| `serialize2Bytes`/`4`/`6`, `deserialize2Bytes`/`4`/`6`, `SerializableDate` | gone: `serializeDate` and `deserializeDate` cover them at every resolution |
| `serializeSeq(res, n)` / `deserializeSeq(res, b)` | unchanged |
| `parseDate(s)`, `dateFromIso8601(s)`: anything `new Date` read (a zoneless time as local, prose, `2023-02-29`) | RFC 3339 with a zone, or `YYYY-MM-DD` (UTC midnight, calendar-checked), as the reference's `Date::from_string`; else `InvalidDate` |
| `dateToDisplay(d)` kept milliseconds | second precision (`2023-06-20T12:00:00Z`), the date alone at midnight, as the reference displays |
| `rangeOfDaysInMonth` counted days in the local zone | UTC (`DayRange`) |
| `ValidationReportFormat.Text` / `.JsonCompact` / `.JsonPretty`; `formatReport(report, format)` | `formatReport(report, format?)` with the strings `"text" \| "jsonCompact" \| "jsonPretty"` (default `"text"`); an unknown format is a `RangeError` |
| `validate`, `hasIssues`, `chainIdHex`, `formatValidationIssue`, the report interfaces, `ValidationIssue` | unchanged in shape; the report and its arrays are frozen and the types `readonly`; `validate` checks its argument (`TypeError`) |
| `registerTags()` / `registerTagsIn(context)` | unchanged names; `registerTags()` calls envelope's `registerTags()` then sets the provenance-mark summariser, as the reference's does; the `FormatContext` re-export is gone — import it from `@blockchaincommons/envelope/format` |
| `SHA256_SIZE`, `sha256`, `sha256Prefix`, `hkdfHmacSha256` | gone: use `@blockchaincommons/crypto`. `extendKey` and `obfuscate` stay (they are the spec's steps) |
| `dateToIso8601`, `dateToDateString`, `parseSeed` | unchanged; `parseSeed` reports bad base64 as `Base64` with the reference's wording |

New names: `fromUntaggedCbor`, `expectDate`, `IDENTIFIER_STYLES`,
`ProvenanceMarkCodec`, `DayRange`, `ProvenanceMarkErrorDetailsByCode`,
`ProvenanceMarkErrorDetailsFor`, `ProvenanceMarkErrorTyped`,
`ExpectedActualCode`, `ReasonCode`, `MessageCode`.

## 6. Dependencies

`@noble/ciphers`, `@noble/hashes` and `@blockchaincommons/dcbor-compat` are
gone; `@blockchaincommons/crypto`, `dcbor`, `rand`, `tags`,
`uniform-resources` and `envelope` are the runtime dependencies. The
xoshiro256** generator is rand's (`Xoshiro256StarStar`); hex comes from
dcbor; base64 is an own strict codec (standard alphabet, canonical
padding, no whitespace).

## Appendix: migrating from `@bcts/provenance-mark`

`@blockchaincommons/provenance-mark` is the canonical home of this library. It was extracted from the
[`paritytech/bcts`](https://github.com/paritytech/bcts) monorepo, where it was
published as `@bcts/provenance-mark`, into its own Blockchain Commons repository at
[`BlockchainCommons/bc-provenance-mark-ts`](https://github.com/BlockchainCommons/bc-provenance-mark-ts).

### TL;DR checklist

- [ ] Replace the `@bcts/provenance-mark` dependency with `@blockchaincommons/provenance-mark`.
- [ ] Rewrite import specifiers: `@bcts/provenance-mark` becomes `@blockchaincommons/provenance-mark`.
- [ ] Apply §0 above: the API and the rejections changed with the move.
- [ ] Raise your Node floor to **22.12**.
- [ ] Ensure TypeScript **>= 5.7** to consume the published types.
- [ ] If you relied on the `browser` field or a global-script build, switch to the ESM or CJS entry point.

### 1. Package name and imports

```diff
- import { /* ... */ } from "@bcts/provenance-mark";
+ import { /* ... */ } from "@blockchaincommons/provenance-mark";
```

```diff
  "dependencies": {
-   "@bcts/provenance-mark": "^1.0.0-beta.6"
+   "@blockchaincommons/provenance-mark": "^1.0.0-beta.1"
  }
```

### 2. Version numbering restarts

`@bcts/provenance-mark` versions moved in lockstep with every other package in the
monorepo, which is why it reached `1.0.0-beta.6`. Each extracted package now
versions independently and starts again at `1.0.0-beta.1`. A lower version
number here does **not** mean older code.

### 3. Node and TypeScript floors moved up

| | `@bcts/provenance-mark` | `@blockchaincommons/provenance-mark` |
|---|---|---|
| Node | `>= 18` | `>= 22.12` |
| TypeScript (consumers) | 6.x | `>= 5.7` |

### 4. The IIFE / global-script build is gone

`@bcts/provenance-mark` shipped an additional IIFE bundle exposed through the `browser`
field. That build is dropped: IIFE entry points cannot share chunks, which forks
module-level singletons across entry points. Use the ESM entry (`import`) or the
CJS entry (`require`); both are declared in `exports` and validated in CI by
`publint` and `@arethetypeswrong/cli`.
