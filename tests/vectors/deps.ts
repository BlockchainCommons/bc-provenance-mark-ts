/** The siblings the adapters drive: the working tree's, or the frozen bundle's inlined ones. */
import { UR } from "@blockchaincommons/uniform-resources";
import { cbor, decodeCbor } from "@blockchaincommons/dcbor";
import { format } from "@blockchaincommons/envelope/format";
import { type SiblingDeps, unhex } from "./recipes";

export const currentDeps: SiblingDeps = {
  styles: { standard: "standard", uri: "uri", minimal: "minimal" },
  cborText: (s) => cbor(s),
  cborFromHex: (h) => decodeCbor(unhex(h)),
  cborBytes: (bytes) => cbor(bytes),
  formatEnvelope: (e) => format(e),
  addAssertion: (e, predicate, object) => e.addAssertion(predicate, object),
  parseUR: (s) => UR.parse(s),
};

export async function baselineDeps(): Promise<SiblingDeps> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const m: any = await import("../baseline/provenance-mark-baseline.mjs");
  return {
    styles: {
      standard: m.BytewordsStyle.Standard,
      uri: m.BytewordsStyle.Uri,
      minimal: m.BytewordsStyle.Minimal,
    },
    cborText: (s) => m.baselineCbor(s),
    cborFromHex: () => {
      throw new Error("baseline: the bundle exports no CBOR decoder");
    },
    cborBytes: (bytes) => m.baselineCbor(bytes),
    formatEnvelope: (e) => e.format(),
    addAssertion: (e, predicate, object) => e.addAssertion(predicate, object),
  };
}
