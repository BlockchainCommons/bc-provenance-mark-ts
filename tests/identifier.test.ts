import { describe, it, expect } from "vitest";
import { ProvenanceMark, ProvenanceMarkGenerator, type ProvenanceMarkResolution } from "../src";

const BASE_DATE_MS = Date.UTC(2023, 5, 20, 12, 0, 0, 0); // 2023-06-20T12:00:00Z
const DAY_MS = 24 * 60 * 60 * 1000;

function makeMarksForResolution(res: ProvenanceMarkResolution, count: number): ProvenanceMark[] {
  const generator = ProvenanceMarkGenerator.fromPassphrase(res, "Wolf");
  // Mirror the rust helper which serializes / deserializes the generator
  // each round to ensure state persistence works identically.
  let encoded = JSON.stringify(generator.toJSON());
  const marks: ProvenanceMark[] = [];
  for (let i = 0; i < count; i++) {
    const g = ProvenanceMarkGenerator.fromJSON(JSON.parse(encoded));
    const date = new Date(BASE_DATE_MS + i * DAY_MS);
    marks.push(g.next(date));
    encoded = JSON.stringify(g.toJSON());
  }
  return marks;
}

const makeTestMarks = (count: number): ProvenanceMark[] => makeMarksForResolution("low", count);

const ALL_RESOLUTIONS: ProvenanceMarkResolution[] = ["low", "medium", "quartile", "high"];

// =============================================================================
// id() / idHex()
// =============================================================================

describe("ProvenanceMark.id", () => {
  it("returns 32 bytes for every resolution", () => {
    for (const res of ALL_RESOLUTIONS) {
      const marks = makeMarksForResolution(res, 3);
      for (const mark of marks) {
        expect(mark.id.length).toBe(32);
      }
    }
  });

  it("preserves the stored hash as the prefix of the 32-byte id", () => {
    for (const res of ALL_RESOLUTIONS) {
      const marks = makeMarksForResolution(res, 3);
      for (const mark of marks) {
        const id = mark.id;
        const hash = mark.hash;
        expect(Array.from(id.subarray(0, hash.length))).toEqual(Array.from(hash));
      }
    }
  });
});

describe("ProvenanceMark.idHex", () => {
  it("is always 64 hex chars", () => {
    const marks = makeTestMarks(5);
    for (const mark of marks) {
      expect(mark.idHex.length).toBe(64);
      expect(/^[0-9a-f]{64}$/.test(mark.idHex)).toBe(true);
    }
  });

  it("encodes the full 32-byte id", () => {
    const [mark] = makeTestMarks(1);
    const id = mark.id;
    const expected = Array.from(id)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(mark.idHex).toBe(expected);
  });
});

// =============================================================================
// idBytewords
// =============================================================================

describe("ProvenanceMark.idBytewords()", () => {
  it("returns `wordCount` space-separated words for 4..=32", () => {
    const [mark] = makeTestMarks(1);
    for (let n = 4; n <= 32; n++) {
      const words = mark.identifier({ words: n, prefix: false }).split(" ");
      expect(words.length).toBe(n);
    }
  });

  it("the 8-word form extends the 4-word form", () => {
    const [mark] = makeTestMarks(1);
    const short = mark.identifier({ words: 4, prefix: false });
    const long = mark.identifier({ words: 8, prefix: false });
    expect(long.startsWith(short)).toBe(true);
  });

  it("respects the `prefix` flag", () => {
    const [mark] = makeTestMarks(1);
    const without = mark.identifier({ words: 4, prefix: false });
    const withPrefix = mark.identifier({ words: 4, prefix: true });
    expect(withPrefix.startsWith("\u{1F15F} ")).toBe(true);
    // Strip the prefix by its exact JS code-point length.
    const prefixLen = "\u{1F15F} ".length;
    expect(withPrefix.slice(prefixLen)).toBe(without);
  });
});

describe("ProvenanceMark.idBytewords() argument validation", () => {
  it("throws for wordCount below 4", () => {
    const [mark] = makeTestMarks(1);
    expect(() => mark.identifier({ words: 3, prefix: false })).toThrow(RangeError);
  });

  it("throws for wordCount above 32", () => {
    const [mark] = makeTestMarks(1);
    expect(() => mark.identifier({ words: 33, prefix: false })).toThrow(RangeError);
  });
});

// =============================================================================
// idBytemoji
// =============================================================================

describe("ProvenanceMark.idBytemoji()", () => {
  it("returns `wordCount` space-separated emojis for 4..=32", () => {
    const [mark] = makeTestMarks(1);
    for (let n = 4; n <= 32; n++) {
      const emojis = mark.identifier({ style: "bytemoji", words: n, prefix: false }).split(" ");
      expect(emojis.length).toBe(n);
    }
  });

  it("throws for wordCount above 32", () => {
    const [mark] = makeTestMarks(1);
    expect(() => mark.identifier({ style: "bytemoji", words: 33, prefix: false })).toThrow(
      RangeError,
    );
  });
});

// =============================================================================
// idBytewordsMinimal
// =============================================================================

describe("ProvenanceMark.idBytewordsMinimal()", () => {
  it("is exactly `wordCount * 2` characters for 4..=32", () => {
    const [mark] = makeTestMarks(1);
    for (let n = 4; n <= 32; n++) {
      expect(mark.identifier({ style: "minimal", words: n, prefix: false }).length).toBe(n * 2);
    }
  });

  it("is always upper-case", () => {
    const [mark] = makeTestMarks(1);
    const minimal = mark.identifier({ style: "minimal", words: 4, prefix: false });
    expect(minimal).toBe(minimal.toUpperCase());
  });

  it("the 8-byte form extends the 4-byte form", () => {
    const [mark] = makeTestMarks(1);
    const short = mark.identifier({ style: "minimal", words: 4, prefix: false });
    const long = mark.identifier({ style: "minimal", words: 8, prefix: false });
    expect(long.startsWith(short)).toBe(true);
  });

  it("throws for wordCount below 4", () => {
    const [mark] = makeTestMarks(1);
    expect(() => mark.identifier({ style: "minimal", words: 3, prefix: false })).toThrow(
      RangeError,
    );
  });
});

// =============================================================================
// disambiguation — no collisions
// =============================================================================

describe("ProvenanceMark.disambiguatedIdentifiers() without collisions", () => {
  it("returns a 4-word identifier per distinct mark", () => {
    const marks = makeTestMarks(5);
    const ids = ProvenanceMark.disambiguatedIdentifiers(marks, { prefix: false });
    expect(ids.length).toBe(5);
    for (const id of ids) {
      expect(id.split(" ").length).toBe(4);
    }
  });

  it("is empty for an empty input", () => {
    const ids = ProvenanceMark.disambiguatedIdentifiers([], { prefix: false });
    expect(ids).toEqual([]);
  });

  it("handles a single mark", () => {
    const marks = makeTestMarks(1);
    const ids = ProvenanceMark.disambiguatedIdentifiers(marks, { prefix: false });
    expect(ids.length).toBe(1);
    expect(ids[0].split(" ").length).toBe(4);
  });
});

// =============================================================================
// disambiguation — with collisions
// =============================================================================

describe("ProvenanceMark.disambiguatedIdentifiers() selective extension", () => {
  it("only extends colliding entries; identical marks max out at 32 words", () => {
    const marks = makeTestMarks(5);

    // Baseline: non-colliding marks all get 4 words.
    const baseline = ProvenanceMark.disambiguatedIdentifiers(marks, { prefix: false });
    for (const id of baseline) {
      expect(id.split(" ").length).toBe(4);
    }

    // Force a collision by including a duplicate mark.
    const dupped = [marks[0], marks[1], marks[2], marks[0]];
    const ids = ProvenanceMark.disambiguatedIdentifiers(dupped, { prefix: false });
    expect(ids.length).toBe(4);

    // marks[1] and marks[2] should still have 4 words (no collision)
    expect(ids[1].split(" ").length).toBe(4);
    expect(ids[2].split(" ").length).toBe(4);

    // The duplicate pair (indices 0 and 3) have identical IDs, so they
    // extend to 32 words (can't disambiguate truly identical marks).
    expect(ids[0].split(" ").length).toBe(32);
    expect(ids[3].split(" ").length).toBe(32);
    expect(ids[0]).toBe(ids[3]);
  });

  it("produces unique identifiers when inputs are all distinct", () => {
    const marks = makeTestMarks(10);
    const ids = ProvenanceMark.disambiguatedIdentifiers(marks, { prefix: false });
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// =============================================================================
// disambiguation — bytemoji parity
// =============================================================================

describe("ProvenanceMark.disambiguatedIdBytemoji()", () => {
  it("uses the same per-mark prefix lengths as disambiguatedIdBytewords", () => {
    const marks = makeTestMarks(3);
    const refs = [marks[0], marks[1], marks[0]];

    const wordIds = ProvenanceMark.disambiguatedIdentifiers(refs, { prefix: false });
    const emojiIds = ProvenanceMark.disambiguatedIdentifiers(refs, {
      style: "bytemoji",
      prefix: false,
    });

    expect(wordIds.length).toBe(emojiIds.length);
    for (let i = 0; i < wordIds.length; i++) {
      const wordCount = wordIds[i].split(" ").length;
      const emojiCount = emojiIds[i].split(" ").length;
      expect(wordCount).toBe(emojiCount);
    }
  });
});

// =============================================================================
// prefix flag
// =============================================================================

describe("ProvenanceMark.disambiguatedIdentifiers() prefix flag", () => {
  it("prepends the prefix character to every identifier", () => {
    const marks = makeTestMarks(3);
    const noPrefix = ProvenanceMark.disambiguatedIdentifiers(marks, { prefix: false });
    const withPrefix = ProvenanceMark.disambiguatedIdentifiers(marks, { prefix: true });
    const prefixLen = "\u{1F15F} ".length;
    for (let i = 0; i < noPrefix.length; i++) {
      expect(withPrefix[i].startsWith("\u{1F15F} ")).toBe(true);
      expect(withPrefix[i].slice(prefixLen)).toBe(noPrefix[i]);
    }
  });
});
