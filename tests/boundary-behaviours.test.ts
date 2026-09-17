/**
 * Snapshot of the behaviours at the boundaries the vectors do not reach:
 * out-of-range resolution numbers in CBOR, `parseSeed`, the info type's
 * `comment`, the envelope summariser on a malformed mark, JSON numbers
 * beyond the safe range, `parseDate` on a leap second, a string given as
 * a key, and generator equality. Reviewable, auto-updatable with -u.
 */
import { describe, expect, it } from "vitest";
import { cbor, decodeCbor } from "@blockchaincommons/dcbor";
import { Envelope } from "@blockchaincommons/envelope";
import { format } from "@blockchaincommons/envelope/format";
import {
  ProvenanceMark,
  ProvenanceMarkGenerator,
  ProvenanceMarkInfo,
  parseDate,
  parseSeed,
} from "../src";

const unhex = (h: string): Uint8Array => Uint8Array.from(Buffer.from(h, "hex"));
const outcome = (f: () => unknown): string => {
  try {
    const v = f();
    return typeof v === "string" ? v : JSON.stringify(v);
  } catch (e) {
    const x = e as { code?: string; cause?: { code?: string }; message: string; name: string };
    const inner = typeof x.cause?.code === "string" ? `[${x.cause.code}]` : "";
    return `throw:${x.code ?? x.name}${inner}|${x.message}`;
  }
};
const wolf = (): ProvenanceMark =>
  ProvenanceMarkGenerator.fromPassphrase("low", "Wolf").next(new Date("2023-06-20T12:00:00Z"));
const LOW_JSON = {
  seq: 0,
  date: "2023-06-20",
  res: 0,
  chain_id: "CQvy+A==",
  key: "CQvy+A==",
  hash: "W9zsgQ==",
};

describe("boundary behaviours", () => {
  it("resolution numbers the wire cannot hold", () => {
    const message = "50090bf2f8b96d116cf9e9983ade1d3705";
    const rows = ["19012c", "1b0000010000000000", "04", "f93e00", "20"].map(
      (res) =>
        `${res}: ${outcome(() => ProvenanceMark.fromUntaggedCbor(decodeCbor(unhex(`82${res}${message}`))).toDebugString())}`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("parseSeed", () => {
    const rows = ["!!!!", "AAAA", "A".repeat(43), "A".repeat(44)].map(
      (s) => `${s.slice(0, 8)}: ${outcome(() => parseSeed(s).hex)}`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("the info type's comment", () => {
    const info = ProvenanceMarkInfo.from(wolf()).toJSON();
    const rows = [5, null, "text", undefined].map(
      (comment) =>
        `${String(comment)}: ${outcome(() => ProvenanceMarkInfo.fromJSON({ ...info, comment }).comment)}`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("the envelope summariser on a malformed mark", () => {
    const rows = ["da50524f568209" + "4b" + "0102030405060708090a0b", "da50524f56820043090bf2"].map(
      (hex) => outcome(() => format(Envelope.leaf(decodeCbor(unhex(hex))))),
    );
    rows.push(outcome(() => format(Envelope.leaf(cbor(wolf())))));
    expect(rows).toMatchSnapshot();
  });

  it("JSON numbers beyond the safe range", () => {
    const rows = [1e30, -0, 1.0, 1.5].map(
      (seq) =>
        `${String(seq)}: ${outcome(() => ProvenanceMark.fromJSON({ ...LOW_JSON, seq }).seq)}`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("parseDate keeps what a JS Date keeps", () => {
    const rows = ["2023-01-01T00:00:00.1234567Z", "2023-12-25T10:30:60Z", "2023-01-01"].map(
      (s) => `${s}: ${outcome(() => parseDate(s).toISOString())}`,
    );
    expect(rows).toMatchSnapshot();
  });

  it("a string, a number and an array where key bytes go", () => {
    const date = new Date("2023-06-20T12:00:00Z");
    const rows = ["abcd", 4, [1, 2, 3, 4]].map((key) =>
      outcome(() => {
        const mark = ProvenanceMark.from({
          res: "low",
          key: key as unknown as Uint8Array,
          nextKey: new Uint8Array(4),
          chainId: new Uint8Array(4),
          seq: 0,
          date,
        });
        return `key.length=${mark.key.length} message.length=${mark.message.length}`;
      }),
    );
    expect(rows).toMatchSnapshot();
  });

  it("generator equality", () => {
    const g = ProvenanceMarkGenerator.fromPassphrase("low", "Wolf") as unknown as {
      equals?: (o: unknown) => boolean;
    };
    expect(typeof g.equals).toMatchSnapshot();
  });
});
