"""Build data/studies/studies.json and data/evidence/assertions.json.

Bibliographic metadata comes from the PubMed cache (cache/pmid_<id>.json);
curation judgments come from curated.py. Region ids are validated against the
atlas. Run from pipeline/curation with the noesis conda env.
"""

import json
import sys
from pathlib import Path

from curated import STUDIES

HERE = Path(__file__).parent
REPO = HERE.parent.parent
CACHE = HERE / "cache"
CURATED_DATE = "2026-08-10"


def main():
    atlas = json.loads((REPO / "data/atlases/atlas.dk.json").read_text())
    region_ids = {r["id"] for r in atlas["regions"]}
    verified_file = HERE / "verified_by_human.json"
    verified_by_human = (
        json.loads(verified_file.read_text()) if verified_file.exists() else {}
    )

    studies_out, assertions_out = [], []
    seen_pmids = set()

    for s in STUDIES:
        if s["pmid"] in seen_pmids:
            sys.exit(f"ERROR: duplicate pmid {s['pmid']}")
        seen_pmids.add(s["pmid"])

        cache_file = CACHE / f"pmid_{s['pmid']}.json"
        if not cache_file.exists():
            sys.exit(f"ERROR: no cached PubMed record for {s['pmid']} ({s['id']})")
        rec = json.loads(cache_file.read_text())
        for field in ("title", "year", "journal"):
            if not rec.get(field):
                sys.exit(f"ERROR: cache for {s['pmid']} missing {field}")

        all_regions = []
        for g in s["groups"]:
            regions = g[0]
            for r in regions:
                if r not in region_ids:
                    sys.exit(f"ERROR: unknown region id {r} in {s['id']}")
                if r not in all_regions:
                    all_regions.append(r)

        studies_out.append({
            "id": s["id"],
            "title": rec["title"],
            "authors": rec["authors"][:6],
            "year": rec["year"],
            "journal": rec["journal"],
            "doi": rec["doi"],
            "pmid": rec["pmid"],
            "disorders": s["disorders"],
            "regions": all_regions,
            "networks": [],
            "modalities": s["modalities"],
            "findingType": s["findingType"],
            "finding": s["finding"],
            "direction": s["direction"],
            "sampleSize": s["sampleSize"],
            "population": s["population"],
            "coordinates": [],
            "effectSize": None,
            "source": "pubmed",
            "curation": {
                "method": "manual",
                "verifiedByHuman": s["id"] in verified_by_human,
                "metadataVerifiedAgainst": "pubmed_efetch",
                "curatedDate": CURATED_DATE,
            },
        })

        n = 0
        for g in s["groups"]:
            regions, direction, finding_type, statement = g[0], g[1], g[2], g[3]
            disorders = g[4] if len(g) > 4 else s["disorders"]
            for disorder in disorders:
                for region in regions:
                    n += 1
                    assertions_out.append({
                        "id": f"ev_{s['id'].removeprefix('study_')}_{n:02d}",
                        "disorder": disorder,
                        "region": region,
                        "network": None,
                        "modality": s["modalities"][0],
                        "findingType": finding_type,
                        "direction": direction,
                        "statement": statement,
                        "studyId": s["id"],
                        "causalSupport": s["causal"],
                        "confidence": None,
                    })

    (REPO / "data/studies/studies.json").write_text(
        json.dumps(studies_out, indent=2, ensure_ascii=False) + "\n")
    (REPO / "data/evidence/assertions.json").write_text(
        json.dumps(assertions_out, indent=2, ensure_ascii=False) + "\n")
    print(f"wrote {len(studies_out)} studies, {len(assertions_out)} assertions")
    by_disorder = {}
    for a in assertions_out:
        by_disorder[a["disorder"]] = by_disorder.get(a["disorder"], 0) + 1
    for d, c in sorted(by_disorder.items()):
        print(f"  {d}: {c} assertions")


if __name__ == "__main__":
    main()
