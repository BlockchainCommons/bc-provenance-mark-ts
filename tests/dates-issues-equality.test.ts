/**
 * `Date | CborDate` at every date input, validation issues carrying bytes
 * and dates (rendered at the edge), and generator equality.
 */
import { describe, expect, it } from "vitest";
import { CborDate } from "@blockchaincommons/dcbor";
import {
  ProvenanceMark,
  ProvenanceMarkError,
  ProvenanceMarkGenerator,
  ProvenanceMarkInfo,
  dateToDisplay,
  serializeDate,
  expectDate,
  formatReport,
  formatValidationIssue,
  validate,
} from "../src";

const ISO = "2023-06-20T12:00:00Z";

describe("dates in", () => {
  it("accepts a CborDate wherever a Date goes", () => {
    const cborDate = CborDate.fromString(ISO);
    expect(expectDate(cborDate).toISOString()).toBe("2023-06-20T12:00:00.000Z");
    expect(serializeDate("medium", cborDate)).toEqual(serializeDate("medium", new Date(ISO)));
    const a = ProvenanceMarkGenerator.fromPassphrase("high", "Wolf").next(cborDate);
    const b = ProvenanceMarkGenerator.fromPassphrase("high", "Wolf").next(new Date(ISO));
    expect(a.equals(b)).toBe(true);
    const rebuilt = ProvenanceMark.from({
      res: "high",
      key: a.key,
      nextKey: new Uint8Array(32),
      chainId: a.chainId,
      seq: 0,
      date: cborDate,
    });
    expect(rebuilt.date.toISOString()).toBe("2023-06-20T12:00:00.000Z");
    expect(dateToDisplay(cborDate)).toBe("2023-06-20T12:00:00Z");
    expect(ProvenanceMarkInfo.from(a).markdownSummary()).toContain("2023-06-20T12:00:00Z");
  });

  it("rejects anything else with InvalidDate", () => {
    for (const bad of [new Date(NaN), "2023-06-20", 1_687_262_400_000, null, undefined]) {
      expect(() => expectDate(bad as unknown as Date)).toThrow(ProvenanceMarkError);
      expect(() => expectDate(bad as unknown as Date)).toThrow("invalid date: Invalid date");
    }
  });
});

describe("validation issues carry values", () => {
  const chain = (): ProvenanceMark[] => {
    const g = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
    return [0, 1, 2].map((i) => g.next(new Date(Date.UTC(2023, 5, 20 + i, 12))));
  };

  it("HashMismatch holds the hashes as bytes and renders hex", () => {
    const [first, second] = chain();
    const other = ProvenanceMarkGenerator.fromPassphrase("low", "Other").next(second.date);
    try {
      first.checkPrecedes(
        ProvenanceMark.from({
          res: "low",
          key: other.key,
          nextKey: other.key,
          chainId: first.chainId,
          seq: 1,
          date: second.date,
        }),
      );
      expect.unreachable("expected a Validation error");
    } catch (e) {
      if (!(ProvenanceMarkError.isProvenanceMarkError(e) && e.is("Validation"))) throw e;
      const issue = e.details.issue;
      expect(issue.type).toBe("HashMismatch");
      if (issue.type !== "HashMismatch") return;
      expect(issue.actual).toEqual(first.hash);
      expect(issue.expected).toBeInstanceOf(Uint8Array);
      expect(issue.expected.length).toBe(4);
      expect(formatValidationIssue(issue)).toBe(
        `hash mismatch: expected ${Buffer.from(issue.expected).toString("hex")}, got ${Buffer.from(first.hash).toString("hex")}`,
      );
    }
  });

  it("DateOrdering holds the dates and renders the reference's display", () => {
    const marks = chain();
    const later = ProvenanceMark.from({
      res: "low",
      key: marks[1].key,
      nextKey: marks[2].key,
      chainId: marks[0].chainId,
      seq: 1,
      date: new Date(Date.UTC(2023, 5, 19)),
    });
    try {
      marks[0].checkPrecedes(later);
      expect.unreachable("expected a Validation error");
    } catch (e) {
      if (!(ProvenanceMarkError.isProvenanceMarkError(e) && e.is("Validation"))) throw e;
      const issue = e.details.issue;
      expect(issue.type).toBe("DateOrdering");
      if (issue.type !== "DateOrdering") return;
      expect(issue.previous).toBeInstanceOf(Date);
      expect(issue.next.toISOString()).toBe("2023-06-19T00:00:00.000Z");
      expect(formatValidationIssue(issue)).toBe(
        "date must be equal or later: previous is 2023-06-20, next is 2023-06-19",
      );
      const report = validate([marks[0], later]);
      expect(formatReport(report, "jsonCompact")).toContain(
        '{"type":"DateOrdering","data":{"previous":"2023-06-20","next":"2023-06-19"}}',
      );
      expect(formatReport(report)).toContain("date 2023-06-20 < 2023-06-19");
    }
  });
});

describe("generator equality", () => {
  it("compares every field and rejects a non-generator", () => {
    const a = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
    const b = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf");
    expect(a.equals(b)).toBe(true);
    b.next(new Date(ISO));
    expect(a.equals(b)).toBe(false);
    a.next(new Date(ISO));
    expect(a.equals(b)).toBe(true);
    expect(a.equals(ProvenanceMarkGenerator.fromPassphrase("high", "Wolf"))).toBe(false);
    expect(a.equals(ProvenanceMarkGenerator.fromJSON(a.toJSON()))).toBe(true);
    expect(() => a.equals({} as ProvenanceMarkGenerator)).toThrow(TypeError);
  });
});
