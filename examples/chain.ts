/**
 * A chain of three marks from a seeded generator: every encoding of a mark,
 * a validation report, a URL round trip, and an error with its code.
 *
 *   bun examples/chain.ts
 */
import {
  ProvenanceMark,
  ProvenanceMarkError,
  ProvenanceMarkGenerator,
  ProvenanceSeed,
  formatReport,
  registerTags,
  validate,
} from "@blockchaincommons/provenance-mark";
import { format } from "@blockchaincommons/envelope/format";

// Marks inside envelopes print as `ProvenanceMark(<id>)` once the tags are registered.
registerTags();

// A seed is 32 bytes; a passphrase derives one through HKDF.
const seed = ProvenanceSeed.from(Uint8Array.from({ length: 32 }, (_, i) => i));
const generator = ProvenanceMarkGenerator.from({ res: "medium", seed });

// Three marks: the genesis carries no info, the others a text and a map.
const genesis = generator.next(new Date("2023-06-20T12:00:00Z"));
const second = generator.next(new Date("2023-06-21T12:00:00Z"), "second work");
const third = generator.next(
  new Date("2023-06-22T12:00:00Z"),
  new Map([
    ["title", "third work"],
    ["pages", 12],
  ]),
);

for (const mark of [genesis, second, third]) {
  console.log(mark.toDebugString());
  console.log("  identifier:", mark.idBytewords({ prefix: true }));
  console.log("  bytemoji:  ", mark.idBytemoji());
  console.log("  bytewords: ", mark.toBytewords());
  console.log("  ur:        ", mark.toUR().toString());
  console.log("  cbor:      ", mark.toCbor().toString());
  console.log("  json:      ", JSON.stringify(mark.toJSON()));
  console.log("  envelope:  ", format(mark.toEnvelope()));
}

// Each mark commits to the next one's key.
console.log("genesis precedes second:", genesis.precedes(second));
console.log("second precedes third:  ", second.precedes(third));
console.log("chain valid:            ", ProvenanceMark.isSequenceValid([genesis, second, third]));

// A report over the chain with the second mark missing: one gap.
const report = validate([genesis, third]);
console.log(formatReport(report));

// The URL form: the mark travels as the `provenance` query parameter.
const url = second.toUrl("https://example.com/work");
console.log(url.toString());
console.log("round trip:", ProvenanceMark.fromUrl(url).equals(second));

// The generator persists between marks as JSON or as an envelope.
const restored = ProvenanceMarkGenerator.fromJSON(JSON.parse(JSON.stringify(generator)));
console.log("restored next seq:", restored.nextSeq);

// Every failure is a ProvenanceMarkError with a code and typed details.
try {
  ProvenanceMark.fromBytewords("medium", "not bytewords");
} catch (error) {
  if (ProvenanceMarkError.isProvenanceMarkError(error) && error.is("Bytewords")) {
    console.log("rejected:", error.code, "-", error.details.message);
  }
}
