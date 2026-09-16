/**
 * Golden snapshot: the reference chains at every resolution,
 * every decode form and the validation reports. Reviewable, auto-updatable
 * with -u.
 */
import { describe, it, expect } from "vitest";
import * as src from "../src";
import { materialize, recipeName } from "./vectors/recipes";
import { workingTreeAdapterFor } from "./vectors/working-tree-adapter";
import { currentDeps } from "./vectors/deps";
import { materializedFrom } from "./vectors/materialized";
import { referenceChains, decodeRecipes, validateRecipes } from "./corpus/corpus";

const api = workingTreeAdapterFor(src, currentDeps);
const m = materializedFrom(api);

describe("golden", () => {
  it("reference chains", () => {
    const rows = [...referenceChains()].map((r) => `## ${recipeName(r)}\n${materialize(api, r)}`);
    expect(rows.length).toBe(8);
    expect(rows).toMatchSnapshot();
  });
  it("decode forms and rejections", () => {
    const rows = [...decodeRecipes(m)].map((r) => `${recipeName(r)}: ${materialize(api, r)}`);
    expect(rows.length).toBeGreaterThan(80);
    expect(rows).toMatchSnapshot();
  });
  it("validation reports", () => {
    const rows = [...validateRecipes(m)].map((r) => `## ${recipeName(r)}\n${materialize(api, r)}`);
    expect(rows.length).toBeGreaterThan(30);
    expect(rows).toMatchSnapshot();
  });
});
