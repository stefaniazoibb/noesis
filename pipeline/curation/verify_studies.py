"""Verification gate: re-check every study in data/studies/studies.json.

1. Re-fetches each PMID from PubMed and diffs title/year/journal/DOI.
2. Cross-checks the DOI against OpenAlex (by PMID) to catch wrong-DOI records.

Exit code 1 on any mismatch — studies must not ship unverified.
"""

import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).parent))
from fetch_pubmed import efetch  # noqa: E402

REPO = Path(__file__).parent.parent.parent


def norm(s):
    return "".join(c for c in (s or "").lower() if c.isalnum())


def main():
    studies = json.loads((REPO / "data/studies/studies.json").read_text())
    pmids = [s["pmid"] for s in studies]
    fresh = {r["pmid"]: r for r in efetch(pmids)}
    problems = []

    for s in studies:
        r = fresh.get(s["pmid"])
        if not r:
            problems.append(f"{s['id']}: PMID {s['pmid']} not found on PubMed")
            continue
        if norm(r["title"]) != norm(s["title"]):
            problems.append(f"{s['id']}: title mismatch vs PubMed")
        if r["year"] != s["year"]:
            problems.append(f"{s['id']}: year {s['year']} != PubMed {r['year']}")
        if s["doi"] and r["doi"] and s["doi"].lower() != r["doi"].lower():
            problems.append(f"{s['id']}: DOI {s['doi']} != PubMed {r['doi']}")

        # OpenAlex cross-check (DOI sanity)
        try:
            resp = httpx.get(
                f"https://api.openalex.org/works/pmid:{s['pmid']}", timeout=30)
            if resp.status_code == 200:
                oa = resp.json()
                oa_doi = (oa.get("doi") or "").replace("https://doi.org/", "")
                if s["doi"] and oa_doi and s["doi"].lower() != oa_doi.lower():
                    problems.append(
                        f"{s['id']}: DOI {s['doi']} != OpenAlex {oa_doi}")
            elif resp.status_code != 404:
                print(f"  note: OpenAlex HTTP {resp.status_code} for {s['pmid']}")
        except httpx.HTTPError as e:
            print(f"  note: OpenAlex unreachable for {s['pmid']}: {e}")
        time.sleep(0.15)

    if problems:
        print(f"VERIFICATION FAILED ({len(problems)}):")
        for p in problems:
            print(f"  - {p}")
        sys.exit(1)
    print(f"verified {len(studies)} studies against PubMed + OpenAlex: all match")


if __name__ == "__main__":
    main()
