"""Shared helpers for ModelRun artifacts (ARCHITECTURE.md §8).

Every ML-Lab computation writes ONE manifest (`<runId>.run.json`, matching
ModelRunSchema in src/lib/schemas/artifacts.ts) plus task-specific payload
files listed in its `outputs` map, to data/ml_runs/ (canonical) and
public/ml_runs/ (served copy). An index.json lists the manifests so the UI
can discover runs without a server. Nothing here touches the evidence corpus:
model runs are a separate, model-generated stratum.
"""

import json
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent.parent
DATA = REPO / "data"
RUNS = DATA / "ml_runs"
PUBLIC_RUNS = REPO / "public" / "ml_runs"


def load_json(rel: str):
    return json.loads((DATA / rel).read_text())


def write_run(manifest: dict, payloads: dict[str, object]) -> None:
    """Write manifest + payload files to both run directories, update index.

    `payloads` maps output-name -> JSON-serializable object; files are named
    `<runId>.<name>.json` and recorded in the manifest's `outputs` map.
    """
    RUNS.mkdir(exist_ok=True)
    PUBLIC_RUNS.mkdir(exist_ok=True)
    run_id = manifest["runId"]
    manifest = {**manifest, "outputs": {}}
    for name, obj in payloads.items():
        fname = f"{run_id}.{name}.json"
        text = json.dumps(obj, indent=2)
        (RUNS / fname).write_text(text)
        (PUBLIC_RUNS / fname).write_text(text)
        manifest["outputs"][name] = fname
    mtext = json.dumps(manifest, indent=2)
    (RUNS / f"{run_id}.run.json").write_text(mtext)
    (PUBLIC_RUNS / f"{run_id}.run.json").write_text(mtext)

    index = sorted(p.name for p in RUNS.glob("*.run.json"))
    itext = json.dumps(index, indent=2)
    (RUNS / "index.json").write_text(itext)
    (PUBLIC_RUNS / "index.json").write_text(itext)
    print(f"wrote run {run_id} ({len(payloads)} payload file(s)); index: {len(index)} run(s)")
