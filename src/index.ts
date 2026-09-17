/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * Provenance marks: chained, dated, cryptographically linked marks that
 * let a creator prove a sequence of works is theirs. A
 * `ProvenanceMarkGenerator` turns a seed into a chain of `ProvenanceMark`s;
 * `validate` checks a set of marks and reports what broke.
 */

export {
  ProvenanceMarkError,
  PROVENANCE_MARK_ERROR_CODES,
  type ProvenanceMarkErrorCode,
  type ProvenanceMarkErrorDetails,
  type ProvenanceMarkErrorDetailsByCode,
  type ProvenanceMarkErrorDetailsFor,
  type ProvenanceMarkErrorTyped,
  type ExpectedActualCode,
  type ReasonCode,
  type MessageCode,
  type SeedLengthDetails,
  type KeyDetails,
  type ExpectedActualDetails,
  type InvalidInfoCborDetails,
  type ReasonDetails,
  type MissingUrlParameterDetails,
  type YearOutOfRangeDetails,
  type InvalidMonthOrDayDetails,
  type MessageDetails,
  type ValidationDetails,
} from "./error.js";

export {
  type ProvenanceMarkResolution,
  PROVENANCE_MARK_RESOLUTIONS,
  isProvenanceMarkResolution,
  resolutionCode,
  resolutionFromCode,
  linkLength,
  seqBytesLength,
  dateBytesLength,
  fixedLength,
  serializeSeq,
  deserializeSeq,
} from "./resolution.js";

export {
  type DateInput,
  serializeDate,
  deserializeDate,
  expectDate,
  rangeOfDaysInMonth,
  type DayRange,
  dateToIso8601,
  dateFromIso8601,
  dateToDateString,
  dateToDisplay,
} from "./date.js";

export { parseSeed, parseDate } from "./parse.js";

export { extendKey, obfuscate } from "./crypto-utils.js";

export { ProvenanceSeed, PROVENANCE_SEED_LENGTH } from "./seed.js";
export { RngState, RNG_STATE_LENGTH } from "./rng-state.js";

export {
  ProvenanceMark,
  type ProvenanceMarkInput,
  type IdentifierOptions,
  type DisambiguatedIdentifierOptions,
  type ProvenanceMarkCodec,
} from "./mark.js";
export { MARK_ID_PREFIX } from "./mark-identifier.js";

export {
  ProvenanceMarkGenerator,
  type ProvenanceMarkGeneratorInput,
  type ProvenanceMarkGeneratorState,
} from "./generator.js";

export {
  type ValidationIssue,
  type ValidationReportFormat,
  type FlaggedMark,
  type SequenceReport,
  type ChainReport,
  type ValidationReport,
  formatValidationIssue,
  chainIdHex,
  hasIssues,
  formatReport,
  validate,
} from "./validate.js";

export { ProvenanceMarkInfo } from "./mark-info.js";

export { registerTags, registerTagsIn } from "./envelope.js";
