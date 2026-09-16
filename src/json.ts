/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * Reading persisted JSON the way the reference's serde types read it:
 * every fault is `Json` with serde's wording (`missing field \`x\``,
 * `invalid type: string "0", expected u32`, `invalid value: integer
 * \`-1\`, expected u32`, …). Internal.
 */

import { ProvenanceMarkError } from "./error.js";
import { Base64DecodeError, fromBase64 } from "./utils.js";

/** A JSON object, as `JSON.parse` yields it. */
export type JsonObject = Record<string, unknown>;

/** `value` as a JSON object, else `Json` naming what it was. */
export function expectObject(value: unknown): JsonObject {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    return value as JsonObject;
  }
  throw ProvenanceMarkError.json(`invalid type: ${unexpected(value)}, expected struct`);
}

/** serde's description of an unexpected JSON value. */
function unexpected(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return `boolean \`${String(value)}\``;
  if (typeof value === "number") {
    return Number.isInteger(value)
      ? `integer \`${String(value)}\``
      : `floating point \`${String(value)}\``;
  }
  if (typeof value === "string") return `string ${JSON.stringify(value)}`;
  if (Array.isArray(value)) return "sequence";
  if (typeof value === "object") return "map";
  return "unit value";
}

/** The field, else `Json` (`missing field \`name\``). */
export function field(json: JsonObject, name: string): unknown {
  const value = json[name];
  if (value === undefined) throw ProvenanceMarkError.json(`missing field \`${name}\``);
  return value;
}

/** A field that must be a string. */
export function stringField(json: JsonObject, name: string): string {
  const value = field(json, name);
  if (typeof value !== "string") {
    throw ProvenanceMarkError.json(`invalid type: ${unexpected(value)}, expected a string`);
  }
  return value;
}

/** A field that must be an unsigned integer of `bits` bits (`u8`, `u32`). */
export function unsignedField(json: JsonObject, name: string, bits: 8 | 32): number {
  const value = field(json, name);
  const type = `u${bits}`;
  if (typeof value !== "number") {
    throw ProvenanceMarkError.json(`invalid type: ${unexpected(value)}, expected ${type}`);
  }
  if (!Number.isInteger(value)) {
    throw ProvenanceMarkError.json(`invalid type: ${unexpected(value)}, expected ${type}`);
  }
  if (value < 0 || value > 2 ** bits - 1) {
    throw ProvenanceMarkError.json(`invalid value: integer \`${String(value)}\`, expected ${type}`);
  }
  return value;
}

/** A field that must be base64 text; a decode failure is `Json` with the base64 crate's wording. */
export function base64Field(json: JsonObject, name: string): Uint8Array {
  return decodeBase64Json(stringField(json, name));
}

/** Base64 text under serde: a decode failure is `Json` with the base64 crate's wording. */
export function decodeBase64Json(text: string): Uint8Array {
  try {
    return fromBase64(text);
  } catch (error) {
    if (error instanceof Base64DecodeError) throw ProvenanceMarkError.json(error.message, error);
    throw error;
  }
}

/** A `Json` error carrying another error's message, as serde's `Error::custom` does. */
export function customJson(error: unknown): ProvenanceMarkError {
  return ProvenanceMarkError.json(error instanceof Error ? error.message : String(error), error);
}
