# Frozen baseline build

`provenance-mark-baseline.mjs` is the self-contained ESM bundle of `@blockchaincommons/provenance-mark` built from
commit `ae7012b9b580e1a7b7f82236645885ca4c7879b2`, the wire-format reference. Sibling
`@blockchaincommons/*` packages are INLINED from their own frozen baseline
bundles (@blockchaincommons/crypto, @blockchaincommons/rand, @blockchaincommons/envelope, @blockchaincommons/lifehash, @blockchaincommons/dcbor-parse, @blockchaincommons/sskr, @blockchaincommons/tags, @blockchaincommons/dcbor-pattern, @blockchaincommons/known-values, @blockchaincommons/components, @blockchaincommons/uniform-resources, @blockchaincommons/envelope-pattern, @blockchaincommons/shamir), so this bundle keeps the
published behaviour of its dependencies after they change.
`provenance-mark-baseline.d.mts` is the public surface at that commit.

`tests/differential.test.ts` runs every corpus recipe through this bundle and
the working tree and asserts identical outcomes; it pins the sha256 below so
an accidental rebuild cannot turn the differential into a self-comparison.

Baseline commit: ae7012b9b580e1a7b7f82236645885ca4c7879b2
Baseline sha256: 569bb692b0f2bb39adba42d8eaba88b29fdbfc9cccc5fe847c0160d901435e34
