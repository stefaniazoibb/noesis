"""Build web-ready cortical meshes from FreeSurfer fsaverage + Desikan-Killiany.

Pipeline per hemisphere:
  fsaverage pial (163,842 verts) + aparc.annot
    -> decimate to ~18k verts (fast_simplification)
    -> transfer region labels to decimated verts by nearest neighbor (cKDTree)
    -> export GLB (positions/normals/indices) + sidecar vertex->region map JSON

Outputs (out/):
  cortex_lh.glb, cortex_rh.glb
  cortex_lh.regions.json, cortex_rh.regions.json
  atlas_cortex.json          (region metadata fragment, merged by build_atlas.py)
  report_cortex.json         (validation report)

Coordinates stay in FreeSurfer surface RAS; the viewer applies the axis-up fix.
"""

import json
import sys
from pathlib import Path

import numpy as np
import nibabel as nib
import trimesh
from fast_simplification import simplify
from scipy.spatial import cKDTree

from dk_names import DISPLAY_NAMES, LOBE_OF, NON_REGIONS

TARGET_VERTS = 18_000
OUT = Path(__file__).parent / "out"


def fetch_fsaverage_dir() -> Path:
    import mne
    path = Path(mne.datasets.fetch_fsaverage(verbose=True))
    # fetch_fsaverage returns <subjects_dir>/fsaverage
    return path


def build_hemi(fs_dir: Path, hemi: str) -> dict:
    surf_path = fs_dir / "surf" / f"{hemi}.pial"
    annot_path = fs_dir / "label" / f"{hemi}.aparc.annot"
    for p in (surf_path, annot_path):
        if not p.exists():
            sys.exit(f"ERROR: required file missing: {p}")

    coords, faces = nib.freesurfer.read_geometry(str(surf_path))
    labels, ctab, names = nib.freesurfer.read_annot(str(annot_path))
    names = [n.decode() for n in names]
    print(f"[{hemi}] pial: {len(coords)} verts, {len(faces)} faces; "
          f"annot: {len(names)} labels")

    unknown_names = set(names) - set(DISPLAY_NAMES) - NON_REGIONS
    if unknown_names:
        sys.exit(f"ERROR: annot contains unmapped region names: {unknown_names}")

    reduction = 1.0 - (TARGET_VERTS / len(coords))
    dec_coords, dec_faces = simplify(
        coords.astype(np.float32), faces.astype(np.int64),
        target_reduction=reduction,
    )
    print(f"[{hemi}] decimated: {len(dec_coords)} verts, {len(dec_faces)} faces")

    # transfer per-vertex annot labels via nearest original vertex
    _, nearest = cKDTree(coords).query(dec_coords)
    dec_labels = labels[nearest]  # ctab row index per decimated vertex, -1 = unlabeled

    # region table: index 0 reserved for background ("none")
    region_ids = ["none"]
    annot_to_region = {}  # ctab row -> region table index
    for row, name in enumerate(names):
        if name in NON_REGIONS:
            annot_to_region[row] = 0
        else:
            annot_to_region[row] = len(region_ids)
            region_ids.append(f"dk_{hemi}_{name}")
    vertex_region = np.array(
        [annot_to_region.get(int(l), 0) for l in dec_labels], dtype=np.uint16
    )

    mesh = trimesh.Trimesh(vertices=dec_coords, faces=dec_faces, process=False)
    mesh.fix_normals()
    glb_path = OUT / f"cortex_{hemi}.glb"
    mesh.export(str(glb_path))

    # round-trip check: exported vertex order must match the sidecar
    reloaded = trimesh.load(str(glb_path), process=False, force="mesh")
    if len(reloaded.vertices) != len(mesh.vertices) or not np.allclose(
        reloaded.vertices, mesh.vertices, atol=1e-4
    ):
        sys.exit(f"ERROR: GLB round-trip changed vertex order for {hemi}")

    sidecar = {
        "atlas": "dk",
        "hemi": hemi,
        "regionIndexToId": region_ids,
        "vertexRegion": vertex_region.tolist(),
    }
    (OUT / f"cortex_{hemi}.regions.json").write_text(json.dumps(sidecar))

    counts = np.bincount(vertex_region, minlength=len(region_ids))
    empty = [region_ids[i] for i in range(1, len(region_ids)) if counts[i] == 0]
    if empty:
        sys.exit(f"ERROR: regions with zero vertices after decimation: {empty}")

    # metadata fragment (colors from the annot color table)
    regions_meta = []
    for row, name in enumerate(names):
        if name in NON_REGIONS:
            continue
        r, g, b = (int(v) for v in ctab[row][:3])
        regions_meta.append({
            "id": f"dk_{hemi}_{name}",
            "atlas": "dk",
            "sourceName": name,
            "name": DISPLAY_NAMES[name],
            "hemisphere": "left" if hemi == "lh" else "right",
            "kind": "cortical",
            "system": LOBE_OF[name],
            "color": f"#{r:02x}{g:02x}{b:02x}",
        })

    return {
        "hemi": hemi,
        "verts": len(dec_coords),
        "faces": len(dec_faces),
        "glbBytes": glb_path.stat().st_size,
        "regions": len(region_ids) - 1,
        "backgroundVerts": int(counts[0]),
        "minRegionVerts": int(counts[1:].min()),
        "bbox": [mesh.bounds[0].tolist(), mesh.bounds[1].tolist()],
        "regionsMeta": regions_meta,
    }


def main():
    OUT.mkdir(exist_ok=True)
    fs_dir = fetch_fsaverage_dir()
    print(f"fsaverage at: {fs_dir}")

    reports = [build_hemi(fs_dir, h) for h in ("lh", "rh")]

    atlas_fragment = [r for rep in reports for r in rep.pop("regionsMeta")]
    (OUT / "atlas_cortex.json").write_text(json.dumps(atlas_fragment, indent=2))
    (OUT / "report_cortex.json").write_text(json.dumps(reports, indent=2))
    for rep in reports:
        print(json.dumps(rep, indent=2))
    print("cortex build OK")


if __name__ == "__main__":
    main()
