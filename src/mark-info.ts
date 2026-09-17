/**
 * Copyright © 2023-2026 Blockchain Commons, LLC
 *
 * A mark with its renderings, for display.
 */

import { UR, URError } from "@blockchaincommons/uniform-resources";

import { ProvenanceMark } from "./mark.js";
import { ProvenanceMarkError } from "./error.js";
import { dateToDisplay } from "./date.js";
import { expectObject, optionalStringField, stringField } from "./json.js";

/** A mark with its UR and identifiers rendered once, plus a comment, for display. Frozen. */
export class ProvenanceMarkInfo {
  private readonly _mark: ProvenanceMark;
  private readonly _ur: UR;
  private readonly _bytewords: string;
  private readonly _bytemoji: string;
  private readonly _comment: string;

  private constructor(
    mark: ProvenanceMark,
    ur: UR,
    bytewords: string,
    bytemoji: string,
    comment: string,
  ) {
    this._mark = mark;
    this._ur = ur;
    this._bytewords = bytewords;
    this._bytemoji = bytemoji;
    this._comment = comment;
    Object.freeze(this);
  }

  /**
   * The mark's UR and its 🅟-prefixed four-word identifiers, with free
   * text to show alongside (empty unless given).
   */
  static from(mark: ProvenanceMark, comment = ""): ProvenanceMarkInfo {
    if (!(mark instanceof ProvenanceMark)) throw new TypeError("mark must be a ProvenanceMark");
    if (typeof comment !== "string") throw new TypeError("comment must be a string");
    return new ProvenanceMarkInfo(
      mark,
      mark.toUR(),
      mark.idBytewords({ prefix: true }),
      mark.idBytemoji({ prefix: true }),
      comment,
    );
  }

  /** The mark. */
  get mark(): ProvenanceMark {
    return this._mark;
  }

  /** The mark's UR. */
  get ur(): UR {
    return this._ur;
  }

  /** The 🅟-prefixed bytewords identifier. */
  get bytewords(): string {
    return this._bytewords;
  }

  /** The 🅟-prefixed bytemoji identifier. */
  get bytemoji(): string {
    return this._bytemoji;
  }

  /** The comment, possibly empty. */
  get comment(): string {
    return this._comment;
  }

  /** A Markdown block: rule, date, the UR and bytewords as headings, the bytemoji, the comment. */
  markdownSummary(): string {
    const lines: string[] = ["---", "", dateToDisplay(this._mark.date)];
    lines.push("", `#### ${this._ur.toString()}`);
    lines.push("", `#### \`${this._bytewords}\``);
    lines.push("", this._bytemoji, "");
    if (this._comment.length > 0) lines.push(this._comment, "");
    return lines.join("\n");
  }

  /** `ur, bytewords, bytemoji[, comment], mark`, as the reference serialises. */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      ur: this._ur.toString(),
      bytewords: this._bytewords,
      bytemoji: this._bytemoji,
    };
    if (this._comment.length > 0) result["comment"] = this._comment;
    result["mark"] = this._mark.toJSON();
    return result;
  }

  /**
   * The JSON shape, read strictly: `ur`, `bytewords` and `bytemoji`
   * required strings, `comment` optional, the mark taken from the UR.
   * Any fault is `Json`.
   */
  static fromJSON(json: unknown): ProvenanceMarkInfo {
    const obj = expectObject(json);
    const urText = stringField(obj, "ur");
    const bytewords = stringField(obj, "bytewords");
    const bytemoji = stringField(obj, "bytemoji");
    const commentValue = optionalStringField(obj, "comment");
    let mark: ProvenanceMark;
    try {
      mark = ProvenanceMark.fromUR(UR.parse(urText));
    } catch (error) {
      if (URError.isURError(error) || ProvenanceMarkError.isProvenanceMarkError(error)) {
        throw ProvenanceMarkError.json(error.message, error);
      }
      throw error;
    }
    return new ProvenanceMarkInfo(mark, mark.toUR(), bytewords, bytemoji, commentValue ?? "");
  }
}
