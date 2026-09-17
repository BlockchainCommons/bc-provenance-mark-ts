/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * The reference's `Date` display over a valid `Date`; pure, so the modules
 * that render dates need no error type.
 */

/** `YYYY-MM-DD` in UTC. */
export function displayDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const day = date.getUTCDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * `YYYY-MM-DD` when the UTC time is exactly midnight (subseconds ignored),
 * else RFC 3339 at second precision such as `2023-02-08T15:30:45Z`.
 */
export function displayDate(date: Date): string {
  const hasTime =
    date.getUTCHours() !== 0 || date.getUTCMinutes() !== 0 || date.getUTCSeconds() !== 0;
  if (!hasTime) return displayDateOnly(date);
  return date.toISOString().replace(/\.\d{3}Z$/, "Z");
}
