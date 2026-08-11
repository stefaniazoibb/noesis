"""Automated meta-analytic association maps (roadmap #12, ML v1).

For each disorder, NeuroQuery (Dockès et al., eLife 2020; BSD-3-Clause code
and data) produces a text-conditioned meta-analytic z-map in MNI152 space.
We aggregate each map to the atlas regions using fsaverage's own
aparc+aseg.mgz volume (same subject as our meshes) and ship the result as
RegionScalarMap artifacts.

These maps are MODEL-GENERATED from literature text mining. They are a
separate evidence stratum from the curated corpus and are labeled as such
everywhere they appear (docs/NOESIS_SCIENTIFIC_RULES.md §1/§4).

Alignment note: fsaverage voxel RAS is ≈MNI305; NeuroQuery maps are MNI152.
We apply FreeSurfer's standard MNI305->MNI152 affine before sampling; the
residual error (~1-2 mm) is small relative to the smoothness of the maps
and is recorded in the provenance limitations.

Outputs: data/metamaps/<disorder>.metamap.json (+ mirror in public/metamaps/).
"""

import json
from datetime import date
from pathlib import Path

import nibabel as nib
import numpy as np

HERE = Path(__file__).parent
REPO = HERE.parent.parent
DATA = REPO / "data"
OUT = DATA / "metamaps"
PUBLIC = REPO / "public" / "metamaps"
FSAVERAGE = Path.home() / "mne_data/MNE-fsaverage-data/fsaverage"

# FreeSurfer's documented MNI305 -> MNI152 affine
MNI305_TO_MNI152 = np.array(
    [
        [0.9975, -0.0073, 0.0176, -0.0429],
        [0.0146, 1.0009, -0.0024, 1.5496],
        [-0.0130, -0.0093, 0.9971, 1.1840],
        [0.0, 0.0, 0.0, 1.0],
    ]
)

# aparc+aseg label id -> atlas region id (cortical: 1000+lh idx / 2000+rh idx)
SUBCORTICAL = {
    10: "sub_lh_thalamus", 11: "sub_lh_caudate", 12: "sub_lh_putamen",
    13: "sub_lh_pallidum", 17: "sub_lh_hippocampus", 18: "sub_lh_amygdala",
    26: "sub_lh_accumbens", 49: "sub_rh_thalamus", 50: "sub_rh_caudate",
    51: "sub_rh_putamen", 52: "sub_rh_pallidum", 53: "sub_rh_hippocampus",
    54: "sub_rh_amygdala", 58: "sub_rh_accumbens", 16: "sub_mid_brainstem",
}


def region_label_map() -> dict[int, str]:
    atlas = json.loads((DATA / "atlases/atlas.dk.json").read_text())
    out = dict(SUBCORTICAL)
    # cortical ids follow FreeSurfer's aparc+aseg convention using the annot
    # row order; reconstruct from the atlas sourceName ordering per hemisphere
    _, _, names = nib.freesurfer.read_annot(
        str(FSAVERAGE / "label" / "lh.aparc.annot")
    )
    names = [n.decode() for n in names]
    known = {
        (r["hemisphere"], r["sourceName"]): r["id"]
        for r in atlas["regions"]
        if r["kind"] == "cortical"
    }
    for row, name in enumerate(names):
        for hemi_word, base in (("left", 1000), ("right", 2000)):
            rid = known.get((hemi_word, name))
            if rid:
                out[base + row] = rid
    return out


def main():
    from neuroquery import fetch_neuroquery_model, NeuroQueryModel

    OUT.mkdir(exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)

    disorders = json.loads((DATA / "disorders/disorders.json").read_text())
    encoder = NeuroQueryModel.from_data_dir(fetch_neuroquery_model())

    aseg = nib.load(str(FSAVERAGE / "mri" / "aparc+aseg.mgz"))
    labels = np.asarray(aseg.dataobj)
    vox2ras = aseg.header.get_vox2ras()
    label_to_region = region_label_map()

    # precompute MNI152 coordinates of every labeled voxel, grouped by region
    voxel_regions: dict[str, np.ndarray] = {}
    for label_id, region_id in label_to_region.items():
        idx = np.argwhere(labels == label_id)
        if idx.size == 0:
            continue
        homog = np.c_[idx, np.ones(len(idx))]
        mni152 = (MNI305_TO_MNI152 @ (vox2ras @ homog.T)).T[:, :3]
        voxel_regions[region_id] = mni152

    for d in disorders:
        result = encoder(d["name"])
        zmap = result["brain_map"]
        zdata = np.asarray(zmap.dataobj)
        inv = np.linalg.inv(zmap.affine)

        values: dict[str, float] = {}
        for region_id, coords in voxel_regions.items():
            homog = np.c_[coords, np.ones(len(coords))]
            ijk = np.rint((inv @ homog.T).T[:, :3]).astype(int)
            shape = zdata.shape
            ok = np.all((ijk >= 0) & (ijk < shape), axis=1)
            if not ok.any():
                continue
            vals = zdata[ijk[ok, 0], ijk[ok, 1], ijk[ok, 2]]
            values[region_id] = round(float(np.mean(vals)), 4)

        artifact = {
            "artifactId": f"neuroquery_{d['id']}_v1",
            "atlas": "dk",
            "values": values,
            "metricDef": (
                f"Mean NeuroQuery meta-analytic association z-value for the "
                f"query \"{d['name']}\" across each region's voxels. "
                "MODEL-GENERATED from automated literature text mining "
                "(Dockès et al., eLife 2020) — a separate evidence stratum "
                "from the curated corpus; not individual studies, not "
                "diagnostic."
            ),
            "provenance": {
                "method": (
                    "NeuroQuery model (neuroquery_data, BSD-3-Clause), query = "
                    "disorder name; sampled via fsaverage aparc+aseg with the "
                    "standard MNI305->MNI152 affine (~1-2mm residual). "
                    "See data/provenance/neuroquery.json."
                ),
                "corpusVersion": None,
                "created": date.today().isoformat(),
            },
        }
        out_name = f"{d['id']}.metamap.json"
        (OUT / out_name).write_text(json.dumps(artifact, indent=2))
        (PUBLIC / out_name).write_text(json.dumps(artifact, indent=2))
        top = sorted(values.items(), key=lambda kv: -kv[1])[:3]
        print(f"{d['id']}: {len(values)} regions; top: "
              + ", ".join(f"{r}={v:.2f}" for r, v in top))

    (DATA / "provenance/neuroquery.json").write_text(
        json.dumps(
            {
                "dataset": "NeuroQuery meta-analytic model",
                "description": "Text-conditioned meta-analytic brain maps generated per disorder name and aggregated to atlas regions.",
                "origin": "neuroquery Python package + neuroquery_data model (github.com/neuroquery)",
                "citation": "Dockès J et al. NeuroQuery, comprehensive meta-analysis of human brain mapping. eLife 9:e53385 (2020). doi:10.7554/eLife.53385",
                "license": "BSD-3-Clause (code and data), verified 2026-08-11",
                "retrievedDate": date.today().isoformat(),
                "limitations": [
                    "Model-generated from literature text mining — not curated studies; displayed as a separate, explicitly labeled evidence stratum.",
                    "MNI305->MNI152 affine approximation (~1-2 mm) when sampling fsaverage voxels.",
                    "Query = disorder display name only; synonym-conditioned maps not yet explored.",
                    "Region aggregation is a mean over voxels; fine-grained peaks within large regions are diluted.",
                ],
            },
            indent=2,
        )
    )
    print("provenance written")


if __name__ == "__main__":
    main()
