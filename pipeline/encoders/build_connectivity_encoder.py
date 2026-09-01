"""Real-modality fMRI connectivity encoder + subject-level multi-view
alignment (UCLA CNP ds000030).

Inputs: fmriprep surface-sampled resting-state BOLD (fsaverage5, ~6.6 MB/
hemisphere) + confounds from the published CNP derivatives (Gorgolewski et
al. 2017) — no volumetric data. DK parcel timeseries come from the
fsaverage aparc annot restricted to its first 10,242 vertices per
hemisphere (fsaverage5 nesting, same trick as pipeline/networks).

Per subject: confound-regressed (6 motion + WhiteMatter + CSF-proxy
aCompCor00 + linear trend), 68x68 Pearson correlation -> Fisher z -> upper
triangle (2,278 features). Exclusions: mean framewise displacement > 0.5 mm
or < 100 usable volumes (counts reported in the manifest; motion differs by
group, so exclusion counts per group are disclosed).

Run 1 (conn_fc_cnp_v1, classification): SCZ/BIPOLAR/ADHD vs CONTROL —
stratified group 10-fold CV (subject-level by construction: one vector per
subject), fold-safe Pipeline(StandardScaler -> PCA-50 -> logistic), pooled
out-of-fold ROC-AUC, label-permutation refits, subject-bootstrap CIs.
Representation sanity check, NOT diagnosis.

Run 2 (alignment_subject_multiview_v1, alignment): the multi-view alignment
NOESIS deferred until two real views shared entities richly — morphometry
(83 features) x connectivity (PCA-50) for the SAME subjects (n ~ 250),
age/gender residualized from both views, CCA + row-permutation test
(subjects are exchangeable rows — no homolog structure at subject level).

Run: python pipeline/encoders/build_connectivity_encoder.py
"""

from datetime import date
from pathlib import Path
import csv
import json
import sys

import numpy as np
import nibabel as nib
import nibabel.freesurfer as fsio
from sklearn.cross_decomposition import CCA
from sklearn.decomposition import PCA
from sklearn.linear_model import LinearRegression, LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.model_selection import StratifiedKFold
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mlruns"))
from common import load_json, write_run  # noqa: E402
from build_mri_encoder import subject_features as morpho_features  # noqa: E402

HERE = Path(__file__).resolve().parent
FUNC = HERE / "raw" / "ds000030_func"
STATS = HERE / "raw" / "ds000030"
PARTICIPANTS = HERE / "raw" / "cnp_participants.tsv"
FSAVERAGE_LABEL = Path.home() / "mne_data/MNE-fsaverage-data/fsaverage/label"

SEED = 42
N_PERMUTATIONS = 1000
N_BOOTSTRAP = 2000
N_FOLDS = 10
PCA_DIM = 50
FD_MAX = 0.5
MIN_VOLUMES = 100
CONFOUND_COLS = ["X", "Y", "Z", "RotX", "RotY", "RotZ",
                 "WhiteMatter", "aCompCor00"]
COMPARISONS = {"SCHZ": "schizophrenia", "BIPOLAR": "bipolar_disorder",
               "ADHD": "adhd"}


def dk_vertex_labels() -> dict[str, tuple[np.ndarray, list[str]]]:
    """hemi -> (fsaverage5 vertex labels, region names in label order)."""
    out = {}
    for hemi in ("lh", "rh"):
        labels, _ctab, names = fsio.read_annot(
            FSAVERAGE_LABEL / f"{hemi}.aparc.annot")
        out[hemi] = (labels[:10242],
                     [n.decode() for n in names])
    return out


def parcel_timeseries(sub: str, annots) -> np.ndarray | None:
    """(T, 68) DK-ordered mean timeseries, or None if files missing."""
    series = []
    regions = [r for r in load_json("atlases/atlas.dk.json")["regions"]
               if r["kind"] == "cortical"]
    per_hemi_data = {}
    for hemi, letter in (("lh", "L"), ("rh", "R")):
        path = (FUNC / sub /
                f"{sub}_task-rest_bold_space-fsaverage5.{letter}.func.gii")
        if not path.exists():
            return None
        gii = nib.load(path)
        per_hemi_data[hemi] = np.column_stack(
            [d.data for d in gii.darrays])  # (10242, T)
    for r in regions:
        hemi = "lh" if r["hemisphere"] == "left" else "rh"
        labels, names = annots[hemi]
        idx = names.index(r["sourceName"])
        mask = labels == idx
        if mask.sum() == 0:
            return None
        series.append(per_hemi_data[hemi][mask].mean(axis=0))
    return np.array(series).T  # (T, 68)


def load_confounds(sub: str) -> tuple[np.ndarray, float] | None:
    path = FUNC / sub / f"{sub}_task-rest_bold_confounds.tsv"
    if not path.exists():
        return None
    rows = list(csv.DictReader(path.open(), delimiter="\t"))
    def val(row, col):
        v = row[col]
        return 0.0 if v in ("n/a", "") else float(v)
    conf = np.array([[val(r, c) for c in CONFOUND_COLS] for r in rows])
    fd = float(np.mean([val(r, "FramewiseDisplacement") for r in rows]))
    return conf, fd


def connectivity_features(ts: np.ndarray, conf: np.ndarray) -> np.ndarray:
    """Confound-regress, correlate, Fisher-z, upper triangle."""
    t = len(ts)
    design = np.column_stack([conf[:t], np.arange(t), np.ones(t)])
    resid = ts - design @ np.linalg.lstsq(design, ts, rcond=None)[0]
    corr = np.corrcoef(resid.T)
    z = np.arctanh(np.clip(corr, -0.999999, 0.999999))
    iu = np.triu_indices(z.shape[0], k=1)
    return z[iu]


def pooled_cv_auc(x, y, rng_folds, seed) -> tuple[float, np.ndarray]:
    preds = np.zeros(len(y))
    skf = StratifiedKFold(n_splits=N_FOLDS, shuffle=True,
                          random_state=rng_folds)
    for tr, te in skf.split(x, y):
        clf = make_pipeline(
            StandardScaler(),
            PCA(n_components=min(PCA_DIM, len(tr) - 1), random_state=seed),
            LogisticRegression(max_iter=2000, random_state=seed),
        ).fit(x[tr], y[tr])
        preds[te] = clf.predict_proba(x[te])[:, 1]
    return float(roc_auc_score(y, preds)), preds


def evaluate(x, y, rng, seed) -> dict:
    auc, preds = pooled_cv_auc(x, y, seed, seed)
    perm = np.array([pooled_cv_auc(x, rng.permutation(y), seed, seed)[0]
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


def main() -> None:
    annots = dk_vertex_labels()
    rows = list(csv.DictReader(PARTICIPANTS.open(), delimiter="\t"))
    by_id = {r["participant_id"]: r for r in rows}

    feats, groups, ids, confs_ag = [], [], [], []
    excluded = {"missing": 0, "motion": 0, "short": 0}
    excluded_by_group: dict[str, int] = {}
    for sub in sorted(p.name for p in FUNC.iterdir() if p.is_dir()):
        row = by_id.get(sub)
        if row is None or row["age"] in ("", "n/a"):
            excluded["missing"] += 1
            continue
        loaded = load_confounds(sub)
        ts = parcel_timeseries(sub, annots)
        if loaded is None or ts is None:
            excluded["missing"] += 1
            continue
        conf, fd = loaded
        if fd > FD_MAX:
            excluded["motion"] += 1
            excluded_by_group[row["diagnosis"]] = (
                excluded_by_group.get(row["diagnosis"], 0) + 1)
            continue
        if len(ts) < MIN_VOLUMES:
            excluded["short"] += 1
            continue
        feats.append(connectivity_features(ts, conf))
        groups.append(row["diagnosis"])
        ids.append(sub)
        confs_ag.append([float(row["age"]),
                         1.0 if row["gender"] == "M" else 0.0])
    x = np.array(feats)
    g = np.array(groups)
    c = np.array(confs_ag)
    counts = {k: int((g == k).sum()) for k in
              ("CONTROL", "SCHZ", "BIPOLAR", "ADHD")}
    print(f"connectivity subjects: {len(g)} {counts}; excluded {excluded} "
          f"(motion by group: {excluded_by_group})")

    rng = np.random.default_rng(SEED)
    results = {}
    for label in COMPARISONS:
        mask = (g == label) | (g == "CONTROL")
        results[label] = evaluate(x[mask], (g[mask] == label).astype(int),
                                  rng, SEED)
        print(f"{label} vs CONTROL: AUC {results[label]['auc']} "
              f"(perm p {results[label]['perm_p']}, "
              f"CI [{results[label]['ci_low']}, {results[label]['ci_high']}])")

    write_run({
        "runId": "conn_fc_cnp_v1",
        "task": "classification",
        "datasetDef": (
            "OpenNeuro ds000030 (UCLA CNP, CC0): fmriprep surface-sampled "
            "resting-state BOLD (fsaverage5) from the published derivatives "
            f"— {len(g)} usable subjects ({counts['CONTROL']} CN, "
            f"{counts['SCHZ']} SCZ, {counts['BIPOLAR']} BD, "
            f"{counts['ADHD']} ADHD); excluded: {excluded['missing']} "
            f"missing/incomplete, {excluded['motion']} high motion "
            f"(mean FD > {FD_MAX} mm; by group {excluded_by_group}), "
            f"{excluded['short']} short scans. Motion-exclusion rates "
            "differ by group — residual motion confounding cannot be ruled "
            "out. Representation sanity check, NOT diagnosis."
        ),
        "splitStrategy": "subject_level",
        "preprocessing": (
            "One vector per subject: DK-68 parcel mean timeseries "
            "(fsaverage aparc annot restricted to fsaverage5 vertices); "
            "confound regression (6 motion params + WhiteMatter + "
            "aCompCor00 + linear trend); Pearson correlation -> Fisher z "
            "-> upper triangle (2278 features)."
        ),
        "model": (
            f"Fold-safe Pipeline(StandardScaler -> PCA-{PCA_DIM} -> L2 "
            f"logistic), stratified {N_FOLDS}-fold CV over subjects, "
            f"pooled out-of-fold ROC-AUC; {N_PERMUTATIONS} label "
            "permutations refitting the full CV (p = (1+#perm>=obs)/(1+N)); "
            f"subject-bootstrap 95% CI ({N_BOOTSTRAP} resamples)."
        ),
        "config": {"seed": SEED, "nPermutations": N_PERMUTATIONS,
                   "nBootstrap": N_BOOTSTRAP, "folds": N_FOLDS,
                   "pcaDim": PCA_DIM, "fdMax": FD_MAX,
                   "confounds": ",".join(CONFOUND_COLS)},
        "metrics": {
            **{f"{k.lower()}_vs_cn_auc": v["auc"] for k, v in results.items()},
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
    }, {})

    # ---- multi-view alignment: morphometry x connectivity, same subjects
    regions = load_json("atlases/atlas.dk.json")["regions"]
    m_feats, m_ids = [], []
    for i, sub in enumerate(ids):
        stats_dir = STATS / sub
        if not stats_dir.exists():
            continue
        mf = morpho_features(stats_dir, regions)
        if mf is None:
            continue
        m_feats.append((mf, x[i], c[i]))
        m_ids.append(sub)
    xm = np.array([t[0] for t in m_feats])
    xc = np.array([t[1] for t in m_feats])
    cc_conf = np.array([t[2] for t in m_feats])
    n = len(m_ids)
    print(f"multi-view subjects (both views): {n}")

    # residualize age/gender from both views, then PCA the wide view
    xm_r = xm - LinearRegression().fit(cc_conf, xm).predict(cc_conf)
    xc_r = xc - LinearRegression().fit(cc_conf, xc).predict(cc_conf)
    xc_p = PCA(n_components=PCA_DIM, random_state=SEED).fit_transform(xc_r)

    k = 5
    cca = CCA(n_components=k, max_iter=2000).fit(xm_r, xc_p)
    def ccs(model, a, b):
        u, v = model.transform(a, b)
        return np.array([abs(float(np.corrcoef(u[:, j], v[:, j])[0, 1]))
                         for j in range(u.shape[1])])
    observed = ccs(cca, xm_r, xc_p)
    perm = np.zeros((N_PERMUTATIONS, k))
    for i in range(N_PERMUTATIONS):
        b = xc_p[rng.permutation(n)]
        perm[i] = ccs(CCA(n_components=k, max_iter=2000).fit(xm_r, b),
                      xm_r, b)
    p_values = (1 + (perm >= observed).sum(axis=0)) / (1 + N_PERMUTATIONS)
    print("multi-view CCA:",
          ", ".join(f"cc{j+1}={observed[j]:.3f} (p={p_values[j]:.3f})"
                    for j in range(k)))

    write_run({
        "runId": "alignment_subject_multiview_v1",
        "task": "alignment",
        "datasetDef": (
            f"SUBJECT-LEVEL multi-view alignment, n={n} UCLA CNP subjects "
            "with both views: X = 83 morphometry features (DK thickness + "
            "eTIV-normalized volumes), Y = resting-state connectivity "
            f"(2278 Fisher-z edges, PCA-{PCA_DIM}). This is the multi-view "
            "analysis NOESIS deferred until two REAL views shared entities "
            "richly — same individuals, two independent MRI-derived "
            "modalities. Alignment = shared anatomy-function individual "
            "variation in ONE dataset; not disorder-specific, not causal; "
            "global factors not fully removed (no global-signal regression; "
            "thickness not size-normalized) may contribute to the shared "
            "component."
        ),
        "splitStrategy": "permutation_test",
        "preprocessing": (
            "Age + gender residualized from BOTH views (full sample) before "
            "CCA, so demographics cannot manufacture alignment; "
            f"connectivity reduced to PCA-{PCA_DIM} (fit on residualized "
            "features)."
        ),
        "model": (
            f"CCA, {k} components; {N_PERMUTATIONS} row permutations of the "
            "connectivity view (subjects are exchangeable rows — no "
            "block structure at subject level), refit per permutation, "
            "per-component p = (1+#perm>=observed)/(1+N); no deflation "
            "across components (components >= 2 approximate; claims rest "
            "on component 1)."
        ),
        "config": {"seed": SEED, "nComponents": k,
                   "nPermutations": N_PERMUTATIONS, "pcaDim": PCA_DIM},
        "metrics": {
            **{f"cc{j+1}": round(float(observed[j]), 4) for j in range(k)},
            **{f"cc{j+1}_perm_p": round(float(p_values[j]), 4)
               for j in range(k)},
            "n_subjects": float(n),
        },
        "uncertainty": None,
        "modelVersion": "v1",
        "created": date.today().isoformat(),
    }, {})


if __name__ == "__main__":
    main()
