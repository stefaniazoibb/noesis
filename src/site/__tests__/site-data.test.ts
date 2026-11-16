import { describe, expect, it } from "vitest";
import { getEvidenceIndex, getStudy, getAssertions } from "@/lib/repo/evidence";
import { NO_FILTERS } from "@/lib/evidence/metrics";
import { corpusCounts } from "@/lib/evidence/summary";
import { encoderData, pairWaffle, pickerData, recordedAnswer, traceFindings } from "../data";
import recorded from "../recorded/answer.json";

describe("landing data stays tied to /data", () => {
  it("picker counts equal the atlas's per-disorder study counts", () => {
    const index = getEvidenceIndex();
    const { disorders, sources } = pickerData();
    expect(disorders.length).toBe(corpusCounts().disorders);
    for (const d of disorders) {
      const counts = index.studyCounts(d.id, NO_FILTERS);
      expect(Object.keys(d.colors).sort()).toEqual([...counts.keys()].sort());
      for (const p of d.pairs) {
        expect(p.studies).toBe(counts.get(p.region));
        for (const a of p.assertions) expect(sources[a.studyId]).toBeDefined();
      }
    }
  });

  it("every traced finding resolves to a real assertion and a verifiable study", () => {
    const ids = new Set(getAssertions().map((a) => a.id));
    for (const f of traceFindings(5)) {
      expect(ids.has(f.assertion.id)).toBe(true);
      expect(f.source.doi || f.source.pmid).toBeTruthy();
    }
  });

  it("the waffle has one cell per indexed region-disorder pair", () => {
    expect(pairWaffle().length).toBe(getEvidenceIndex().pairsForDisorder(null, NO_FILTERS).length);
  });

  it("encoder numbers are read from the ModelRun files", () => {
    const e = encoderData();
    expect(e.eeg.lo).toBeLessThan(e.eeg.auc);
    expect(e.eeg.hi).toBeGreaterThan(e.eeg.auc);
    expect(e.conn.adhdLo).toBeLessThan(e.conn.adhdHi);
    expect(e.mri.thinning.length).toBeGreaterThan(0);
  });
});

describe("recorded assistant answer", () => {
  it("cites only retrieved, existing studies with identifiers", () => {
    const retrieved = new Set(recorded.retrievedStudyIds);
    expect(recorded.citedIds.length).toBeGreaterThan(0);
    expect(recorded.strippedIds).toEqual([]);
    for (const id of recorded.citedIds) {
      expect(retrieved.has(id)).toBe(true);
      const s = getStudy(id);
      expect(s, id).toBeDefined();
      expect(s!.doi || s!.pmid).toBeTruthy();
      expect(recorded.answer).toContain(`[${id}]`);
    }
  });

  it("carries the provenance fields copied from the API response", () => {
    expect(recorded.kind).toBe("recorded-demonstration");
    expect(recorded.model).toMatch(/^claude-/);
    expect(recorded.responseId).toMatch(/^msg_/);
    expect(Number.isNaN(Date.parse(recorded.recordedAt))).toBe(false);
    expect(recordedAnswer().corpusChanged).toBe(false);
  });
});
