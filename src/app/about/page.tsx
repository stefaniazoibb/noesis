import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/PageHeader";
import { corpusCounts, gapCountsByRule } from "@/lib/evidence/summary";
import { GITHUB_URL } from "@/lib/site";

export const metadata: Metadata = {
  title: "About & methodology — NOĒSIS",
  description:
    "How NOĒSIS is built: curation pipeline, metric definitions, data sources, scientific-integrity rules and limitations.",
};


function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="scroll-mt-24 font-serif text-[32px] leading-tight text-text">
      {children}
    </h2>
  );
}

const SOURCES = [
  { s: "FreeSurfer fsaverage (surfaces, aparc, aseg) via MNE-Python", u: "All 3D geometry; the 83-region atlas", l: "FreeSurfer license" },
  { s: "PubMed (NCBI E-utilities)", u: "Study discovery, bibliographic metadata, abstracts for curation", l: "Metadata freely usable; abstracts never stored in /data" },
  { s: "OpenAlex", u: "DOI cross-check in the verification gate", l: "CC0" },
  { s: "Yeo et al. 2011 7-network parcellation", u: "Network memberships of DK regions", l: "MIT (CBIG repository)" },
  { s: "NeuroQuery (Dockès et al. 2020)", u: "Model-generated meta-analytic maps — a separate, labelled stratum", l: "BSD-3-Clause" },
  { s: "OpenNeuro ds004504 (Miltiadous et al. 2023)", u: "EEG spectral encoder (ML Lab), disorder-level only", l: "CC0" },
  { s: "OpenNeuro ds000030, UCLA CNP (Poldrack et al. 2016)", u: "MRI morphometry and fMRI connectivity encoders (ML Lab)", l: "CC0" },
];

export default function AboutPage() {
  const c = corpusCounts();
  const rules = gapCountsByRule();
  return (
    <main className="route-fade mx-auto w-full max-w-7xl flex-1 px-5 py-10 sm:px-8">
      <PageHeader eyebrow="About · Methodology" title="How NOĒSIS works">
        <p>
          NOĒSIS connects a real 3D brain atlas to a curated, DOI/PMID-verified evidence corpus,
          rule-based convergence and gap analytics, evidence-derived ML representations and a
          citation-validated research assistant. This page documents how each layer is built and
          where its limits are.
        </p>
      </PageHeader>

      <div className="mt-12 grid gap-12 lg:grid-cols-[13rem_1fr]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-24 space-y-2 text-[13px]">
            {[
              ["methodology", "Methodology"],
              ["metrics", "Metric definitions"],
              ["integrity", "Integrity rules"],
              ["data-sources", "Data sources"],
              ["limitations", "Limitations"],
              ["project", "Project & code"],
            ].map(([id, l]) => (
              <li key={id}>
                <a href={`#${id}`} className="text-text-2 hover:text-amber">{l}</a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl space-y-20 text-[14px] leading-relaxed text-text-2">
          <section>
            <H2 id="methodology">Methodology</H2>
            <ol className="mt-6 space-y-5">
              {[
                ["Atlas", `FreeSurfer's fsaverage surface parcellated with the Desikan-Killiany atlas (${c.corticalRegions} cortical regions) plus ${c.subcorticalRegions} structures from fsaverage's own aseg segmentation, all in one surface-RAS frame. One mesh per hemisphere carries a per-vertex region id, so picking and overlays are exact.`],
                ["Curation", "Studies are discovered through PubMed and cached verbatim. Curated judgments are written only from the cached abstract; bibliographic metadata is merged programmatically, never typed by hand. A region assertion exists only when the abstract names the region or stimulation target."],
                ["Verification gate", "Every study's title, year and DOI are re-checked against PubMed and OpenAlex; the build fails on a mismatch. Zod schemas and referential-integrity checks reject any assertion without a study, any study without a DOI or PMID, and any unknown id."],
                ["Analytics", "Evidence levels, convergence profiles and gaps are deterministic rules over the assertions, each with a published definition. Nothing is a learned score."],
                ["Representations", "Evidence profiles (log-scaled, standardised counts) are reduced with PCA, whose loadings are published, and UMAP. They describe the corpus, not biology."],
                ["Assistant", "Entity linking, deterministic retrieval, model synthesis restricted to retrieved records, then a citation validator. Without an API key the assistant returns the retrieved records only."],
              ].map(([t, d], i) => (
                <li key={t} className="grid grid-cols-[2rem_1fr] gap-2">
                  <span className="font-serif text-[22px] leading-none text-amber tabular-nums">{i + 1}</span>
                  <div>
                    <h3 className="text-[14px] text-text">{t}</h3>
                    <p className="mt-1">{d}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <section>
            <H2 id="metrics">Metric definitions</H2>
            <p className="mt-3">
              Every quantity shown on the brain or in a panel is computed from the assertions. The
              full text lives in <code className="rounded bg-surface px-1.5 py-0.5 text-[12px]">docs/METRICS.md</code>.
            </p>
            <dl className="mt-6 divide-y divide-line border-y border-line">
              {[
                ["Study count", "Distinct studies with ≥1 assertion linking the region to the disorder, after filters. One study counts once."],
                ["Cross-modal convergence", "Distinct modality categories (imaging, electrophysiology, stimulation) with evidence for the pair. fMRI + sMRI count as one category."],
                ["Evidence level", "Mixed: opposite directions for the same finding type. Strong: ≥3 studies and ≥2 categories. Moderate: ≥2 studies. Emerging: 1 study. Labels summarise the indexed corpus, not clinical consensus."],
                ["Direction consistency", "Share of distinct (study, finding type, direction) units agreeing with the majority direction of their finding type. Not assessed below 2 units."],
                ["Conflict", "Same finding type, opposite directions. Both sides are listed with year, sample and population; never adjudicated."],
                ["Research-question rank", "Gap magnitude × rule weight (conflict 3, imaging-without-EEG 2, observational-without-intervention 2, attention asymmetry 1). The model never ranks."],
                ["Embedding similarity", "Cosine similarity between evidence-profile vectors. Computational similarity over the corpus, not anatomical or clinical similarity."],
              ].map(([t, d]) => (
                <div key={t} className="grid gap-1 py-3 sm:grid-cols-[12rem_1fr]">
                  <dt className="text-text">{t}</dt>
                  <dd className="text-[13px]">{d}</dd>
                </div>
              ))}
            </dl>
            <h3 className="mt-8 text-[14px] text-text">Gap rules</h3>
            <ul className="mt-3 space-y-3">
              {rules.map((r) => (
                <li key={r.ruleId} className="border-l border-line-strong pl-4">
                  <p className="text-text">
                    {r.name} <span className="text-cyan tabular-nums">· {r.count} detected</span>
                  </p>
                  <p className="text-[13px]">{r.definition}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <H2 id="integrity">Scientific-integrity rules</H2>
            <ul className="mt-6 space-y-3">
              {[
                "No fabricated science: no invented studies, DOIs, PMIDs, findings, sample sizes or region associations. “Evidence unavailable” is a designed state.",
                "AI is an interpretation layer: it never writes to the data, answers only from retrieved records, and every citation is validated.",
                "Hedged language everywhere: implicated in, associated with. Association ≠ prediction ≠ model importance ≠ causal evidence.",
                "Every metric has a published, rule-based definition shown in its legend.",
                "Conflicts are surfaced, never resolved automatically; gaps carry a curation-gap caveat.",
                "Group-level findings never become individual predictions. NOĒSIS is not a diagnostic tool.",
              ].map((t) => (
                <li key={t} className="flex gap-3">
                  <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-amber" />
                  <span>{t}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <H2 id="data-sources">Data sources</H2>
            <div className="mt-6 overflow-x-auto rounded-xl border border-line">
              <table className="w-full min-w-[36rem] text-left text-[12px]">
                <thead className="bg-ink-2 text-[10px] uppercase tracking-[0.14em] text-text-3">
                  <tr>
                    <th className="px-4 py-2.5 font-normal">Source</th>
                    <th className="px-4 py-2.5 font-normal">Used for</th>
                    <th className="px-4 py-2.5 font-normal">Licence / terms</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {SOURCES.map((r) => (
                    <tr key={r.s}>
                      <td className="px-4 py-2.5 text-text">{r.s}</td>
                      <td className="px-4 py-2.5">{r.u}</td>
                      <td className="px-4 py-2.5 text-text-3">{r.l}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-[12px] text-text-3">
              Provenance records live in <code>data/provenance/</code>; licence summary in <code>data/LICENSES.md</code>.
              ds002778 was rejected at ingestion because its README asks that classification not be run on it.
            </p>
          </section>

          <section>
            <H2 id="limitations">Limitations</H2>
            <ul className="mt-6 space-y-4">
              {[
                ["A small, curated corpus", `${c.studies} studies and ${c.assertions} assertions, ${c.yearMin}–${c.yearMax}, weighted toward large meta- and mega-analyses. It is not a systematic review; densities measure what has been indexed, not the state of the literature.`],
                ["Human review pending", c.humanVerified === 0 ? `Metadata of all ${c.studies} studies is machine-verified against PubMed and OpenAlex, but none of the curated judgments has yet been spot-checked by a second human reviewer.` : `${c.humanVerified} of ${c.studies} studies have been human-verified.`],
                ["Coarse anatomy", "Desikan-Killiany regions are large; findings reported for sub-regions or networks are mapped to the enclosing region; non-obvious mappings are stated inside the assertion."],
                ["Density is not quality", "A heavily shaded region has more indexed studies, not stronger or better evidence. Effect sizes are not modelled in the corpus metrics."],
                ["Gaps may be curation gaps", "Rules run on the indexed corpus. A detected gap may disappear once more of the literature is curated."],
                ["Embeddings reflect the corpus", "Sparse entities cluster by sparsity. Proximity in the representation space is never biological or clinical similarity."],
                ["AI layer", "Synthesis and question generation require an Anthropic API key. Citation checks confirm that a cited study was retrieved, not that it supports the exact sentence; read the sources. Without a key, NOĒSIS shows retrieved records only."],
                ["Not for individuals", "Group-level research findings cannot describe one person's brain or experience. Nothing here supports diagnosis."],
              ].map(([t, d]) => (
                <li key={t}>
                  <p className="text-text">{t}</p>
                  <p className="text-[13px]">{d}</p>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <H2 id="project">Project &amp; code</H2>
            <p className="mt-4">
              Built with Next.js, React Three Fiber and Zod-validated static artifacts — no runtime
              database and no Python in the deployed app. The offline pipeline (meshes, curation,
              embeddings, ML runs) is Python.
            </p>
            <ul className="mt-5 flex flex-wrap gap-3 text-[13px]">
              {GITHUB_URL && (
                <li><a href={GITHUB_URL} target="_blank" rel="noreferrer" className="rounded-md border border-line px-3 py-1.5 text-text hover:border-amber/50">GitHub repository</a></li>
              )}
              <li><Link href="/ml/lab" className="rounded-md border border-line px-3 py-1.5 text-text hover:border-amber/50">ML Lab model runs</Link></li>
              <li><Link href="/evidence" className="rounded-md border border-line px-3 py-1.5 text-text hover:border-amber/50">Evidence corpus</Link></li>
            </ul>
            <p className="mt-4 text-[12px] text-text-3">
              Documentation in the repository: docs/NOESIS_ARCHITECTURE.md, docs/NOESIS_SCIENTIFIC_RULES.md,
              docs/METRICS.md, docs/NOESIS_DATA_SOURCES.md, docs/NOESIS_DECISIONS.md, docs/NOESIS_ROADMAP.md.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
