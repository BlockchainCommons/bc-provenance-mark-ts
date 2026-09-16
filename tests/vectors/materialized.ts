/**
 * The reference "Wolf" chains materialised through an adapter, so the
 * decode and validation recipes can carry real encodings.
 */
import { materialize, type VectorApi } from "./recipes";
import { RESOLUTIONS, referenceChains, type Materialized } from "../corpus/corpus";

export function materializedFrom(api: VectorApi): Materialized {
  const m: Materialized = {
    messages: {} as never,
    cbor: {} as never,
    ur: {} as never,
    url: {} as never,
    bytewords: {} as never,
  };
  for (const res of RESOLUTIONS) {
    m.messages[res] = [];
    m.cbor[res] = [];
    m.ur[res] = [];
    m.url[res] = [];
    m.bytewords[res] = [];
  }
  for (const recipe of referenceChains()) {
    if (recipe.k !== "generator" || recipe.marks[0]?.info !== undefined) continue;
    const out = materialize(api, recipe);
    for (const block of out.split("\n===\n")[0].split("\n---\n")) {
      const field = (name: string): string =>
        block.match(new RegExp(`^${name}=(.*)$`, "m"))?.[1] ?? "";
      m.messages[recipe.res].push(field("message"));
      m.cbor[recipe.res].push(field("cbor"));
      m.ur[recipe.res].push(field("ur"));
      m.url[recipe.res].push(field("url"));
      m.bytewords[recipe.res].push(field("bytewords"));
    }
  }
  return m;
}
