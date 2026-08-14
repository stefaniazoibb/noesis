"""CCA alignment between the two disorder representations NOESIS has:

  X — evidence-corpus embeddings (data/embeddings/disorder.*, 19 x 8 PCA of
      curated-assertion features)
  Y — NeuroQuery meta-map profiles (data/metamaps/, 19 disorders x 83 regions
      of meta-analytic z-values), column-z-scored then PCA-reduced to 8.

With n=19 disorders, in-sample canonical correlations are near-guaranteed to
be high, so the run reports a PERMUTATION TEST (refit under row-shuffled Y)
as its validation protocol — the honest small-n alternative to a train/test
split. Interpretation caveat baked into the artifact: both views derive from
the research literature (curated corpus vs automated mining of largely the
same literature), so alignment is a CONSISTENCY check between curation and
automated mining, never independent biological validation.

Run: python pipeline/mlruns/build_alignment.py   (conda env `noesis`)
"""

from datetime import date
from pathlib import Path
import json
import sys

import numpy as np
from sklearn.cross_decomposition import CCA
from sklearn.decomposition import PCA

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import DATA, load_json, write_run

N_COMPONENTS = 3
N_PERMUTATIONS = 1000
SEED = 42


def canonical_correlations(cca: CCA, x: np.ndarray, y: np.ndarray) -> np.ndarray:
    u, v = cca.transform(x, y)
    return np.array(
        [abs(float(np.corrcoef(u[:, k], v[:, k])[0, 1])) for k in range(u.shape[1])]
    )


def run_alignment(config: dict | None = None) -> dict:
    cfg = {"entity": "disorder", "nComponents": N_COMPONENTS,
           "nPermutations": N_PERMUTATIONS, "seed": SEED}
    cfg.update(config or {})
    entity = cfg["entity"]
    if entity not in ("disorder", "region"):
        raise SystemExit(f"unknown entity {entity!r} (disorder|region)")
    rng = np.random.default_rng(cfg["seed"])

    manifest = load_json(f"embeddings/{entity}.manifest.json")
    ids = manifest["ids"]
    x = np.fromfile(
        DATA / "embeddings" / manifest["vectorsFile"], dtype=np.float32
    ).reshape(len(ids), manifest["dim"]).astype(np.float64)

    # meta-map matrix in the same row order as X; fixed column order
    maps = {p.stem.removesuffix(".metamap"): json.loads(p.read_text())
            for p in (DATA / "metamaps").glob("*.metamap.json")}
    if entity == "disorder":
        missing = [d for d in ids if d not in maps]
        if missing:
            raise SystemExit(f"no meta-map for: {missing} — run build_metamaps.py first")
        cols = sorted(maps[ids[0]]["values"].keys())  # regions
        y_raw = np.array([[maps[d]["values"][c] for c in cols] for d in ids])
    else:
        cols = sorted(maps.keys())  # disorders
        y_raw = np.array([[maps[c]["values"][r] for c in cols] for r in ids])

    # column z-score (relative association pattern), PCA to match X's dim
    y_std = (y_raw - y_raw.mean(axis=0)) / (y_raw.std(axis=0) + 1e-9)
    y = PCA(n_components=x.shape[1], random_state=cfg["seed"]).fit_transform(y_std)

    k = cfg["nComponents"]
    cca = CCA(n_components=k, max_iter=2000).fit(x, y)
    observed = canonical_correlations(cca, x, y)

    perm = np.zeros((cfg["nPermutations"], k))
    for i in range(cfg["nPermutations"]):
        y_perm = y[rng.permutation(len(ids))]
        c = CCA(n_components=k, max_iter=2000).fit(x, y_perm)
        perm[i] = canonical_correlations(c, x, y_perm)
    p_values = (1 + (perm >= observed).sum(axis=0)) / (1 + cfg["nPermutations"])

    u, v = cca.transform(x, y)
    scores = [
        {"id": d, "evidenceCV1": round(float(u[i, 0]), 4),
         "metamapCV1": round(float(v[i, 0]), 4)}
        for i, d in enumerate(ids)
    ]

    metrics: dict[str, float] = {}
    for j in range(k):
        metrics[f"cc{j + 1}"] = round(float(observed[j]), 4)
        metrics[f"cc{j + 1}_perm_p"] = round(float(p_values[j]), 4)

    if entity == "disorder":
        dataset_def = (
            "X: 19 disorder evidence-corpus embeddings "
            f"({manifest['artifactId']}, corpus {manifest['corpusVersion']}); "
            "Y: 19 NeuroQuery meta-map region profiles (83 regions, "
            "column-z-scored, PCA to 8). Both views derive from the research "
            "literature — alignment measures curation/automated-mining "
            "consistency, NOT independent biological validation."
        )
        col_desc = "per-region z-score across disorders"
    else:
        dataset_def = (
            f"X: {len(ids)} region evidence-corpus embeddings "
            f"({manifest['artifactId']}, corpus {manifest['corpusVersion']} — "
            "regions WITH indexed evidence only, a selection biased toward "
            f"well-studied regions); Y: the same {len(ids)} regions' "
            f"NeuroQuery meta-map profiles across {len(cols)} disorders, "
            "column-z-scored, PCA to 8. Both views derive from the research "
            "literature — alignment measures curation/automated-mining "
            "consistency, NOT independent biological validation."
        )
        col_desc = "per-disorder z-score across regions"

    run = {
        "runId": ("alignment_cca_v1" if entity == "disorder"
                  else "alignment_cca_regions_v1"),
        "task": "alignment",
        "datasetDef": dataset_def,
        "splitStrategy": "permutation_test",
        "preprocessing": (
            "X used as built (log1p counts -> z-score -> PCA-8). "
            f"Y: {col_desc} -> PCA-8 (seed {cfg['seed']})."
        ),
        "model": (
            f"CCA, {k} components (scikit-learn); significance by "
            f"{cfg['nPermutations']} row-permutations of Y (refit per "
            "permutation, per-component p = (1+#perm>=observed)/(1+N))."
        ),
        "config": cfg,
        "metrics": metrics,
        "uncertainty": None,
        "modelVersion": "v1",
        "created": date.today().isoformat(),
    }
    write_run(run, {"scores": scores})
    print("canonical correlations:",
          ", ".join(f"cc{j + 1}={observed[j]:.3f} (p={p_values[j]:.3f})" for j in range(k)))
    return run


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--entity", choices=["disorder", "region"],
                        default="disorder")
    run_alignment({"entity": parser.parse_args().entity})
