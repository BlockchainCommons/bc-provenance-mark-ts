import { sha256 } from "@blockchaincommons/crypto";
import { SeededRng, randomBytes } from "@blockchaincommons/rand";

// The generator persists its xoshiro256** state as 32 little-endian bytes
// (`RngState`) and resumes it with `new SeededRng(bytes)`; `state` gives the
// bytes back. Fixtures from provenance-mark-rust's xoshiro256starstar tests.
describe("generator state through SeededRng", () => {
  it("draws the expected key bytes from a sha256-seeded state", () => {
    const rng = new SeededRng(sha256(new TextEncoder().encode("Hello World")));
    const key = randomBytes(32, { rng });
    expect(key).toEqual(
      hexDecode("b18b446df414ec00714f19cb0f03e45cd3c3d5d071d2e7483ba8627c65b9926a"),
    );
  });

  it("saves and restores the state byte-for-byte", () => {
    const words: [bigint, bigint, bigint, bigint] = [
      17295166580085024720n,
      422929670265678780n,
      5577237070365765850n,
      7953171132032326923n,
    ];
    const state = new SeededRng(words).state;
    expect(state).toEqual(
      hexDecode("d0e72cf15ec604f0bcab28594b8cde05dab04ae79053664d0b9dadc201575f6e"),
    );
    expect(new SeededRng(state).state).toEqual(state);
    const a = new SeededRng(state);
    const b = a.clone();
    expect(b.nextU64()).toBe(a.nextU64());
  });
});

function hexDecode(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}
