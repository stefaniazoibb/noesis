"""Assemble final atlas metadata and install mesh assets into the app.

Merges the cortical and subcortical metadata fragments into
data/atlases/atlas.dk.json and copies GLBs + sidecars to public/meshes/.
Run after build_cortex.py and build_subcortical.py.
"""

import json
import shutil
import sys
from pathlib import Path

HERE = Path(__file__).parent
OUT = HERE / "out"
REPO = HERE.parent.parent
MESHES = REPO / "public" / "meshes"
ATLAS = REPO / "data" / "atlases" / "atlas.dk.json"


def main():
    cortex = json.loads((OUT / "atlas_cortex.json").read_text())
    sub = json.loads((OUT / "atlas_subcortical.json").read_text())
    regions = cortex + sub

    ids = [r["id"] for r in regions]
    if len(ids) != len(set(ids)):
        sys.exit("ERROR: duplicate region ids in atlas")

    atlas = {
        "atlas": "dk",
        "name": "Desikan-Killiany (fsaverage) + aseg subcortical",
        "space": "fsaverage_surface_RAS",
        "source": "FreeSurfer fsaverage via MNE-Python; see data/provenance/",
        "regions": regions,
    }
    ATLAS.parent.mkdir(parents=True, exist_ok=True)
    ATLAS.write_text(json.dumps(atlas, indent=2))

    MESHES.mkdir(parents=True, exist_ok=True)
    installed = []
    for f in sorted(OUT.glob("*.glb")) + sorted(OUT.glob("*.regions.json")):
        shutil.copy2(f, MESHES / f.name)
        installed.append(f.name)

    total = sum((MESHES / n).stat().st_size for n in installed)
    print(f"atlas: {len(regions)} regions "
          f"({sum(1 for r in regions if r['kind'] == 'cortical')} cortical, "
          f"{sum(1 for r in regions if r['kind'] == 'subcortical')} subcortical)")
    print(f"installed {len(installed)} asset files, {total / 1e6:.2f} MB total")
    print(f"-> {ATLAS.relative_to(REPO)}")


if __name__ == "__main__":
    main()
