"""Network-membership ingestion (roadmap #10).

Computes Desikan-Killiany -> Yeo 2011 7-network memberships on fsaverage:
both parcellations are defined on the same registered surface, so membership
is vertex overlap — no hand assignment anywhere.

Method (documented in the emitted membershipSource):
1. Download the plain 7-network annots (fsaverage5) from the CBIG repository
   (Yeo et al. 2011, J Neurophysiol 106:1125-1165; MIT-licensed repo),
   cache verbatim with SHA-256 recorded in the provenance file.
2. Upsample fsaverage5 labels to fsaverage (163,842 verts/hemisphere) by
   nearest-neighbor on the registered sphere, seeding from the first 10,242
   fsaverage sphere vertices (fsaverage5's vertices are the first 10,242 of
   fsaverage — nested icosahedral subdivisions).
3. For each cortical DK region: network fractions among network-labeled
   vertices; PRIMARY assignment = argmax fraction, kept only if >= 25%.
   Full fraction matrix goes to report.json for transparency.
4. Emit data/networks/networks.json (7 networks, canonical Yeo colors from
   the annot color table) + data/provenance/yeo2011.json.

Subcortical structures get no membership (Yeo is cortical-only).
"""

import hashlib
import json
from datetime import date
from pathlib import Path

import httpx
import nibabel as nib
import numpy as np
from scipy.spatial import cKDTree

HERE = Path(__file__).parent
CACHE = HERE / "cache"
REPO = HERE.parent.parent
FSAVERAGE = Path.home() / "mne_data/MNE-fsaverage-data/fsaverage"

BASE_URL = (
    "https://raw.githubusercontent.com/ThomasYeoLab/CBIG/master/stable_projects/"
    "brain_parcellation/Yeo2011_fcMRI_clustering/1000subjects_reference/"
    "Yeo_JNeurophysiol11_SplitLabels/fsaverage5/label"
)
MIN_PRIMARY_FRACTION = 0.25
FS5_N_VERTS = 10242

# Yeo network index (annot ctab order 1..7) -> NOĒSIS network id + metadata.
NETWORKS = {
    1: ("visual_network", "Visual network",
        "Primary and higher-order visual cortex.",
        ["VIS", "visual system"]),
    2: ("somatomotor_network", "Somatomotor network",
        "Sensorimotor cortex spanning precentral and postcentral regions.",
        ["SMN", "sensorimotor network", "motor network"]),
    3: ("dorsal_attention_network", "Dorsal attention network",
        "A network supporting top-down, goal-directed attention.",
        ["DAN", "dorsal attention"]),
    4: ("salience_network", "Salience / ventral attention network",
        "A network implicated in detecting behaviorally relevant stimuli and coordinating switching between large-scale networks.",
        ["SN", "ventral attention network", "cingulo-opercular network", "VAN"]),
    5: ("limbic_network", "Limbic network",
        "A grouping of temporopolar and orbitofrontal cortex involved in affect and memory.",
        ["limbic system network"]),
    6: ("frontoparietal_control_network", "Frontoparietal control network",
        "A network associated with executive control and adaptive task processing.",
        ["FPCN", "central executive network", "CEN", "executive control network", "control network"]),
    7: ("default_mode_network", "Default mode network",
        "A large-scale network engaged during rest and internally directed cognition.",
        ["DMN", "default network"]),
}

MEMBERSHIP_SOURCE = (
    "Computed primary membership: highest vertex-overlap (>=25% of "
    "network-labeled vertices) between the Desikan-Killiany aparc parcellation "
    "and the Yeo 2011 7-network parcellation, both on the fsaverage surface "
    "(fsaverage5 annot nearest-neighbor upsampled on the registered sphere). "
    "Source: Yeo et al., J Neurophysiol 106:1125-1165 (2011), via the CBIG "
    "repository. Full overlap fractions: pipeline/networks/report.json. "
    "Cortical regions only."
)


def fetch(name: str) -> Path:
    path = CACHE / name
    if not path.exists():
        r = httpx.get(f"{BASE_URL}/{name}", timeout=60, follow_redirects=True)
        r.raise_for_status()
        path.write_bytes(r.content)
    return path


def main():
    CACHE.mkdir(exist_ok=True)
    files: dict[str, str] = {}
    fractions: dict[str, dict[str, float]] = {}
    members: dict[int, list[str]] = {k: [] for k in NETWORKS}
    colors: dict[int, str] = {}

    for hemi in ("lh", "rh"):
        annot_name = f"{hemi}.Yeo2011_7Networks_N1000.annot"
        annot_path = fetch(annot_name)
        files[annot_name] = hashlib.sha256(annot_path.read_bytes()).hexdigest()

        yeo5, yeo_ctab, yeo_names = nib.freesurfer.read_annot(str(annot_path))
        assert len(yeo5) == FS5_N_VERTS, f"unexpected fsaverage5 size: {len(yeo5)}"
        expected = [b"7Networks_%d" % i for i in range(1, 8)]
        assert yeo_names[1:] == expected, f"unexpected network names: {yeo_names}"
        for i in range(1, 8):
            r, g, b = (int(v) for v in yeo_ctab[i][:3])
            colors[i] = f"#{r:02x}{g:02x}{b:02x}"

        sphere, _ = nib.freesurfer.read_geometry(
            str(FSAVERAGE / "surf" / f"{hemi}.sphere.reg")
        )
        dk_labels, _, dk_names = nib.freesurfer.read_annot(
            str(FSAVERAGE / "label" / f"{hemi}.aparc.annot")
        )
        dk_names = [n.decode() for n in dk_names]

        # NN upsample: fsaverage5 verts are the first 10,242 fsaverage verts
        tree = cKDTree(sphere[:FS5_N_VERTS])
        _, nearest = tree.query(sphere)
        yeo_full = yeo5[nearest]

        for row, name in enumerate(dk_names):
            if name in ("unknown", "corpuscallosum"):
                continue
            region_id = f"dk_{hemi}_{name}"
            mask = dk_labels == row
            labeled = yeo_full[mask]
            labeled = labeled[labeled > 0]  # drop medial wall / unlabeled
            if labeled.size == 0:
                fractions[region_id] = {}
                continue
            frac = {
                NETWORKS[i][0]: round(float((labeled == i).sum() / labeled.size), 4)
                for i in range(1, 8)
            }
            fractions[region_id] = frac
            best = int(np.bincount(labeled).argmax())
            if frac[NETWORKS[best][0]] >= MIN_PRIMARY_FRACTION:
                members[best].append(region_id)

    networks = [
        {
            "id": nid,
            "name": label,
            "description": desc,
            "regions": sorted(members[idx]),
            "membershipSource": MEMBERSHIP_SOURCE,
            "color": colors[idx],
            "synonyms": syns,
        }
        for idx, (nid, label, desc, syns) in NETWORKS.items()
    ]
    (REPO / "data/networks/networks.json").write_text(
        json.dumps(networks, indent=2, ensure_ascii=False) + "\n"
    )
    (HERE / "report.json").write_text(
        json.dumps(
            {"minPrimaryFraction": MIN_PRIMARY_FRACTION, "fractions": fractions},
            indent=2,
        )
    )
    (REPO / "data/provenance/yeo2011.json").write_text(
        json.dumps(
            {
                "dataset": "Yeo 2011 7-network parcellation (fsaverage5 annot)",
                "description": "Functional network parcellation from 1000-subject resting-state clustering; used to compute primary DK-region network memberships by vertex overlap on fsaverage.",
                "origin": "CBIG repository (ThomasYeoLab/CBIG), Yeo_JNeurophysiol11_SplitLabels/fsaverage5/label",
                "citation": "Yeo BT et al. The organization of the human cerebral cortex estimated by intrinsic functional connectivity. J Neurophysiol 106:1125-1165 (2011).",
                "license": "CBIG repository MIT license; parcellation data freely available with citation",
                "retrievedDate": date.today().isoformat(),
                "files": files,
                "method": MEMBERSHIP_SOURCE,
                "limitations": [
                    "Cortical only — subcortical structures receive no network membership.",
                    "DK regions are coarse relative to network boundaries; primary assignment discards secondary overlaps (recorded in report.json).",
                    "fsaverage5-to-fsaverage nearest-neighbor upsampling smooths network borders slightly.",
                ],
            },
            indent=2,
        )
    )

    print(f"networks.json written; memberships (threshold {MIN_PRIMARY_FRACTION}):")
    for idx, (nid, label, *_r) in NETWORKS.items():
        print(f"  {label}: {len(members[idx])} regions")
    # sanity: canonical correspondences
    # NOTE: DK 'posteriorcingulate' is dorsal PCC/mid-cingulate territory
    # (largely Yeo ventral-attention); the DMN's classic PCC core is DK
    # 'isthmuscingulate' — the probe below reflects that.
    for probe, expect in [
        ("dk_lh_precentral", "somatomotor_network"),
        ("dk_lh_lateraloccipital", "visual_network"),
        ("dk_lh_isthmuscingulate", "default_mode_network"),
        ("dk_lh_superiorparietal", "dorsal_attention_network"),
        ("dk_lh_temporalpole", "limbic_network"),
    ]:
        f = fractions.get(probe, {})
        top = max(f, key=f.get) if f else "n/a"
        print(f"  sanity {probe}: top={top} ({f.get(top, 0):.2f}) "
              f"{'OK' if top == expect else 'UNEXPECTED (expected ' + expect + ')'}")


if __name__ == "__main__":
    main()
