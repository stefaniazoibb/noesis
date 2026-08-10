/**
 * Runs the convergence engine over the real corpus and prints what it finds.
 * Sanity-check + curation aid: npm run report:gaps
 */
import { getEvidenceIndex } from "../src/lib/repo/evidence";
import { getDisorders, getModalities } from "../src/lib/repo/entities";
import { getRegion } from "../src/lib/repo/atlas";
import { computeProfiles } from "../src/lib/evidence/convergence";
import { detectGaps, GAP_RULES } from "../src/lib/evidence/gaps";

const index = getEvidenceIndex();
const disorders = getDisorders();
const modalityName = new Map(getModalities().map((m) => [m.id, m.abbreviation]));
const dName = new Map(disorders.map((d) => [d.id, d.name]));
const rName = (id: string) => {
  const r = getRegion(id);
  return r ? `${r.name} (${r.hemisphere[0].toUpperCase()})` : id;
};

const profilesByDisorder = new Map(
  disorders.map((d) => [d.id, computeProfiles(index, d.id)]),
);

console.log("=== Convergence profiles (top 3 per disorder) ===");
for (const [d, profiles] of profilesByDisorder) {
  console.log(`\n${dName.get(d)}: ${profiles.length} pairs with evidence`);
  for (const p of profiles.slice(0, 3)) {
    const dir = p.direction.assessed
      ? `consistency ${(p.direction.ratio! * 100).toFixed(0)}%`
      : "direction not assessed";
    console.log(
      `  ${rName(p.region)}: ${p.studyIds.length} studies, ` +
        `${p.modalityCategories.length} categories (${p.modalities.map((m) => modalityName.get(m)).join("/")}), ` +
        `${p.level}, ${dir}, conflicts: ${p.conflicts.length}, ` +
        `interventional: ${p.interventionalStudyIds.length}`,
    );
  }
}

const gaps = detectGaps(profilesByDisorder);
console.log(`\n=== Evidence gaps: ${gaps.length} detected ===`);
const byRule = new Map<string, number>();
for (const g of gaps) byRule.set(g.ruleId, (byRule.get(g.ruleId) ?? 0) + 1);
for (const [rule, count] of byRule) {
  console.log(`  ${rule} (${GAP_RULES[rule as keyof typeof GAP_RULES].name}): ${count}`);
}
console.log("\nTop 8 by magnitude:");
for (const g of gaps.slice(0, 8)) {
  console.log(
    `  [${g.ruleId}] ${dName.get(g.disorder) ?? g.disorder} × ${rName(g.region)} ` +
      `(magnitude ${g.magnitude}${g.referenceDisorder ? `, ref: ${dName.get(g.referenceDisorder)}` : ""})`,
  );
}
