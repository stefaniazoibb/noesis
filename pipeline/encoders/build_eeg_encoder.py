"""Real-modality EEG encoder v1: spectral features from clinical resting EEG.

Dataset: OpenNeuro ds004504 (Miltiadous et al., Data 2023, CC0; DOI
10.18112/openneuro.ds004504.v1.0.9) — resting-state eyes-closed EEG from the
AHEPA General University Hospital 2nd Dept. of Neurology: 36 Alzheimer's
(AD), 23 frontotemporal dementia (FTD), 29 healthy controls (CN); 19
channels, 500 Hz, ~12-14 min/subject. We use the curators' preprocessed
derivatives (band-pass 0.5-45 Hz, A1-A2 re-reference, ASR, ICA artifact
rejection) — their pipeline, documented in the dataset README.

Encoder: one feature vector per SUBJECT — relative band power (delta,
theta, alpha, beta, gamma) averaged within 5 scalp zones (frontal, central,
temporal, parietal, occipital) = 25 features from a Welch PSD over the full
recording. Evaluation: dementia-vs-control classification (AD-vs-CN primary,
FTD-vs-CN secondary) as a SANITY CHECK that the representation carries the
established EEG-slowing signal — leave-one-subject-out CV (the subject-level
split is structural: one vector per subject), pooled-prediction ROC-AUC,
subject-bootstrap 95% CI, and a label-permutation test refitting the whole
LOSO loop per permutation.

Integrity constraints (docs/NOESIS_SCIENTIFIC_RULES.md):
- Scalp EEG stays disorder-level — NO atlas-region mapping (decision #8).
- Artifacts contain aggregate statistics only, never per-subject data.
- Classification here validates a representation; it is NOT a diagnostic
  claim and the manifest says so.

Run: python pipeline/encoders/build_eeg_encoder.py   (conda env `noesis`;
raw data under pipeline/encoders/raw/ds004504/, gitignored)
"""

from datetime import date
from pathlib import Path
import json
import sys

import numpy as np
import mne
from scipy.signal import welch
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mlruns"))
from common import write_run  # noqa: E402

HERE = Path(__file__).resolve().parent
RAW = HERE / "raw" / "ds004504"
DERIV = RAW / "derivatives"

SEED = 42
N_PERMUTATIONS = 1000
N_BOOTSTRAP = 2000

BANDS = {"delta": (0.5, 4), "theta": (4, 8), "alpha": (8, 13),
         "beta": (13, 30), "gamma": (30, 45)}
ZONES = {
    "frontal": ["Fp1", "Fp2", "F7", "F3", "Fz", "F4", "F8"],
    "central": ["C3", "Cz", "C4"],
    "temporal": ["T3", "T4", "T5", "T6"],
    "parietal": ["P3", "Pz", "P4"],
    "occipital": ["O1", "O2"],
}
FEATURE_NAMES = [f"{z}_{b}" for z in ZONES for b in BANDS]


def subject_features(set_path: Path) -> np.ndarray:
    raw = mne.io.read_raw_eeglab(set_path, preload=True, verbose="error")
    data = raw.get_data()  # (n_ch, n_samples), volts
    sf = raw.info["sfreq"]
    freqs, psd = welch(data, fs=sf, nperseg=int(4 * sf), axis=1)
    ch_index = {ch: i for i, ch in enumerate(raw.ch_names)}
    feats = []
    for chans in ZONES.values():
        rows = [ch_index[c] for c in chans if c in ch_index]
        zone_psd = psd[rows].mean(axis=0)
        total = zone_psd[(freqs >= 0.5) & (freqs <= 45)].sum()
        for lo, hi in BANDS.values():
            feats.append(zone_psd[(freqs >= lo) & (freqs < hi)].sum() / total)
    return np.array(feats)


def loso_auc(x: np.ndarray, y: np.ndarray, seed: int) -> float:
    """Pooled leave-one-subject-out predictions -> ROC-AUC."""
    preds = np.zeros(len(y))
    for i in range(len(y)):
        mask = np.ones(len(y), bool)
        mask[i] = False
        clf = make_pipeline(
            StandardScaler(),
            LogisticRegression(max_iter=2000, random_state=seed),
        ).fit(x[mask], y[mask])
        preds[i] = clf.predict_proba(x[i:i + 1])[0, 1]
    return float(roc_auc_score(y, preds)), preds


def evaluate(x: np.ndarray, y: np.ndarray, rng: np.random.Generator,
             seed: int) -> dict:
    auc, preds = loso_auc(x, y, seed)
    # label-permutation null: the FULL LOSO loop refit per permutation
    perm_aucs = np.array([
        loso_auc(x, rng.permutation(y), seed)[0]
        for _ in range(N_PERMUTATIONS)
    ])
    p = float((1 + (perm_aucs >= auc).sum()) / (1 + N_PERMUTATIONS))
    # subject-level bootstrap on the pooled LOSO predictions
    boots = []
    idx = np.arange(len(y))
    while len(boots) < N_BOOTSTRAP:
        b = rng.choice(idx, len(idx), replace=True)
        if len(np.unique(y[b])) < 2:
            continue
        boots.append(roc_auc_score(y[b], preds[b]))
    return {
        "auc": round(auc, 4),
        "perm_p": round(p, 4),
        "ci_low": round(float(np.percentile(boots, 2.5)), 4),
        "ci_high": round(float(np.percentile(boots, 97.5)), 4),
    }


def main() -> None:
    desc = json.loads((RAW / "dataset_description.json").read_text())
    if desc.get("License") != "CC0":
        raise SystemExit(f"license changed ({desc.get('License')}) — re-review "
                         "before use (DATA_SOURCES rule: verify at ingestion)")

    participants = {}
    for line in (RAW / "participants.tsv").read_text().splitlines()[1:]:
        pid, _gender, _age, group, _mmse = line.split("\t")
        participants[pid] = group  # A / F / C

    rng = np.random.default_rng(SEED)
    features, groups, n_missing = [], [], 0
    for pid in sorted(participants):
        set_path = DERIV / pid / "eeg" / f"{pid}_task-eyesclosed_eeg.set"
        if not set_path.exists():
            n_missing += 1
            continue
        features.append(subject_features(set_path))
        groups.append(participants[pid])
        print(f"  {pid} ({participants[pid]}) ok")
    if n_missing:
        raise SystemExit(f"{n_missing} subjects missing derivatives — "
                         "incomplete download, refusing to run")
    x = np.array(features)
    g = np.array(groups)
    print(f"features: {x.shape} from groups "
          f"A={int((g == 'A').sum())} F={int((g == 'F').sum())} "
          f"C={int((g == 'C').sum())}")

    results = {}
    for label, key in (("A", "ad_vs_cn"), ("F", "ftd_vs_cn")):
        mask = (g == label) | (g == "C")
        results[key] = evaluate(x[mask], (g[mask] == label).astype(int),
                                rng, SEED)
        print(f"{key}: AUC {results[key]['auc']} "
              f"(perm p {results[key]['perm_p']}, "
              f"CI [{results[key]['ci_low']}, {results[key]['ci_high']}])")

    # aggregate-only payload: group-mean relative power per zone-band
    spectra = [
        {"feature": name,
         "AD": round(float(x[g == "A", i].mean()), 5),
         "FTD": round(float(x[g == "F", i].mean()), 5),
         "CN": round(float(x[g == "C", i].mean()), 5)}
        for i, name in enumerate(FEATURE_NAMES)
    ]

    run = {
        "runId": "eeg_spectral_dementia_v1",
        "task": "classification",
        "datasetDef": (
            "OpenNeuro ds004504 (CC0, DOI 10.18112/openneuro.ds004504.v1.0.9; "
            "Miltiadous et al., Data 2023): resting-state eyes-closed "
            "clinical EEG, 36 Alzheimer's / 23 frontotemporal dementia / 29 "
            "controls, 19 channels @ 500 Hz, ~12-14 min/subject; curators' "
            "preprocessed derivatives (0.5-45 Hz, A1-A2 reref, ASR, ICA "
            "artifact rejection). First REAL-MODALITY data in NOESIS. "
            "Classification is a sanity check that the spectral "
            "representation carries the established EEG-slowing signal in "
            "dementia — NOT a diagnostic tool, and scalp EEG maps to no "
            "atlas region (disorder-level only, decision #8)."
        ),
        "splitStrategy": "subject_level",
        "preprocessing": (
            "One vector per subject: Welch PSD (4 s windows) over the full "
            "cleaned recording; relative band power (delta/theta/alpha/beta/"
            "gamma over 0.5-45 Hz total) averaged within 5 scalp zones "
            "(frontal/central/temporal/parietal/occipital) = 25 features. "
            "Subject-level split is structural: each subject contributes "
            "exactly one vector, held out whole in LOSO."
        ),
        "model": (
            "StandardScaler + L2 logistic regression (scikit-learn), "
            "leave-one-subject-out CV, ROC-AUC on pooled held-out "
            f"predictions. Significance: {N_PERMUTATIONS} label "
            "permutations refitting the full LOSO loop "
            "(p = (1+#perm>=observed)/(1+N)); subject-bootstrap 95% CI "
            f"({N_BOOTSTRAP} resamples). AD-vs-CN primary; FTD-vs-CN "
            "secondary."
        ),
        "config": {"seed": SEED, "nPermutations": N_PERMUTATIONS,
                   "nBootstrap": N_BOOTSTRAP, "features": len(FEATURE_NAMES),
                   "welchWindowSec": 4},
        "metrics": {
            "ad_vs_cn_auc": results["ad_vs_cn"]["auc"],
            "ad_vs_cn_perm_p": results["ad_vs_cn"]["perm_p"],
            "ftd_vs_cn_auc": results["ftd_vs_cn"]["auc"],
            "ftd_vs_cn_perm_p": results["ftd_vs_cn"]["perm_p"],
            "n_subjects": float(len(g)),
        },
        "uncertainty": {
            "ad_vs_cn_auc_ci95_low": results["ad_vs_cn"]["ci_low"],
            "ad_vs_cn_auc_ci95_high": results["ad_vs_cn"]["ci_high"],
            "ftd_vs_cn_auc_ci95_low": results["ftd_vs_cn"]["ci_low"],
            "ftd_vs_cn_auc_ci95_high": results["ftd_vs_cn"]["ci_high"],
        },
        "modelVersion": "v1",
        "created": date.today().isoformat(),
    }
    write_run(run, {"groupSpectra": spectra})

    provenance = {
        "source": "OpenNeuro ds004504",
        "doi": "10.18112/openneuro.ds004504.v1.0.9",
        "license": "CC0 (verified in dataset_description.json at ingestion, "
                   f"{date.today().isoformat()})",
        "cite": [
            "Miltiadous et al., Data 8(6):95, 2023, doi:10.3390/data8060095",
            "Miltiadous et al., IEEE Access 2023, "
            "doi:10.1109/ACCESS.2023.3294618",
        ],
        "ethics": "AHEPA University Hospital protocol 142/12-04-2023 "
                  "(per dataset metadata)",
        "used": "curators' preprocessed derivatives only; raw downloads kept "
                "out of the repo (pipeline/encoders/raw/, gitignored); "
                "artifacts contain aggregate statistics only",
        "note": "ds002778 was evaluated first and REJECTED: its README asks "
                "that PD-vs-HC ML classification not be performed on it "
                "(n too small); nothing from it was retained (decision #29).",
    }
    (Path(__file__).resolve().parent.parent.parent / "data" / "provenance"
     / "ds004504.json").write_text(json.dumps(provenance, indent=2))
    print("provenance written")


if __name__ == "__main__":
    main()
