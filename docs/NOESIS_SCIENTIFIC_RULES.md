# NOĒSIS — Scientific Integrity Rules (non-negotiable)

These rules are load-bearing product requirements. A change that violates one
is wrong even if it "works". The validator agent reviews against this file.

## 1. No fabricated science — structurally enforced

Never invent studies, citations, DOIs, PMIDs, authors, journals, years,
sample sizes, coordinates, effect sizes, findings, or brain-region
associations. Enforcement that must not be weakened:

- Studies enter only via `pipeline/curation/`: PubMed records cached
  verbatim; `curated.py` encodes judgments **only from cached abstracts**;
  `build_evidence.py` merges bibliographic metadata from the cache (never
  hand-typed); `verify_studies.py` re-checks title/year/DOI against PubMed +
  OpenAlex and must exit 0.
- A study without DOI or PMID cannot validate (Zod refine).
- An assertion without a `studyId` fails CI; dangling ids fail CI
  (`npm run validate:data`).
- Region assertions exist **only when the abstract names the region or
  stimulation target**; scalp-level EEG findings are indexed without region
  links. Non-obvious mappings (DLPFC→middle frontal, SN→brainstem mesh,
  vmPFC→medial OFC) are stated inside the assertion statement.
- Ambiguity rule: if a study's key property can't be established from the
  cached record (e.g. EEG vs MEG), drop the study rather than guess.
- "Evidence unavailable" is a designed UI state — prefer it to any guess.

## 2. AI is an interpretation layer, never a source

- The AI never writes to `/data` or the knowledge structures.
- The assistant answers scientific questions **only** from retrieved records;
  empty retrieval → deterministic "no indexed evidence" answer, never model
  memory.
- Every LLM output that makes scientific claims passes the deterministic
  citation validator (`src/ai/citations.ts`): non-retrieved ids stripped and
  counted; uncited scientific sentences flagged visibly.
- Research-question generation: the LLM writes prose only; gap selection,
  ranking, question type, candidate regions/modalities, and provenance are
  deterministic and documented in `docs/METRICS.md`.
- AI outputs carry fixed labels ("AI-generated … verify against the original
  publications" / "not a validated research conclusion"). AI confidence is
  never presented as evidence strength.

## 3. Language and causality

- Hedged, association-level language everywhere: "implicated in",
  "associated with", "reported", "mixed evidence". Never "causes", never
  diagnostic phrasing.
- Association ≠ prediction ≠ model importance ≠ intervention evidence ≠
  causal evidence. `causalSupport` (none/correlational/interventional) is the
  only causal signal, and interventional ≠ causal mechanism.
- The platform is not a diagnostic tool: the persistent disclaimer bar and
  the PersonalExperienceNote (lived experience → licensed clinician) must
  remain on all disorder-related surfaces.

## 4. Metrics and representations

- Every displayed quantity has a published, rule-based definition in
  `docs/METRICS.md`, shown or referenced in its legend. No unexplained
  scores; changing a definition requires updating METRICS.md in the same
  commit.
- Convergence counts independent modality **categories**; its dimensions are
  never collapsed into one number; non-computable dimensions are shown as
  "not assessed", not approximated.
- Conflicts are surfaced with per-side studies and structured differences —
  never auto-adjudicated.
- Gaps describe the **indexed corpus**; every gap surface carries the
  "may be a curation gap" caveat.
- Embeddings/similarity are always labeled computational similarity over the
  indexed evidence — not anatomical distance, not clinical equivalence, not
  biology. Known artifact: sparse-evidence disorders cluster by evidence
  structure.
- ML leakage rules (future real data): subject-level splits mandatory,
  site-aware validation, nested CV; a ModelRun without a declared split
  strategy must not render.

## 5. Synthetic / demo data

- Test fixtures live only in `__tests__/` and never render as evidence.
- The application currently contains **zero** demo data. If demo data is ever
  required during UI development it must be visibly labeled
  "DEMO DATA — NOT SCIENTIFIC EVIDENCE" and never mixed with real evidence.

## 6. Human-in-the-loop

- `curation.verifiedByHuman` stays `false` until a human reviews the record;
  bulk-flipping it without review is a violation.
- AI-generated research questions are ephemeral until a researcher saves
  them (notebook, roadmap #7); nothing AI-generated feeds back into `/data`.
