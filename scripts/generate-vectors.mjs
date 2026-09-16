/**
 * Golden vector generator. `bun scripts/generate-vectors.mjs`.
 * Materialises the golden recipe subset with the WORKING TREE and writes
 * tests/vectors/vectors.json. With VECTORS_FROM=baseline it materialises
 * with the frozen bundle instead, the way the file was first created.
 * Regenerating is a deliberate, reviewed act.
 */
import { writeFileSync } from "node:fs";
import { DirectoryConfig, setDirectoryConfig } from "@blockchaincommons/known-values";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { materialize, recipeName } from "../tests/vectors/recipes.ts";
import { baselineAdapterFor } from "../tests/vectors/baseline-adapter.ts";
import { workingTreeAdapterFor } from "../tests/vectors/working-tree-adapter.ts";
import { goldenRecipes } from "../tests/corpus/corpus.ts";
import { baselineDeps, currentDeps } from "../tests/vectors/deps.ts";
import { materializedFrom } from "../tests/vectors/materialized.ts";

// No registry directory: the vectors never depend on this machine's `~/.known-values`.
setDirectoryConfig(new DirectoryConfig());

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const api =
  process.env.VECTORS_FROM === "baseline"
    ? baselineAdapterFor(
        await import("../tests/baseline/provenance-mark-baseline.mjs"),
        await baselineDeps(),
      )
    : workingTreeAdapterFor(await import("../src/index.ts"), currentDeps);
const vectors = [];
for (const recipe of goldenRecipes(materializedFrom(api)))
  vectors.push({ name: recipeName(recipe), recipe, expect: materialize(api, recipe) });
writeFileSync(
  join(root, "tests/vectors/vectors.json"),
  JSON.stringify({ count: vectors.length, vectors }, null, 1) + "\n",
);
console.log(
  `wrote ${vectors.length} vectors from ${process.env.VECTORS_FROM === "baseline" ? "the frozen baseline" : "working tree"}`,
);
