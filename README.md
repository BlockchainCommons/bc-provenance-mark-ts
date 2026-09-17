# Blockchain Commons Provenance Marks

### _by Leonardo Custodio_

**`bc-provenance-mark-ts`** is a cryptographically-secured system of chained marks for establishing and verifying the authenticity and sequence of a body of work.

[Provenance Marks](https://provemark.com) provide a cryptographically-secured system for establishing and verifying the authenticity of works in an age of rampant AI-powered manipulation and plagiarism. By combining cryptography, pseudorandom number generation, and linguistic representation, this system generates unique, sequential marks that commit to the content of preceding and subsequent works. These marks ensure public and easy verification of provenance, offering robust security and intuitive usability. Provenance Marks are particularly valuable for securing artistic, intellectual, and commercial works against fraud and deep fakes, protecting creators' reputations and the integrity of their creations.

## Installation Instructions

[@blockchaincommons/provenance-mark](https://www.npmjs.com/package/@blockchaincommons/provenance-mark) is published to npm. Install it with your package manager of choice:

```sh
npm install @blockchaincommons/provenance-mark
# or
pnpm add @blockchaincommons/provenance-mark
# or
yarn add @blockchaincommons/provenance-mark
# or
bun add @blockchaincommons/provenance-mark
```

## Usage Instructions

```typescript
import {
  ProvenanceMarkGenerator,
  ProvenanceMark,
  validate,
  formatReport,
} from "@blockchaincommons/provenance-mark";

const generator = ProvenanceMarkGenerator.fromPassphrase("medium", "Wolf");
const genesis = generator.next(new Date("2023-06-20"));
const second = generator.next(new Date("2023-06-21"), "second work");
// Every date input also takes dcbor's CborDate (from an envelope's `'date'`, say).

genesis.idBytewords({ prefix: true }); // "🅟 …" four upper-case bytewords
second.toUR().toString(); // "ur:provenance/…"
ProvenanceMark.fromUR(second.toUR()).equals(second); // true
genesis.precedes(second); // true
formatReport(validate([genesis, second]), "jsonCompact");
```

Every failure is a `ProvenanceMarkError` whose `code` is the reference's
error name and whose `details` are typed by it (`error.is("Bytewords")`
narrows them); a sibling package's error is wrapped as its `cause`.
Resolutions are `"low" | "medium" | "quartile" | "high"`; marks and
generators round-trip through CBOR, UR, URL, bytewords, JSON and Gordian
Envelope, and read those forms exactly as the reference does.


Runnable examples live in the [`examples/`](https://github.com/BlockchainCommons/bc-provenance-mark-ts/tree/master/examples) directory.

## Status - Beta

`bc-provenance-mark-ts` is currently under active development and in beta testing. It should not be used for production tasks until it has had further testing and auditing. See [Blockchain Commons' Development Phases](https://github.com/BlockchainCommons/Community/blob/master/release-path.md).

### Version History

- **1.0.0-beta.3 (September 16, 2026)** - Second pass against the Rust reference: `Date | CborDate` inputs, validation issues carrying bytes and dates, generator equality, `parseSeed` through the serde path, key-byte guards, `u8` resolution numbers; the reference's names for the identifier methods and the date and sequence codecs, positional optionals, `toUrl` appending as the reference does, the 4-byte codec truncating toward zero. See [CHANGELOG.md](./CHANGELOG.md).
- **1.0.0-beta.2 (September 16, 2026)** - Dependency alignment: `@blockchaincommons/envelope` ^1.0.0-beta.3.
- **1.0.0-beta.1 (September 16, 2026)** - Initial beta implementation: the first release under this name, replacing `@bcts/provenance-mark`. See [MIGRATION.md](./MIGRATION.md).

### Roadmap

- Continued testing and auditing on the path from beta to a stable **1.0.0** release.
- Continued parity with the Rust reference implementation as it evolves (see [`RUST_DIVERGENCES.md`](./RUST_DIVERGENCES.md) for the record of every divergence and [`tests/rust-validation/README.md`](./tests/rust-validation/README.md) for the cross-validation harness and its result line).

### Dependencies

`@blockchaincommons/provenance-mark` depends on `@blockchaincommons/crypto`, `@blockchaincommons/dcbor`, `@blockchaincommons/envelope`, `@blockchaincommons/rand`, `@blockchaincommons/tags` and `@blockchaincommons/uniform-resources` at runtime.

To build and work on this library, you'll need the following tools:

- [Node.js](https://nodejs.org/) >= 22.12 - JavaScript runtime.
- [Bun](https://bun.sh/) - used to install dependencies and run scripts (any node package manager works).
- [TypeScript](https://www.typescriptlang.org/) >= 5.7 - language and type checker.

### Derived from ...

This `bc-provenance-mark-ts` project is either derived from or was inspired by:

- [BlockchainCommons/provenance-mark-rust](https://github.com/BlockchainCommons/provenance-mark-rust) - The reference Rust implementation, by [Wolf McNally](https://github.com/wolfmcnally).
- [paritytech/bcts](https://github.com/paritytech/bcts) - A TypeScript port of many Blockchain Commons' specs, by [Parity Technologies](https://github.com/paritytech).

## Financial Support

`bc-provenance-mark-ts` is a project of [Blockchain Commons](https://www.blockchaincommons.com/). We are proudly a "not-for-profit" social benefit corporation committed to open source & open development. Our work is funded entirely by donations and collaborative partnerships with people like you. Every contribution will be spent on building open tools, technologies, and techniques that sustain and advance blockchain and internet security infrastructure and promote an open web.

To financially support further development of `bc-provenance-mark-ts` and other projects, please consider becoming a Patron of Blockchain Commons through ongoing monthly patronage as a [GitHub Sponsor](https://github.com/sponsors/BlockchainCommons). You can also support Blockchain Commons with bitcoins at our [BTCPay Server](https://btcpay.blockchaincommons.com/).

## Contributing

We encourage public contributions through issues and pull requests! Please review [CONTRIBUTING.md](./CONTRIBUTING.md) for details on our development process. All contributions to this repository require a GPG signed [Contributor License Agreement](./CLA.md).

### Discussions

The best place to talk about Blockchain Commons and its projects is in our GitHub Discussions areas.

[**Gordian Developer Community**](https://github.com/BlockchainCommons/Gordian-Developer-Community/discussions). For standards and open-source developers who want to talk about interoperable wallet specifications, please use the Discussions area of the [Gordian Developer Community repo](https://github.com/BlockchainCommons/Gordian-Developer-Community/discussions). This is where you talk about Gordian specifications such as [Gordian Envelope](https://github.com/BlockchainCommons/Gordian/tree/master/Envelope#articles), [bc-shamir](https://github.com/BlockchainCommons/bc-shamir), [Sharded Secret Key Reconstruction](https://github.com/BlockchainCommons/bc-sskr), and [bc-ur](https://github.com/BlockchainCommons/bc-ur) as well as the larger [Gordian Architecture](https://github.com/BlockchainCommons/Gordian/blob/master/Docs/Overview-Architecture.md), its [Principles](https://github.com/BlockchainCommons/Gordian#gordian-principles) of independence, privacy, resilience, and openness, and its macro-architectural ideas such as functional partition (including airgapping, the original name of this community).

[**Gordian User Community**](https://github.com/BlockchainCommons/Gordian/discussions). For users of the Gordian reference apps, including [Gordian Coordinator](https://github.com/BlockchainCommons/iOS-GordianCoordinator), [Gordian Seed Tool](https://github.com/BlockchainCommons/GordianSeedTool-iOS), [Gordian Server](https://github.com/BlockchainCommons/GordianServer-macOS), [Gordian Wallet](https://github.com/BlockchainCommons/GordianWallet-iOS), and [SpotBit](https://github.com/BlockchainCommons/spotbit) as well as our whole series of [CLI apps](https://github.com/BlockchainCommons/Gordian/blob/master/Docs/Overview-Apps.md#cli-apps). This is a place to talk about bug reports and feature requests as well as to explore how our reference apps embody the [Gordian Principles](https://github.com/BlockchainCommons/Gordian#gordian-principles).

[**Blockchain Commons Discussions**](https://github.com/BlockchainCommons/Community/discussions). For developers, interns, and patrons of Blockchain Commons, please use the discussions area of the [Community repo](https://github.com/BlockchainCommons/Community) to talk about general Blockchain Commons issues, the intern program, or topics other than those covered by the [Gordian Developer Community](https://github.com/BlockchainCommons/Gordian-Developer-Community/discussions) or the 
[Gordian User Community](https://github.com/BlockchainCommons/Gordian/discussions).

### Other Questions & Problems

As an open-source, open-development community, Blockchain Commons does not have the resources to provide direct support of our projects. Please consider the discussions area as a locale where you might get answers to questions. Alternatively, please use this repository's [issues](https://github.com/BlockchainCommons/bc-provenance-mark-ts/issues) feature. Unfortunately, we can not make any promises on response time.

If your company requires support to use our projects, please feel free to contact us directly about options. We may be able to offer you a contract for support from one of our contributors, or we might be able to point you to another entity who can offer the contractual support that you need.

### Credits

The following people directly contributed to this repository. You can add your name here by getting involved. The first step is learning how to contribute from our [CONTRIBUTING.md](./CONTRIBUTING.md) documentation.

| Name              | Role                | Github                                            | Email                                 | GPG Fingerprint                                    |
| ----------------- | ------------------- | ------------------------------------------------- | ------------------------------------- | -------------------------------------------------- |
| Christopher Allen | Principal Architect | [@ChristopherA](https://github.com/ChristopherA) | \<ChristopherA@LifeWithAlacrity.com\> | FDFE 14A5 4ECB 30FC 5D22  74EF F8D3 6C91 3574 05ED |
| Wolf McNally      | Lead Researcher/Engineer | [@wolfmcnally](https://github.com/wolfmcnally) | \<Wolf@WolfMcNally.com\> | 9436 52EE 3844 1760 C3DC  3536 4B6C 2FCF 8947 80AE |
| Leonardo Custodio | Software Engineer | [@leonardocustodio](https://github.com/leonardocustodio) | \<leonardo@snowpine.io\> | 59DA D997 67EF 3BAB 2B90 D057 5384 DEF3 B582 450D |

### Contributing Sponsor

**Blockchain Commons Provenance Marks for TypeScript** was produced as a collaboration between Blockchain Commons and one of our patrons, [Parity Technologies](https://parity.io): Parity wrote the wrappers based on Blockchain Commons' specifications and reference libraries. Blockchain Commons is dedicated to not just creating open infrastructure on our own, but also coordinating the work of other companies in benefiting the Commons. Thanks to Parity for working directly with us in this manner.

![](.github/assets/parity.svg)

## Responsible Disclosure

We want to keep all of our software safe for everyone. If you have discovered a security vulnerability, we appreciate your help in disclosing it to us in a responsible manner. We are unfortunately not able to offer bug bounties at this time.

We do ask that you offer us good faith and use best efforts not to leak information or harm any user, their data, or our developer community. Please give us a reasonable amount of time to fix the issue before you publish it. Do not defraud our users or us in the process of discovery. We promise not to bring legal action against researchers who point out a problem provided they do their best to follow the these guidelines.

### Reporting a Vulnerability

Please report suspected security vulnerabilities in private via email to ChristopherA@BlockchainCommons.com (do not use this email for support). Please do NOT create publicly viewable issues for suspected security vulnerabilities.

The following keys may be used to communicate sensitive information to developers:

| Name              | Fingerprint                                        |
| ----------------- | -------------------------------------------------- |
| Christopher Allen | FDFE 14A5 4ECB 30FC 5D22  74EF F8D3 6C91 3574 05ED |

You can import a key by running the following command with that individual’s fingerprint: `gpg --recv-keys "<fingerprint>"` Ensure that you put quotes around fingerprints that contain spaces.
