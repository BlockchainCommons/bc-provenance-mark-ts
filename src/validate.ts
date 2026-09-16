/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * Validation of a set of marks: bins them by chain, sorts by sequence,
 * splits each chain into the runs that verify, and reports what broke.
 */

import { bytesToHex, hexToBytes } from "@blockchaincommons/dcbor";

import { ProvenanceMark } from "./mark.js";
import { ProvenanceMarkError } from "./error.js";
import { type ValidationIssue } from "./validation-issue.js";

export { type ValidationIssue, formatValidationIssue } from "./validation-issue.js";

/** How `formatReport` renders: prose, one-line JSON, or indented JSON. */
export type ValidationReportFormat = "text" | "jsonCompact" | "jsonPretty";

/** What `formatReport` takes besides the report. */
export interface FormatReportOptions {
  /** `text` unless given. */
  format?: ValidationReportFormat | undefined;
}

/** A mark with the issues found where it joins its predecessor. */
export interface FlaggedMark {
  /** The mark. */
  readonly mark: ProvenanceMark;
  /** Why it does not follow its predecessor; empty when it does. */
  readonly issues: readonly ValidationIssue[];
}

/** A run of marks that verify against one another. */
export interface SequenceReport {
  /** The first mark's sequence number. */
  readonly startSeq: number;
  /** The last mark's sequence number. */
  readonly endSeq: number;
  /** The marks, in sequence order. */
  readonly marks: readonly FlaggedMark[];
}

/** Every mark sharing one chain id. */
export interface ChainReport {
  /** The chain id. */
  readonly chainId: Uint8Array;
  /** Whether the chain's first mark is its genesis. */
  readonly hasGenesis: boolean;
  /** The marks, sorted by sequence number. */
  readonly marks: readonly ProvenanceMark[];
  /** The runs the chain splits into where a mark fails to follow. */
  readonly sequences: readonly SequenceReport[];
}

/** What `validate` returns. Frozen. */
export interface ValidationReport {
  /** The input without exact duplicates. */
  readonly marks: readonly ProvenanceMark[];
  /** Sorted by chain id. */
  readonly chains: readonly ChainReport[];
}

/** The chain id as hex. */
export function chainIdHex(report: ChainReport): string {
  return bytesToHex(report.chainId);
}

/**
 * Whether anything is wrong: a chain without genesis, a flagged mark, more
 * than one chain, or a chain in more than one sequence.
 */
export function hasIssues(report: ValidationReport): boolean {
  for (const chain of report.chains) if (!chain.hasGenesis) return true;
  for (const chain of report.chains) {
    for (const seq of chain.sequences) {
      for (const mark of seq.marks) if (mark.issues.length > 0) return true;
    }
  }
  if (report.chains.length > 1) return true;
  if (report.chains.length === 1 && report.chains[0].sequences.length > 1) return true;
  return false;
}

/** Nothing to say about an empty report or one perfect chain. */
function isInteresting(report: ValidationReport): boolean {
  if (report.chains.length === 0) return false;
  for (const chain of report.chains) if (!chain.hasGenesis) return true;
  if (report.chains.length === 1) {
    const chain = report.chains[0];
    if (
      chain.sequences.length === 1 &&
      chain.sequences[0].marks.every((m) => m.issues.length === 0)
    )
      return false;
  }
  return true;
}

function issueAnnotation(issue: ValidationIssue): string {
  switch (issue.type) {
    case "SequenceGap":
      return `gap: ${issue.expected} missing`;
    case "DateOrdering":
      return `date ${issue.previous} < ${issue.next}`;
    case "HashMismatch":
      return "hash mismatch";
    case "KeyMismatch":
      return "key mismatch";
    case "NonGenesisAtZero":
      return "non-genesis at seq 0";
    case "InvalidGenesisKey":
      return "invalid genesis key";
  }
}

function formatText(report: ValidationReport): string {
  if (!isInteresting(report)) return "";
  const lines: string[] = [];
  lines.push(`Total marks: ${report.marks.length}`);
  lines.push(`Chains: ${report.chains.length}`);
  lines.push("");
  for (let chainIdx = 0; chainIdx < report.chains.length; chainIdx++) {
    const chain = report.chains[chainIdx];
    const chainIdStr = chainIdHex(chain);
    const shortChainId = chainIdStr.length > 8 ? chainIdStr.slice(0, 8) : chainIdStr;
    lines.push(`Chain ${chainIdx + 1}: ${shortChainId}`);
    if (!chain.hasGenesis) lines.push("  Warning: No genesis mark found");
    for (const seq of chain.sequences) {
      for (const flaggedMark of seq.marks) {
        const mark = flaggedMark.mark;
        const shortId = mark.idHex.slice(0, 8);
        const annotations: string[] = [];
        if (mark.isGenesis) annotations.push("genesis mark");
        for (const issue of flaggedMark.issues) annotations.push(issueAnnotation(issue));
        lines.push(
          annotations.length === 0
            ? `  ${mark.seq}: ${shortId}`
            : `  ${mark.seq}: ${shortId} (${annotations.join(", ")})`,
        );
      }
    }
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}

/**
 * The reference's serde shape: issues are `{ type, data }` with `data`
 * only for the variants that carry fields.
 */
function issueToJSON(issue: ValidationIssue): unknown {
  switch (issue.type) {
    case "HashMismatch":
      return { type: "HashMismatch", data: { expected: issue.expected, actual: issue.actual } };
    case "SequenceGap":
      return { type: "SequenceGap", data: { expected: issue.expected, actual: issue.actual } };
    case "DateOrdering":
      return { type: "DateOrdering", data: { previous: issue.previous, next: issue.next } };
    case "KeyMismatch":
    case "NonGenesisAtZero":
    case "InvalidGenesisKey":
      return { type: issue.type };
  }
}

function reportToJSON(report: ValidationReport): unknown {
  return {
    marks: report.marks.map((m) => m.toUR().toString()),
    chains: report.chains.map((chain) => ({
      chain_id: bytesToHex(chain.chainId),
      has_genesis: chain.hasGenesis,
      marks: chain.marks.map((m) => m.toUR().toString()),
      sequences: chain.sequences.map((seq) => ({
        start_seq: seq.startSeq,
        end_seq: seq.endSeq,
        marks: seq.marks.map((fm) => ({
          mark: fm.mark.toUR().toString(),
          issues: fm.issues.map(issueToJSON),
        })),
      })),
    })),
  };
}

/**
 * The report as text (empty when there is nothing to report) or JSON. A
 * format that is not one of the three is a `RangeError`.
 */
export function formatReport(
  report: ValidationReport,
  { format = "text" }: FormatReportOptions = {},
): string {
  switch (format) {
    case "text":
      return formatText(report);
    case "jsonCompact":
      return JSON.stringify(reportToJSON(report));
    case "jsonPretty":
      return JSON.stringify(reportToJSON(report), null, 2);
    default:
      throw new RangeError(
        `format must be "text", "jsonCompact" or "jsonPretty", got ${JSON.stringify(format)}`,
      );
  }
}

function createSequenceReport(marks: FlaggedMark[]): SequenceReport {
  const startSeq = marks.length > 0 ? marks[0].mark.seq : 0;
  const endSeq = marks.length > 0 ? marks[marks.length - 1].mark.seq : 0;
  return Object.freeze({ startSeq, endSeq, marks: Object.freeze(marks) });
}

function flagged(mark: ProvenanceMark, issues: ValidationIssue[]): FlaggedMark {
  return Object.freeze({ mark, issues: Object.freeze(issues) });
}

/** Splits a sorted chain where a mark fails to follow its predecessor. */
function buildSequenceBins(marks: ProvenanceMark[]): SequenceReport[] {
  const sequences: SequenceReport[] = [];
  let currentSequence: FlaggedMark[] = [];
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (i === 0) {
      currentSequence.push(flagged(mark, []));
      continue;
    }
    try {
      marks[i - 1].checkPrecedes(mark);
      currentSequence.push(flagged(mark, []));
    } catch (e) {
      if (currentSequence.length > 0) sequences.push(createSequenceReport(currentSequence));
      // Anything but a validation issue counts as a key mismatch, as in the reference.
      const issue: ValidationIssue =
        ProvenanceMarkError.isProvenanceMarkError(e) && e.is("Validation")
          ? e.details.issue
          : { type: "KeyMismatch" };
      currentSequence = [flagged(mark, [issue])];
    }
  }
  if (currentSequence.length > 0) sequences.push(createSequenceReport(currentSequence));
  return sequences;
}

/**
 * Validates a set of marks: drops exact duplicates, bins by chain id,
 * sorts each chain by sequence, splits it into verifying runs, and orders
 * the chains by id.
 */
export function validate(marks: readonly ProvenanceMark[]): ValidationReport {
  const input: unknown = marks;
  if (!Array.isArray(input)) throw new TypeError("marks must be an array of ProvenanceMark");
  (input as readonly unknown[]).forEach((m, i) => {
    if (!(m instanceof ProvenanceMark)) throw new TypeError(`marks[${i}] must be a ProvenanceMark`);
  });
  const seen = new Set<string>();
  const deduplicatedMarks: ProvenanceMark[] = [];
  for (const mark of marks) {
    const key = `${mark.res}:${bytesToHex(mark.message)}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduplicatedMarks.push(mark);
    }
  }
  const chainBins = new Map<string, ProvenanceMark[]>();
  for (const mark of deduplicatedMarks) {
    const chainIdKey = bytesToHex(mark.chainId);
    const bin = chainBins.get(chainIdKey);
    if (bin !== undefined) bin.push(mark);
    else chainBins.set(chainIdKey, [mark]);
  }
  const chains: ChainReport[] = [];
  for (const [chainIdKey, chainMarks] of chainBins) {
    chainMarks.sort((a, b) => a.seq - b.seq);
    const hasGenesis = chainMarks.length > 0 && chainMarks[0].seq === 0 && chainMarks[0].isGenesis;
    chains.push(
      Object.freeze({
        chainId: hexToBytes(chainIdKey),
        hasGenesis,
        marks: Object.freeze(chainMarks),
        sequences: Object.freeze(buildSequenceBins(chainMarks)),
      }),
    );
  }
  // Bytewise chain-id order, as the reference sorts (hex compares the same way).
  chains.sort((a, b) => {
    const aHex = bytesToHex(a.chainId);
    const bHex = bytesToHex(b.chainId);
    return aHex < bHex ? -1 : aHex > bHex ? 1 : 0;
  });
  return Object.freeze({ marks: Object.freeze(deduplicatedMarks), chains: Object.freeze(chains) });
}
