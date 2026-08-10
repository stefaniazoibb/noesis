"""Baseline representation pipeline (Research Intelligence Layer, task B).

Builds region, disorder, and study embeddings from the evidence corpus using
the transparent baseline mandated by the plan: modality-partitioned evidence
features -> log1p -> z-score -> PCA (loadings saved for interpretability),
plus PCA-2D and (when enough rows) UMAP projections.

The features are EVIDENCE features: they describe the indexed literature, not
biology. Every artifact manifest records method, inputs, params and a corpus
version hash so results are reproducible and traceable.

Outputs (data/embeddings/, mirrored to public/embeddings/):
  {entity}.manifest.json   EmbeddingSet manifest (schema-validated app-side)
  {entity}.vectors.f32     float32 row-major vectors, len(ids) x dim
  {entity}.loadings.json   PCA loadings + explained variance (interpretability)
"""

import hashlib
import json
import shutil
from datetime import date
from pathlib import Path

import numpy as np
from sklearn.decomposition import PCA

HERE = Path(__file__).parent
REPO = HERE.parent.parent
DATA = REPO / "data"
OUT = DATA / "embeddings"
PUBLIC = REPO / "public" / "embeddings"

SEED = 42
CATEGORIES = ["imaging", "electrophysiology", "stimulation"]
DIRECTION_VALUE = {"increased": 1.0, "decreased": -1.0}


def load(name: str):
    return json.loads((DATA / name).read_text())


def corpus_version() -> str:
    h = hashlib.sha256()
    for name in ("studies/studies.json", "evidence/assertions.json"):
        h.update((DATA / name).read_bytes())
    return h.hexdigest()[:12]


def normalize(matrix: np.ndarray, count_cols: list[int]) -> tuple[np.ndarray, int]:
    """log1p on count columns, then z-score; drop zero-variance columns."""
    m = matrix.astype(np.float64).copy()
    m[:, count_cols] = np.log1p(m[:, count_cols])
    std = m.std(axis=0)
    keep = std > 1e-12
    m = (m[:, keep] - m[:, keep].mean(axis=0)) / std[keep]
    return m, int((~keep).sum())


def build_set(
    name: str,
    entity_type: str,
    ids: list[str],
    features: np.ndarray,
    feature_names: list[str],
    count_cols: list[int],
    inputs: list[str],
    version: str,
):
    x, dropped = normalize(features, count_cols)
    n_components = max(2, min(8, len(ids) - 1, x.shape[1]))
    pca = PCA(n_components=n_components, random_state=SEED)
    vectors = pca.fit_transform(x)

    # feature names that survived the zero-variance drop (post-log1p)
    raw = features.astype(np.float64).copy()
    raw[:, count_cols] = np.log1p(raw[:, count_cols])
    kept_names = [n for n, s in zip(feature_names, raw.std(axis=0)) if s > 1e-12]

    projections: dict[str, list[list[float]]] = {
        "pca": [[round(float(v[0]), 4), round(float(v[1]), 4)] for v in vectors]
    }
    umap_neighbors = None
    if len(ids) >= 10:
        import umap

        umap_neighbors = min(15, len(ids) - 1)
        reducer = umap.UMAP(
            n_neighbors=umap_neighbors, min_dist=0.1, random_state=SEED
        )
        proj = reducer.fit_transform(x)
        projections["umap"] = [
            [round(float(p[0]), 4), round(float(p[1]), 4)] for p in proj
        ]

    manifest = {
        "artifactId": f"{name}_evidence_pca_v1",
        "entityType": entity_type,
        "method": "evidence features -> log1p(counts) -> z-score -> PCA"
        + (" (+UMAP projection)" if "umap" in projections else ""),
        "inputs": inputs,
        "corpusVersion": version,
        "params": {
            "nComponents": n_components,
            "nFeatures": len(kept_names),
            "droppedZeroVarianceColumns": dropped,
            "seed": SEED,
            **({"umapNeighbors": umap_neighbors} if umap_neighbors else {}),
            "note": "Features describe the indexed evidence corpus, not biology.",
        },
        "created": date.today().isoformat(),
        "dim": n_components,
        "ids": ids,
        "vectorsFile": f"{name}.vectors.f32",
        "projections": projections,
    }

    loadings = {
        "artifactId": manifest["artifactId"],
        "components": [
            {
                "index": i,
                "explainedVarianceRatio": round(float(r), 4),
                "topFeatures": [
                    {
                        "feature": kept_names[j],
                        "loading": round(float(pca.components_[i][j]), 4),
                    }
                    for j in np.argsort(-np.abs(pca.components_[i]))[:8]
                ],
            }
            for i, r in enumerate(pca.explained_variance_ratio_)
        ],
    }

    (OUT / f"{name}.manifest.json").write_text(json.dumps(manifest, indent=2))
    (OUT / f"{name}.vectors.f32").write_bytes(
        vectors.astype(np.float32).tobytes()
    )
    (OUT / f"{name}.loadings.json").write_text(json.dumps(loadings, indent=2))
    ev = ", ".join(f"{r:.2f}" for r in pca.explained_variance_ratio_[:4])
    print(
        f"{name}: {len(ids)} ids x {len(kept_names)} features -> dim {n_components} "
        f"(explained variance {ev}…), projections: {sorted(projections)}"
    )


def main():
    OUT.mkdir(exist_ok=True)
    studies = load("studies/studies.json")
    assertions = load("evidence/assertions.json")
    modalities = load("modalities/modalities.json")
    version = corpus_version()
    inputs = [
        "data/studies/studies.json",
        "data/evidence/assertions.json",
        "data/modalities/modalities.json",
    ]

    category_of = {m["id"]: m["category"] for m in modalities}
    disorders = sorted({a["disorder"] for a in assertions})
    regions = sorted({a["region"] for a in assertions})
    study_ids = sorted({s["id"] for s in studies})

    # ---- region embeddings: (disorder x category) study counts + direction
    cols = [f"{d}|{c}" for d in disorders for c in CATEGORIES] + [
        f"{d}|direction" for d in disorders
    ]
    col_idx = {c: i for i, c in enumerate(cols)}
    count_cols = list(range(len(disorders) * len(CATEGORIES)))
    region_idx = {r: i for i, r in enumerate(regions)}
    counts: dict[tuple[int, int], set] = {}
    directions: dict[tuple[int, str], list] = {}
    for a in assertions:
        ri = region_idx[a["region"]]
        c = category_of[a["modality"]]
        j = col_idx[f"{a['disorder']}|{c}"]
        counts.setdefault((ri, j), set()).add(a["studyId"])
        if a["direction"] in DIRECTION_VALUE:
            directions.setdefault((ri, a["disorder"]), []).append(
                DIRECTION_VALUE[a["direction"]]
            )
    region_x = np.zeros((len(regions), len(cols)))
    for (ri, j), s in counts.items():
        region_x[ri, j] = len(s)
    for (ri, d), vals in directions.items():
        region_x[ri, col_idx[f"{d}|direction"]] = float(np.mean(vals))
    build_set("region", "region", regions, region_x, cols, count_cols, inputs, version)

    # ---- disorder embeddings: (region x category) study counts
    dcols = [f"{r}|{c}" for r in regions for c in CATEGORIES]
    dcol_idx = {c: i for i, c in enumerate(dcols)}
    disorder_idx = {d: i for i, d in enumerate(disorders)}
    dcounts: dict[tuple[int, int], set] = {}
    for a in assertions:
        di = disorder_idx[a["disorder"]]
        j = dcol_idx[f"{a['region']}|{category_of[a['modality']]}"]
        dcounts.setdefault((di, j), set()).add(a["studyId"])
    disorder_x = np.zeros((len(disorders), len(dcols)))
    for (di, j), s in dcounts.items():
        disorder_x[di, j] = len(s)
    build_set(
        "disorder", "disorder", disorders, disorder_x,
        dcols, list(range(len(dcols))), inputs, version,
    )

    # ---- study embeddings: disorders/categories/finding/direction/regions/year/N
    finding_types = sorted({s["findingType"] for s in studies})
    scols = (
        [f"disorder|{d}" for d in disorders]
        + [f"category|{c}" for c in CATEGORIES]
        + [f"finding|{f}" for f in finding_types]
        + ["direction|increased", "direction|decreased", "direction|mixed"]
        + [f"region|{r}" for r in regions]
        + ["year", "log_sample_size", "sample_size_missing"]
    )
    scol_idx = {c: i for i, c in enumerate(scols)}
    study_by_id = {s["id"]: s for s in studies}
    study_x = np.zeros((len(study_ids), len(scols)))
    for i, sid in enumerate(study_ids):
        s = study_by_id[sid]
        for d in s["disorders"]:
            study_x[i, scol_idx[f"disorder|{d}"]] = 1
        for m in s["modalities"]:
            study_x[i, scol_idx[f"category|{category_of[m]}"]] = 1
        study_x[i, scol_idx[f"finding|{s['findingType']}"]] = 1
        if s["direction"]:
            study_x[i, scol_idx[f"direction|{s['direction']}"]] = 1
        for r in s["regions"]:
            if f"region|{r}" in scol_idx:
                study_x[i, scol_idx[f"region|{r}"]] = 1
        study_x[i, scol_idx["year"]] = s["year"]
        if s["sampleSize"]:
            study_x[i, scol_idx["log_sample_size"]] = np.log1p(s["sampleSize"])
        else:
            study_x[i, scol_idx["sample_size_missing"]] = 1
    build_set("study", "study", study_ids, study_x, scols, [], inputs, version)

    # ---- install for the app
    PUBLIC.mkdir(parents=True, exist_ok=True)
    for f in OUT.iterdir():
        shutil.copy2(f, PUBLIC / f.name)
    print(f"corpus version {version}; artifacts mirrored to public/embeddings/")


if __name__ == "__main__":
    main()
