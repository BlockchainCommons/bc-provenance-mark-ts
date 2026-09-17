/**
 * Differential harness: every corpus recipe is run with the frozen
 * baseline bundle AND the working tree; every encoding, decode outcome,
 * report and date codec must be identical outside the enumerated
 * tombstones.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";
import * as baselineMod from "./baseline/provenance-mark-baseline.mjs";
import * as src from "../src";
import { materialize, recipeName, isBaselineSupported, type Recipe } from "./vectors/recipes";
import { baselineAdapterFor } from "./vectors/baseline-adapter";
import { workingTreeAdapterFor } from "./vectors/working-tree-adapter";
import { baselineDeps, currentDeps } from "./vectors/deps";
import { materializedFrom } from "./vectors/materialized";
import { categories } from "./corpus/corpus";

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_SHA256 = readFileSync(join(here, "baseline/README.md"), "utf8").match(
  /Baseline sha256: ([0-9a-f]{64})/,
)?.[1];

/**
 * The frozen bundle renders a rejection as `throw:<code>|<message>` with
 * its own code names; the working tree as `throw:<Code>[<inner>]|<message>`
 * with the reference's variant names, which dropped the `Error` suffix
 * from the wrapping codes. Both reduce to `throw:<code>` for the
 * comparison, so only the code is compared.
 */
export const normalizeCode = (s: string): string =>
  s.replace(
    /throw:([A-Za-z0-9_]+)(?:\[[A-Za-z]+\])?(?:\|[^\n]*)?/g,
    (_m, code: string) =>
      `throw:${code.replace(/^(Bytewords|Cbor|Url|Base64|Json|Envelope|Validation|IntegerConversion)Error$/, "$1")}`,
  );

/** Every differing line of `a` and `b` (same line count) satisfies `pred`. */
const differingLines = (a: string, b: string, pred: (x: string, y: string) => boolean): boolean => {
  const [x, y] = [a.split("\n"), b.split("\n")];
  if (x.length !== y.length) return false;
  let differ = false;
  for (let i = 0; i < x.length; i++) {
    if (x[i] === y[i]) continue;
    differ = true;
    if (!pred(x[i], y[i])) return false;
  }
  return differ;
};
const throws = /^throw:[A-Za-z_]+$/;
/** The frozen bundle's sibling error class names and engine errors. */
const foreign =
  /^throw:(?:[A-Za-z]+Error|Error|TypeError|RangeError|Decoder|Bytewords|Custom|UnexpectedType|ERR_INVALID_URL)$/;

/** Tombstones: the only allowed differences. */
const TOMBSTONES: {
  id: string;
  /** `false` until the change lands: the rows must still agree with the baseline. */
  landed?: boolean;
  matches: (r: Recipe, baselineOutcome: string, currentOutcome: string) => boolean;
}[] = [
  {
    // The uniform-resources package now reports an invalid byteword the way
    // the reference's `UR::from_ur_string` does: the `ur` crate's decoder
    // error, where the frozen bundle inlined a version that reported a
    // bytewords error; the working tree's `fromUR` then wraps it as `Cbor`.
    id: "T1 UR grammar errors",
    matches: (r, a, b) =>
      r.k === "decode" &&
      r.form === "ur" &&
      /^throw:Bytewords/.test(a) &&
      /^throw:(?:Decoder|Cbor)$/.test(b),
  },
  {
    // Date strings are parsed strictly (RFC 3339 with a zone, or a bare
    // date): the frozen bundle read them with `new Date`, accepting a
    // zoneless time as local, prose, an impossible calendar date and
    // failing with an engine `RangeError` on what it could not read; the
    // working tree rejects them all with `InvalidDate`.
    id: "T2 strict date strings",
    matches: (r, a, b) =>
      ((r.k === "json" || r.k === "parse" || r.k === "date") &&
        /^throw:InvalidDate$/.test(b) &&
        (!a.startsWith("throw:") ||
          /^throw:(?:RangeError|InvalidDate|YearOutOfRange|InvalidMonthOrDay)$/.test(a))) ||
      // A bare date without zero padding is UTC midnight, as the reference
      // reads it; the frozen bundle's `new Date` read it as local midnight.
      (r.k === "parse" &&
        /^\d{4}-\d{1,2}-\d{1,2}$/.test(r.date) &&
        b === r.date.replace(/-(\d)(?=-|$)/g, "-0$1") &&
        !a.startsWith("throw:")),
  },
  {
    // A generator envelope must carry exactly five assertions; the frozen
    // bundle accepted strays.
    id: "T3 generator envelope extra assertions",
    matches: (r, a, b) =>
      r.k === "genEnvelope" && !a.startsWith("throw:") && b === "throw:ExtraKeys",
  },
  {
    // Persisted JSON is validated as the reference's serde types validate
    // it: a non-integer or out-of-range `nextSeq`, the generator-style
    // `chainID` on a mark, an empty `info_bytes`, a missing field, the
    // wrong JSON type; the frozen bundle read them leniently or failed
    // with an engine error or a differently coded one.
    id: "T4 persisted JSON validation",
    matches: (r, a, b) =>
      r.k === "json" &&
      /^throw:(?:Json|Base64|Cbor|InvalidDate|Resolution|ResolutionError)$/.test(b) &&
      a !== b,
  },
  {
    // A text info in the debug string is rendered through dcbor's
    // diagnostic notation, quotes escaped; the frozen bundle interpolated it raw.
    id: "T5 debug string escapes text",
    matches: (r, a, b) =>
      r.k === "generator" &&
      differingLines(a, b, (x, y) => /^debug=.*info: "/.test(x) && /^debug=.*info: "/.test(y)),
  },
  {
    // A sibling error at a decode boundary is wrapped with the package's
    // own code and the reference's message (`Bytewords`, `Cbor`, `Url`,
    // `Base64`); the frozen bundle let the sibling's error escape.
    id: "T6 sibling errors wrapped",
    matches: (_r, a, b) =>
      differingLines(a, b, (x, y) => foreign.test(x) && throws.test(y) && !foreign.test(y)),
  },
  {
    // An identifier word count outside 4 to 32 is a `RangeError`, as the
    // reference asserts; the frozen bundle threw a plain `Error`.
    id: "T7 identifier bounds",
    matches: (r, a, b) => r.k === "identifier" && a === "throw:Error" && b === "throw:RangeError",
  },
  {
    // `ProvenanceSeed.fromCbor` and `RngState.fromCbor` report a wrong
    // length as `Cbor` with the length error's message, as the reference's
    // `TryFrom<CBOR>` does; the frozen bundle threw the length error itself.
    id: "T8 seed and RNG state CBOR decoders",
    matches: (r, a, b) => r.k === "bytes" && a === "throw:InvalidSeedLength" && b === "throw:Cbor",
  },
  {
    // Bytewords are case-sensitive, as the reference's decoder is; the
    // frozen bundle's uniform-resources accepted upper-case words.
    id: "T9 bytewords case",
    matches: (r, a, b) =>
      ((r.k === "decode" && (r.form === "bytewords" || r.form === "url")) || r.k === "fromurl") &&
      !a.startsWith("throw:") &&
      b === "throw:Bytewords",
  },
  {
    // An empty `provenance` parameter is decoded (and fails as bytewords),
    // as the reference does; the frozen bundle treated it as missing.
    id: "T10 empty provenance parameter",
    matches: (r, a, b) =>
      r.k === "fromurl" && a === "throw:MissingUrlParameter" && b === "throw:Bytewords",
  },
  {
    // An out-of-range resolution number in CBOR is `Cbor[OutOfRange]`, as
    // the reference's `u8::try_from` reports it; the frozen bundle threw its
    // own resolution error.
    id: "T11 resolution numbers out of the u8 range",
    matches: (r, a, b) =>
      r.k === "decode" && r.form === "cbor" && /^throw:/.test(a) && b === "throw:Cbor",
  },
  {
    // `parseSeed` reads through the serde path with strict base64 (canonical
    // padding, no whitespace, zero trailing bits), so a bad string is `Json`
    // with serde's text; the frozen bundle accepted unpadded,
    // whitespace-wrapped and non-canonical strings or threw its own base64
    // or seed-length error.
    id: "T12 parseSeed through the serde path",
    matches: (r, a, b) => r.k === "seed" && a !== b && b === "throw:Json",
  },
  {
    // Message texts only: the info type's `comment` fault, the summariser's
    // reason and JSON floats are worded as the reference words them.
    id: "T13 message wording",
    matches: (r, a, b) => r.k === "json" && /^throw:Json$/.test(a) && a === b,
  },
  {
    // A string, number or array given as key bytes is a `TypeError`; the
    // frozen bundle built a corrupt mark.
    id: "T14 key bytes guarded",
    matches: (r, _a, b) =>
      r.k === "domain" && /^from\.key\./.test(r.case) && b === "throw:TypeError",
  },
  {
    // The 4-byte codec truncates toward zero, as the reference's
    // `num_seconds()` does, so an instant inside the second before the
    // 2001 epoch encodes as the epoch; the frozen bundle floored it and
    // rejected it.
    id: "T15 the second before the epoch",
    matches: (r, a, b) =>
      r.k === "date" &&
      r.res === "medium" &&
      r.date !== undefined &&
      r.date.startsWith("2000-12-31T23:59:59.") &&
      /^throw:/.test(a) &&
      b === "00000000",
  },
  {
    // `toUrl` appends the parameter to the base's query text as it stands,
    // as the reference's `append_pair` does; the frozen bundle re-serialised
    // the query through `URLSearchParams` and replaced an existing
    // `provenance` parameter. The mark's own parameter is the same on both
    // sides.
    id: "T16 toUrl appends to the query as it stands",
    matches: (r, a, b) => {
      if (r.k !== "url" || a === b || /^throw:/.test(a) || /^throw:/.test(b)) return false;
      const mark = b.slice(b.lastIndexOf("provenance=")).split(/[&#]/)[0];
      return a.includes(mark);
    },
  },
  {
    // A leap second (`:60`) is read as the next minute, as the reference's
    // `Date::from_string` reads it; the frozen bundle's `new Date` could not
    // parse it at all.
    id: "T17 leap seconds",
    matches: (r, a, b) =>
      r.k === "date" &&
      r.date !== undefined &&
      r.date.includes(":60") &&
      a === "throw:InvalidDate" &&
      !/^throw:/.test(b),
  },
];

const baseline = baselineAdapterFor(baselineMod, await baselineDeps());
const current = workingTreeAdapterFor(src, currentDeps);
const materialized = materializedFrom(baseline);

describe("differential: baseline vs working tree", () => {
  it("baseline bundle integrity", () => {
    const sha = createHash("sha256")
      .update(readFileSync(join(here, "baseline/provenance-mark-baseline.mjs")))
      .digest("hex");
    expect(sha).toBe(BASELINE_SHA256);
  });
  it("skips only the categories the frozen bundle cannot run", () => {
    const skipped = Object.entries(categories)
      .filter(([, gen]) => ![...gen(materialized)].some(isBaselineSupported))
      .map(([name]) => name);
    expect(skipped).toEqual(["cbor", "infoType", "summary", "domain"]);
  });
  for (const [name, gen] of Object.entries(categories)) {
    if (["cbor", "infoType", "summary", "domain"].includes(name)) continue;
    it(`category ${name}`, { timeout: 900_000 }, () => {
      let n = 0;
      const diffs: string[] = [];
      for (const recipe of gen(materialized)) {
        if (!isBaselineSupported(recipe)) continue;
        n++;
        const a = normalizeCode(materialize(baseline, recipe));
        const b = normalizeCode(materialize(current, recipe));
        const tomb = TOMBSTONES.find((t) => t.matches(recipe, a, b));
        if (a !== b && (tomb === undefined || tomb.landed === false))
          diffs.push(`${recipeName(recipe)}: ${a.slice(0, 100)} !== ${b.slice(0, 100)}`);
      }
      expect(n).toBeGreaterThan(0);
      expect(diffs).toEqual([]);
    });
  }
});
