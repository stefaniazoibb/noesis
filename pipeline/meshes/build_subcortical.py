"""Build subcortical structure meshes from fsaverage aseg.mgz.

Per structure: binary mask -> marching cubes -> Taubin smoothing -> decimation
-> GLB. Vertices are mapped to FreeSurfer surface RAS via the vox2ras_tkr
affine, i.e. the exact frame of the pial surfaces from build_cortex.py.

Outputs (out/):
  sub_<id>.glb              one per structure
  subcortical.regions.json  structure table for the viewer
  atlas_subcortical.json    region metadata fragment
  report_subcortical.json   validation report
"""

import json
import sys
from pathlib import Path

import numpy as np
import nibabel as nib
import trimesh
from fast_simplification import simplify
from skimage.measure import marching_cubes

OUT = Path(__file__).parent / "out"
TARGET_FACES = 4_000

# FreeSurfer LUT ids for the structures we ship (standard aseg labels)
STRUCTURES = [
    (10, "sub_lh_thalamus", "Thalamus", "left"),
    (11, "sub_lh_caudate", "Caudate nucleus", "left"),
    (12, "sub_lh_putamen", "Putamen", "left"),
    (13, "sub_lh_pallidum", "Globus pallidus", "left"),
    (17, "sub_lh_hippocampus", "Hippocampus", "left"),
    (18, "sub_lh_amygdala", "Amygdala", "left"),
    (26, "sub_lh_accumbens", "Nucleus accumbens", "left"),
    (49, "sub_rh_thalamus", "Thalamus", "right"),
    (50, "sub_rh_caudate", "Caudate nucleus", "right"),
    (51, "sub_rh_putamen", "Putamen", "right"),
    (52, "sub_rh_pallidum", "Globus pallidus", "right"),
    (53, "sub_rh_hippocampus", "Hippocampus", "right"),
    (54, "sub_rh_amygdala", "Amygdala", "right"),
    (58, "sub_rh_accumbens", "Nucleus accumbens", "right"),
    (16, "sub_mid_brainstem", "Brainstem", "midline"),
]

SYSTEMS = {
    "Thalamus": "diencephalon",
    "Caudate nucleus": "basal_ganglia",
    "Putamen": "basal_ganglia",
    "Globus pallidus": "basal_ganglia",
    "Hippocampus": "limbic",
    "Amygdala": "limbic",
    "Nucleus accumbens": "basal_ganglia",
    "Brainstem": "brainstem",
}

# display palette (not scientific data; grouped by system)
COLORS = {
    "diencephalon": "#7a9e9f",
    "basal_ganglia": "#b0847a",
    "limbic": "#8f7ab0",
    "brainstem": "#9a9a86",
}


def build_structure(data, vox2ras_tkr, label, region_id, name, hemi):
    mask = (data == label)
    nvox = int(mask.sum())
    if nvox == 0:
        sys.exit(f"ERROR: aseg contains no voxels for label {label} ({region_id})")

    verts, faces, _, _ = marching_cubes(mask.astype(np.uint8), level=0.5)
    ras = nib.affines.apply_affine(vox2ras_tkr, verts)

    mesh = trimesh.Trimesh(vertices=ras, faces=faces, process=True)
    trimesh.smoothing.filter_taubin(mesh, lamb=0.5, nu=-0.53, iterations=10)

    if len(mesh.faces) > TARGET_FACES:
        v, f = simplify(
            mesh.vertices.astype(np.float32), mesh.faces.astype(np.int64),
            target_reduction=1.0 - TARGET_FACES / len(mesh.faces),
        )
        mesh = trimesh.Trimesh(vertices=v, faces=f, process=False)
    mesh.fix_normals()

    glb = OUT / f"{region_id}.glb"
    mesh.export(str(glb))

    system = SYSTEMS[name]
    meta = {
        "id": region_id, "atlas": "dk", "sourceName": f"aseg_{label}",
        "name": name, "hemisphere": hemi, "kind": "subcortical",
        "system": system, "color": COLORS[system],
    }
    report = {
        "id": region_id, "asegLabel": label, "voxels": nvox,
        "verts": len(mesh.vertices), "faces": len(mesh.faces),
        "glbBytes": glb.stat().st_size,
        "bbox": [mesh.bounds[0].tolist(), mesh.bounds[1].tolist()],
    }
    return meta, report


def main():
    OUT.mkdir(exist_ok=True)
    import mne
    fs_dir = Path(mne.datasets.fetch_fsaverage(verbose=False))
    aseg_path = fs_dir / "mri" / "aseg.mgz"
    if not aseg_path.exists():
        sys.exit(f"ERROR: {aseg_path} not found — aseg not in the MNE fsaverage "
                 "bundle; use the Harvard-Oxford fallback (see ARCHITECTURE.md §3)")

    img = nib.load(str(aseg_path))
    data = np.asarray(img.dataobj)
    vox2ras_tkr = img.header.get_vox2ras_tkr()
    print(f"aseg: shape {data.shape}, labels present: {len(np.unique(data))}")

    metas, reports = [], []
    for label, region_id, name, hemi in STRUCTURES:
        meta, report = build_structure(data, vox2ras_tkr, label, region_id, name, hemi)
        metas.append(meta)
        reports.append(report)
        print(f"  {region_id}: {report['verts']} verts, "
              f"{report['glbBytes'] // 1024} KB")

    (OUT / "atlas_subcortical.json").write_text(json.dumps(metas, indent=2))
    (OUT / "subcortical.regions.json").write_text(json.dumps(
        {"atlas": "dk", "structures": [m["id"] for m in metas]}))
    (OUT / "report_subcortical.json").write_text(json.dumps(reports, indent=2))
    print("subcortical build OK")


if __name__ == "__main__":
    main()
