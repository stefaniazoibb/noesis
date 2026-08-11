import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ModelRunSchema } from "@/lib/schemas";

const RUNS_DIR = join(__dirname, "..", "..", "..", "..", "data", "ml_runs");

describe("ModelRun artifact contract", () => {
  it("rejects a run without a declared split strategy", () => {
    const manifest = JSON.parse(
      readFileSync(join(RUNS_DIR, "linkpred_rgcn_v1.run.json"), "utf8"),
    );
    delete manifest.splitStrategy;
    expect(ModelRunSchema.safeParse(manifest).success).toBe(false);
  });

  it("rejects an undeclared split strategy value", () => {
    const manifest = JSON.parse(
      readFileSync(join(RUNS_DIR, "linkpred_rgcn_v1.run.json"), "utf8"),
    );
    manifest.splitStrategy = "random_rows"; // leakage-prone, not in the enum
    expect(ModelRunSchema.safeParse(manifest).success).toBe(false);
  });

  it("accepts every committed run manifest, config seed included", () => {
    for (const file of readdirSync(RUNS_DIR)) {
      if (!file.endsWith(".run.json")) continue;
      const parsed = ModelRunSchema.safeParse(
        JSON.parse(readFileSync(join(RUNS_DIR, file), "utf8")),
      );
      expect(parsed.success, file).toBe(true);
      if (parsed.success) expect(parsed.data.config.seed, file).toBeDefined();
    }
  });
});
