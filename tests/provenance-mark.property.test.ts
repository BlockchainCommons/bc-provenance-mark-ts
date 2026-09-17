/**
 * Properties: every encoding of a mark decodes to the same mark;
 * `precedes` holds along a chain and fails across chains; the date codecs
 * round-trip on the representable set; JSON and envelope round-trips.
 */
import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import {
  ProvenanceMark,
  ProvenanceMarkGenerator,
  type ProvenanceMarkResolution,
  ProvenanceSeed,
  serializeDate,
  deserializeDate,
} from "../src";

const RES: ProvenanceMarkResolution[] = ["low", "medium", "quartile", "high"];
const seedArb = fc.uint8Array({ minLength: 32, maxLength: 32 });
// the 2-byte day codec starts in 2023 and the codecs hold through this century
const dateArb = fc
  .integer({ min: 1_700_000_000, max: 4_000_000_000 })
  .map((s) => new Date(s * 1000));
const chainArb = fc.record({
  res: fc.constantFrom(...RES),
  seed: seedArb,
  start: dateArb,
  n: fc.integer({ min: 1, max: 6 }),
});

const marksOf = (
  res: ProvenanceMarkResolution,
  seed: Uint8Array,
  start: Date,
  n: number,
): ProvenanceMark[] => {
  const g = ProvenanceMarkGenerator.from({ res: res, seed: ProvenanceSeed.from(seed) });
  return Array.from({ length: n }, (_, i) => g.next(new Date(start.getTime() + i * 86_400_000)));
};

describe("properties", () => {
  it("every encoding round-trips", () => {
    fc.assert(
      fc.property(chainArb, ({ res, seed, start, n }) => {
        for (const m of marksOf(res, seed, start, n)) {
          expect(ProvenanceMark.fromMessage(res, m.message).equals(m)).toBe(true);
          expect(ProvenanceMark.fromCborData(m.toCbor().toData()).equals(m)).toBe(true);
          expect(ProvenanceMark.fromBytewords(res, m.toBytewords()).equals(m)).toBe(true);
          expect(ProvenanceMark.fromUrlEncoding(m.toUrlEncoding()).equals(m)).toBe(true);
          expect(ProvenanceMark.fromJSON(m.toJSON()).equals(m)).toBe(true);
          expect(ProvenanceMark.fromEnvelope(m.toEnvelope()).equals(m)).toBe(true);
        }
      }),
      { numRuns: 60 },
    );
  });

  it("precedes holds along a chain and fails across chains", () => {
    fc.assert(
      fc.property(chainArb, seedArb, ({ res, seed, start, n }, other) => {
        const marks = marksOf(res, seed, start, n);
        for (let i = 1; i < marks.length; i++) expect(marks[i - 1].precedes(marks[i])).toBe(true);
        expect(ProvenanceMark.isSequenceValid(marks)).toBe(marks.length >= 2);
        if (marks.length >= 2) expect(marks[1].precedes(marks[0])).toBe(false);
        const foreign = marksOf(res, other, start, 2);
        expect(marks[0].precedes(foreign[1])).toBe(false);
      }),
      { numRuns: 40 },
    );
  });

  it("date codecs round-trip on the representable set", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...RES),
        fc.integer({ min: 1_700_000_000, max: 4_000_000_000 }),
        (res, secs) => {
          const d = new Date(secs * 1000);
          const bytes = serializeDate(res, d);
          const back = deserializeDate(res, bytes);
          expect(serializeDate(res, back)).toEqual(bytes);
          expect(back.getTime()).toBeLessThanOrEqual(d.getTime());
        },
      ),
      { numRuns: 100 },
    );
  });
});

describe("key guards", () => {
  it("rejects every non-Uint8Array key, next key and chain id with a TypeError", () => {
    const notBytes = fc.oneof(
      fc.string(),
      fc.integer(),
      fc.array(fc.integer({ min: 0, max: 255 }), { maxLength: 8 }),
      fc.constant(null),
      fc.constant(undefined),
      fc.record({ length: fc.integer({ min: 0, max: 8 }) }),
    );
    fc.assert(
      fc.property(notBytes, fc.integer({ min: 0, max: 2 }), (bad, slot) => {
        const good = new Uint8Array(4);
        const fields = [good, good, good] as unknown[];
        fields[slot] = bad;
        expect(() =>
          ProvenanceMark.from({
            res: "low",
            key: fields[0] as Uint8Array,
            nextKey: fields[1] as Uint8Array,
            chainId: fields[2] as Uint8Array,
            seq: 0,
            date: new Date("2023-06-20T12:00:00Z"),
          }),
        ).toThrow(TypeError);
      }),
    );
  });
});
