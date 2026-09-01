"""Real-modality MRI encoder v1: FreeSurfer morphometry from UCLA CNP.

Dataset: OpenNeuro ds000030 (UCLA Consortium for Neuropsychiatric Phenomics
LA5c; CC0; DOI 10.18112/openneuro.ds000030.v1.0.0) — 130 controls, 50
schizophrenia, 49 bipolar, 43 ADHD (participants.tsv; slightly fewer have
usable T1w/FreeSurfer runs). We use ONLY the published FreeSurfer stats
tables from the curators' derivatives (Gorgolewski et al., F1000Research
2017) — per-subject aparc (Desikan-Killiany, NOESIS's own atlas) and aseg
summaries, a few KB each; no raw MRI is downloaded.

Features: one vector per subject — 68 DK cortical mean thicknesses +
subcortical volumes / eTIV, columns keyed to NOESIS atlas region ids.
Confounds: age + gender are residualized out per fold (confound model fit
on train only, applied to held-out subjects — no leakage). Evaluation:
patient-vs-control ROC-AUC per diagnosis (LOSO, label-permutation refit of
the full loop, subject-bootstrap CIs) as a representation sanity check —
NOT diagnosis. Payload: aggregate age/gender-adjusted group effect sizes
per region (Cohen's d, control minus patient) — aggregate statistics only.

Run: python pipeline/encoders/build_mri_encoder.py   (conda env `noesis`;
stats under pipeline/encoders/raw/ds000030/, gitignored)
"""

from datetime import date
from pathlib import Path
import csv
import json
import sys

import numpy as np
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mlruns"))
from common import DATA, load_json, write_run  # noqa: E402

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "ds000030"
PARTICIPANTS = HERE / "raw" / "cnp_participants.tsv"

SEED = 42
# 500 (not 1000): each permutation refits a ~180-subject LOSO loop; the
# p-value floor of 1/501 is far below any threshold used here
N_PERMUTATIONS = 500
N_BOOTSTRAP = 2000
COMPARISONS = {"SCHZ": "schizophrenia", "BIPOLAR": "bipolar_disorder",
               "ADHD": "adhd"}


def parse_aparc(path: Path) -> dict[str, float]:
    """StructName -> mean thickness (ThickAvg column)."""
    out = {}
    for line in path.read_text().splitlines():
        if line.startswith("#"):
            continue
        cols = line.split()
        if len(cols) >= 5:
            out[cols[0]] = float(cols[4])
    return out


def parse_aseg(path: Path) -> tuple[dict[int, float], float]:
    """SegId -> volume mm3, plus eTIV."""
    vols, etiv = {}, None
    for line in path.read_text().splitlines():
        if "EstimatedTotalIntraCranialVol" in line:
            etiv = float(line.split(",")[-2])
        if line.startswith("#"):
            continue
        cols = line.split()
        if len(cols) >= 5:
            vols[int(cols[1])] = float(cols[3])
    if etiv is None:
        raise ValueError(f"no eTIV in {path}")
    return vols, etiv


def subject_features(sub_dir: Path, regions: list[dict]) -> np.ndarray | None:
    lh = parse_aparc(sub_dir / "lh.aparc.stats")
    rh = parse_aparc(sub_dir / "rh.aparc.stats")
    vols, etiv = parse_aseg(sub_dir / "aseg.stats")
    feats = []
    for r in regions:
        if r["kind"] == "cortical":
            table = lh if r["hemisphere"] == "left" else rh
            if r["sourceName"] not in table:
                return None
            feats.append(table[r["sourceName"]])
        else:
            seg_id = int(r["sourceName"].removeprefix("aseg_"))
            if seg_id not in vols:
                return None
            feats.append(vols[seg_id] / etiv)
    return np.array(feats)


def residualize(train_x, train_c, test_x, test_c):
    """Remove age/gender from features; confound model fit on train only."""
    reg = LinearRegression().fit(train_c, train_x)
    return train_x - reg.predict(train_c), test_x - reg.predict(test_c)


def loso(x, c, y, seed):
    preds = np.zeros(len(y))
    for i in range(len(y)):
        mask = np.ones(len(y), bool)
        mask[i] = False
        xtr, xte = residualize(x[mask], c[mask], x[i:i + 1], c[i:i + 1])
        clf = make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=2000, random_state=seed),
        ).fit(xtr, y[mask])
        preds[i] = clf.predict_proba(xte)[0, 1]
    return float(roc_auc_score(y, preds)), preds


def evaluate(x, c, y, rng, seed):
    auc, preds = loso(x, c, y, seed)
    perm = np.array([loso(x, c, rng.permutation(y), seed)[0]
                     for _ in range(N_PERMUTATIONS)])
    p = float((1 + (perm >= auc).sum()) / (1 + N_PERMUTATIONS))
    boots, idx = [], np.arange(len(y))
    while len(boots) < N_BOOTSTRAP:
        b = rng.choice(idx, len(idx), replace=True)
        if len(np.unique(y[b])) < 2:
            continue
        boots.append(roc_auc_score(y[b], preds[b]))
    return {"auc": round(auc, 4), "perm_p": round(p, 4),
            "ci_low": round(float(np.percentile(boots, 2.5)), 4),
            "ci_high": round(float(np.percentile(boots, 97.5)), 4)}


def cohens_d(a: np.ndarray, b: np.ndarray) -> float:
    """d for (a - b) with pooled SD."""
    na, nb = len(a), len(b)
    sp = np.sqrt(((na - 1) * a.var(ddof=1) + (nb - 1) * b.var(ddof=1))
                 / (na + nb - 2))
    return float((a.mean() - b.mean()) / sp) if sp > 0 else 0.0


def main() -> None:
    atlas = load_json("atlases/atlas.dk.json")
    regions = atlas["regions"]

    rows = list(csv.DictReader(PARTICIPANTS.open(), delimiter="\t"))
    x, c, groups, ids, skipped = [], [], [], [], 0
    for row in rows:
        sub_dir = RAW / row["participant_id"]
        if not sub_dir.exists():
            skipped += 1
            continue
        feats = subject_features(sub_dir, regions)
        if feats is None or row["age"] in ("", "n/a"):
            skipped += 1
            continue
        x.append(feats)
        c.append([float(row["age"]), 1.0 if row["gender"] == "M" else 0.0])
        groups.append(row["diagnosis"])
        ids.append(row["participant_id"])
    x, c, g = np.array(x), np.array(c), np.array(groups)
    counts = {k: int((g == k).sum()) for k in
              ("CONTROL", "SCHZ", "BIPOLAR", "ADHD")}
    print(f"subjects with FreeSurfer stats: {len(g)} {counts} "
          f"(skipped {skipped})")

    rng = np.random.default_rng(SEED)
    results = {}
    for label in COMPARISONS:
        mask = (g == label) | (g == "CONTROL")
        results[label] = evaluate(x[mask], c[mask],
                                  (g[mask] == label).astype(int), rng, SEED)
        print(f"{label} vs CONTROL: AUC {results[label]['auc']} "
              f"(perm p {results[label]['perm_p']}, "
              f"CI [{results[label]['ci_low']}, {results[label]['ci_high']}])")

    # aggregate effect-size payload: full-sample age/gender-adjusted d per
    # region (descriptive map, not the CV analysis)
    adj = x - LinearRegression().fit(c, x).predict(c) + x.mean(axis=0)
    effect_sizes = []
    for label, disorder in COMPARISONS.items():
        pat, cn = adj[g == label], adj[g == "CONTROL"]
        effect_sizes.append({
            "disorder": disorder,
            "nPatients": int((g == label).sum()),
            "nControls": int((g == "CONTROL").sum()),
            "d_control_minus_patient": {
                r["id"]: round(cohens_d(cn[:, i], pat[:, i]), 4)
                for i, r in enumerate(regions)
            },
        })

    run = {
        "runId": "mri_morphometry_cnp_v1",
        "task": "classification",
        "datasetDef": (
            "OpenNeuro ds000030 (UCLA CNP LA5c, CC0, DOI "
            "10.18112/openneuro.ds000030.v1.0.0; Poldrack et al. Sci Data "
            "2016): FreeSurfer stats tables from the curators' derivatives "
            "(Gorgolewski et al. F1000Research 2017) — no raw MRI touched. "
            f"{len(g)} subjects with usable stats: {counts['CONTROL']} "
            f"controls, {counts['SCHZ']} schizophrenia, "
            f"{counts['BIPOLAR']} bipolar, {counts['ADHD']} ADHD. "
            "Classification is a sanity check that the morphometric "
            "representation carries known group signal — NOT diagnosis; "
            "single-dataset effect sizes are not meta-analytic consensus."
        ),
        "splitStrategy": "subject_level",
        "preprocessing": (
            "One vector per subject: 68 DK mean cortical thicknesses + 15 "
            "aseg volumes / eTIV, columns keyed to NOESIS atlas region ids. "
            "Age + gender residualized per fold (confound regression fit on "
            "train only, applied to the held-out subject)."
        ),
        "model": (
            "StandardScaler + L2 logistic regression, leave-one-subject-out "
            f"CV, pooled ROC-AUC; {N_PERMUTATIONS} label permutations "
            "refitting the full LOSO loop (p = (1+#perm>=obs)/(1+N)); "
            f"subject-bootstrap 95% CI ({N_BOOTSTRAP} resamples). "
            "SCHZ/BIPOLAR/ADHD each vs CONTROL."
        ),
        "config": {"seed": SEED, "nPermutations": N_PERMUTATIONS,
                   "nBootstrap": N_BOOTSTRAP, "features": len(regions),
                   "confounds": "age,gender"},
        "metrics": {
            **{f"{k.lower()}_vs_cn_auc": v["auc"]
               for k, v in results.items()},
            **{f"{k.lower()}_vs_cn_perm_p": v["perm_p"]
               for k, v in results.items()},
            "n_subjects": float(len(g)),
        },
        "uncertainty": {
            **{f"{k.lower()}_vs_cn_auc_ci95_low": v["ci_low"]
               for k, v in results.items()},
            **{f"{k.lower()}_vs_cn_auc_ci95_high": v["ci_high"]
               for k, v in results.items()},
        },
        "modelVersion": "v1",
        "created": date.today().isoformat(),
    }
    write_run(run, {"effectSizes": effect_sizes})

    (DATA / "provenance" / "ds000030.json").write_text(json.dumps({
        "source": "OpenNeuro ds000030 (UCLA CNP LA5c)",
        "doi": "10.18112/openneuro.ds000030.v1.0.0",
        "license": "CC0 (verified in dataset_description.json at ingestion, "
                   f"{date.today().isoformat()})",
        "cite": [
            "Poldrack et al., Sci Data 3:160110, 2016, "
            "doi:10.1038/sdata.2016.110",
            "Gorgolewski et al., F1000Research 6:1262, 2017 (derivatives)",
        ],
        "ethics": "UCLA IRB-approved written informed consent "
                  "(per dataset description)",
        "used": "FreeSurfer aparc/aseg stats tables from the published "
                "derivatives only (legacy S3, R1.0.5); raw MRI never "
                "downloaded; artifacts contain aggregate statistics only",
    }, indent=2))
    print("provenance written")


if __name__ == "__main__":
    main()
