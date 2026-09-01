"""Human spot-check tooling (roadmap P0.3).

Records which studies a human reviewer has verified, in
verified_by_human.json (survives corpus rebuilds — build_evidence.py reads
it to set curation.verifiedByHuman).

Usage:
  python mark_verified.py --list                 # unreviewed studies
  python mark_verified.py --show study_a         # full review context for one
  python mark_verified.py --show-next            # same, for the first pending
  python mark_verified.py study_a study_b ...    # mark reviewed (today)
  python mark_verified.py --all                  # refuse: review is per-study

--show prints the study record, its assertions, and the cached PubMed
abstract side by side; review = confirm each assertion is supported by the
abstract. After marking, re-run build_evidence.py and `npm run validate:data`.
"""

import json
import sys
from datetime import date
from pathlib import Path

HERE = Path(__file__).parent
REPO = HERE.parent.parent
VERIFIED = HERE / "verified_by_human.json"


def load_verified() -> dict:
    if VERIFIED.exists():
        return json.loads(VERIFIED.read_text())
    return {}


def show_study(study: dict, verified: dict) -> None:
    assertions = [
        a for a in json.loads(
            (REPO / "data/evidence/assertions.json").read_text())
        if a["studyId"] == study["id"]
    ]
    status = (f"verified {verified[study['id']]}" if study["id"] in verified
              else "PENDING review")
    print(f"{study['id']}  [{status}]")
    print(f"  {study['title']}")
    print(f"  {study.get('journal', '?')} {study['year']}  "
          f"PMID {study['pmid']}  DOI {study['doi']}")
    print(f"  https://pubmed.ncbi.nlm.nih.gov/{study['pmid']}/")
    print(f"\n  Assertions to confirm against the abstract "
          f"({len(assertions)}):")
    for a in assertions:
        print(f"   - [{a['modality']}] {a['disorder']} / {a['region']}: "
              f"{a['findingType']} {a['direction'] or '(no direction)'} "
              f"({a['causalSupport']})")
        print(f"     \"{a['statement']}\"")
    cache = HERE / "cache" / f"pmid_{study['pmid']}.json"
    if cache.exists():
        abstract = json.loads(cache.read_text()).get("abstract") or ""
        print(f"\n  Cached abstract ({cache.name}):")
        for para in abstract.split("\n"):
            print(f"    {para}")
    else:
        print("\n  WARNING: no cached abstract — review via the PubMed link.")
    print(f"\n  When confirmed:  python mark_verified.py {study['id']}")


def main():
    args = sys.argv[1:]
    studies = json.loads((REPO / "data/studies/studies.json").read_text())
    ids = {s["id"] for s in studies}
    verified = load_verified()

    if args and args[0] in ("--show", "--show-next"):
        if args[0] == "--show-next":
            pending = [s for s in studies if s["id"] not in verified]
            if not pending:
                print("All studies verified.")
                return
            show_study(pending[0], verified)
            return
        if len(args) != 2 or args[1] not in ids:
            sys.exit(f"Usage: mark_verified.py --show <study_id>; "
                     f"unknown: {args[1:]}")
        show_study(next(s for s in studies if s["id"] == args[1]), verified)
        return

    if not args or args == ["--list"]:
        pending = [s for s in studies if s["id"] not in verified]
        print(f"{len(verified)}/{len(studies)} studies human-verified. Pending:")
        for s in pending:
            print(f"  {s['id']}: {s['title'][:90]}")
        return

    if args == ["--all"]:
        sys.exit("Refusing --all: human verification is a per-study review, "
                 "not a bulk flag (docs/NOESIS_SCIENTIFIC_RULES.md §6).")

    unknown = [a for a in args if a not in ids]
    if unknown:
        sys.exit(f"ERROR: unknown study ids: {unknown}")
    today = date.today().isoformat()
    for sid in args:
        verified[sid] = today
    VERIFIED.write_text(json.dumps(verified, indent=2, sort_keys=True) + "\n")
    print(f"marked {len(args)} studies verified ({today}); "
          f"{len(verified)}/{len(studies)} total.")
    print("Now run: build_evidence.py && npm run validate:data")


if __name__ == "__main__":
    main()
