"""Human spot-check tooling (roadmap P0.3).

Records which studies a human reviewer has verified, in
verified_by_human.json (survives corpus rebuilds — build_evidence.py reads
it to set curation.verifiedByHuman).

Usage:
  python mark_verified.py --list                 # unreviewed studies
  python mark_verified.py study_a study_b ...    # mark reviewed (today)
  python mark_verified.py --all                  # refuse: review is per-study

After marking, re-run build_evidence.py and `npm run validate:data`.
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


def main():
    args = sys.argv[1:]
    studies = json.loads((REPO / "data/studies/studies.json").read_text())
    ids = {s["id"] for s in studies}
    verified = load_verified()

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
