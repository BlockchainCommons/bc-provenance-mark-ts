/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The three date codecs (day, second and millisecond precision), the
 * strict date-string parser and the reference's date displays.
 */

import { CborDate, CborError } from "@blockchaincommons/dcbor";

import { ProvenanceMarkError } from "./error.js";
import { displayDate, displayDateOnly } from "./date-display.js";
import { type ProvenanceMarkResolution, dateBytesLength } from "./resolution.js";

/** 2001-01-01T00:00:00Z, the epoch of the 4- and 6-byte codecs. */
const REFERENCE_DATE = Date.UTC(2001, 0, 1, 0, 0, 0, 0);

/** The largest millisecond count the 6-byte codec carries. */
const MAX_6_BYTE_VALUE = 0xe5940a78a7ff;

/** The number of days in a month, in UTC. */
function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function isValidDay(year: number, month: number, day: number): boolean {
  if (day < 1) return false;
  return day <= daysInMonth(year, month);
}

/** What every date input accepts: a JS `Date`, or dcbor's `CborDate`. */
export type DateInput = Date | CborDate;

/**
 * The `Date` view of a date input: a `CborDate` to the millisecond, a
 * `Date` as is. Anything else, or a `Date` that holds no time, is
 * `InvalidDate`.
 */
export function expectDate(date: DateInput): Date {
  if (date instanceof CborDate) return date.toDate();
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    throw ProvenanceMarkError.invalidDate("Invalid date");
  }
  return date;
}

/** Two bytes: 7 bits of year from 2023, 4 of month, 5 of day. */
function encode2Bytes(date: Date): Uint8Array {
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const yy = year - 2023;
  if (yy < 0 || yy >= 128) throw ProvenanceMarkError.yearOutOfRange(year);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw ProvenanceMarkError.invalidMonthOrDay(year, month, day);
  }
  const value = (yy << 9) | (month << 5) | day;
  return new Uint8Array([(value >> 8) & 0xff, value & 0xff]);
}

function decode2Bytes(bytes: Uint8Array): Date {
  const value = (bytes[0] << 8) | bytes[1];
  const day = value & 0b11111;
  const month = (value >> 5) & 0b1111;
  const year = ((value >> 9) & 0b1111111) + 2023;
  if (month < 1 || month > 12 || !isValidDay(year, month, day)) {
    throw ProvenanceMarkError.invalidMonthOrDay(year, month, day);
  }
  return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
}

/**
 * Four bytes: seconds since 2001-01-01, truncated toward zero as the
 * reference's `num_seconds()` truncates, so an instant inside the second
 * before the epoch encodes as the epoch.
 */
function encode4Bytes(date: Date): Uint8Array {
  const seconds = Math.trunc((date.getTime() - REFERENCE_DATE) / 1000);
  if (seconds < 0 || seconds > 0xffffffff) {
    throw ProvenanceMarkError.dateOutOfRange("seconds value too large for u32");
  }
  return new Uint8Array([
    (seconds >> 24) & 0xff,
    (seconds >> 16) & 0xff,
    (seconds >> 8) & 0xff,
    seconds & 0xff,
  ]);
}

function decode4Bytes(bytes: Uint8Array): Date {
  const seconds = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return new Date(REFERENCE_DATE + seconds * 1000);
}

/** Six bytes: milliseconds since 2001-01-01. */
function encode6Bytes(date: Date): Uint8Array {
  const milliseconds = BigInt(date.getTime() - REFERENCE_DATE);
  if (milliseconds < 0n) {
    throw ProvenanceMarkError.dateOutOfRange("milliseconds value too large for u64");
  }
  if (milliseconds > BigInt(MAX_6_BYTE_VALUE)) {
    throw ProvenanceMarkError.dateOutOfRange("date exceeds maximum representable value");
  }
  const buf = new Uint8Array(6);
  for (let i = 0; i < 6; i++) buf[i] = Number((milliseconds >> BigInt(40 - 8 * i)) & 0xffn);
  return buf;
}

function decode6Bytes(bytes: Uint8Array): Date {
  let milliseconds = 0n;
  for (let i = 0; i < 6; i++) milliseconds = (milliseconds << 8n) | BigInt(bytes[i]);
  if (milliseconds > BigInt(MAX_6_BYTE_VALUE)) {
    throw ProvenanceMarkError.dateOutOfRange("date exceeds maximum representable value");
  }
  return new Date(REFERENCE_DATE + Number(milliseconds));
}

/**
 * The date as the resolution stores it: two bytes (day precision, years
 * 2023 to 2150) at low, four (second precision from 2001) at medium, six
 * (millisecond precision) at quartile and high. A `Date` or a `CborDate`;
 * a `Date` that holds no time is `InvalidDate`.
 */
export function serializeDate(res: ProvenanceMarkResolution, date: DateInput): Uint8Array {
  const value = expectDate(date);
  switch (dateBytesLength(res)) {
    case 2:
      return encode2Bytes(value);
    case 4:
      return encode4Bytes(value);
    default:
      return encode6Bytes(value);
  }
}

/** The date the bytes carry at the resolution; the length must match. */
export function deserializeDate(res: ProvenanceMarkResolution, bytes: Uint8Array): Date {
  const len = dateBytesLength(res);
  if (bytes.length !== len) {
    throw ProvenanceMarkError.resolution(
      `invalid date length: expected 2, 4, or 6 bytes, got ${bytes.length}`,
    );
  }
  switch (len) {
    case 2:
      return decode2Bytes(bytes);
    case 4:
      return decode4Bytes(bytes);
    default:
      return decode6Bytes(bytes);
  }
}

/** The valid days of a month, inclusive. */
export interface DayRange {
  /** The first day, 1. */
  min: number;
  /** The last day, 28 to 31. */
  max: number;
}

/** The valid days of a month, `min` to `max` inclusive. */
export function rangeOfDaysInMonth(year: number, month: number): DayRange {
  return { min: 1, max: daysInMonth(year, month) };
}

/** ISO 8601 with milliseconds, as `Date.toISOString`. */
export function dateToIso8601(date: DateInput): string {
  return expectDate(date).toISOString();
}

/**
 * The reference's `Date::from_string`: RFC 3339 with a zone (`Z` or an
 * offset; fractions kept to the millisecond), or a bare `YYYY-MM-DD` read
 * as UTC midnight, calendar-checked. Anything else (a time without a
 * zone, prose, an impossible date, an epoch number) is `InvalidDate`.
 */
export function dateFromIso8601(str: string): Date {
  let parsed: CborDate;
  try {
    parsed = CborDate.fromString(str);
  } catch (error) {
    if (CborError.isCborError(error)) throw ProvenanceMarkError.invalidDate(error.message, error);
    throw error;
  }
  return parsed.toDate();
}

/** `YYYY-MM-DD` in UTC. */
export function dateToDateString(date: DateInput): string {
  return displayDateOnly(expectDate(date));
}

/**
 * The reference's `Date` display: `YYYY-MM-DD` when the UTC time is
 * exactly midnight (subseconds ignored), else RFC 3339 at second
 * precision such as `2023-02-08T15:30:45Z`. Every date string this
 * package emits (debug strings, JSON, validation issues, summaries) is
 * this one.
 */
export function dateToDisplay(date: DateInput): string {
  return displayDate(expectDate(date));
}
