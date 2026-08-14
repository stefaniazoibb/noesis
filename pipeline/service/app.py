"""NOESIS ML service — FastAPI wrapper around the ModelRun pipelines.

The web app NEVER depends on this at runtime: every model result reaches the
frontend as a static, schema-validated artifact in public/ml_runs/. This
service is the researcher's compute box — it re-runs the same pipeline code
the CLI uses and writes through the same artifact contracts, so a run
triggered here is indistinguishable from one run by hand.

Start (conda env `noesis`, repo root):
    uvicorn pipeline.service.app:app --port 8500
Then e.g.:  curl -X POST localhost:8500/runs/link_prediction -d '{"seed": 7}' \
                 -H 'content-type: application/json'
"""

import json
import sys
from pathlib import Path
from typing import Literal

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mlruns"))
from build_alignment import run_alignment  # noqa: E402
from build_linkpred import run_linkpred  # noqa: E402
from common import RUNS  # noqa: E402

app = FastAPI(
    title="NOESIS ML service",
    description=(
        "Runs ML-Lab computations and writes ModelRun artifacts. Outputs are "
        "model-generated — a separate stratum from the curated evidence "
        "corpus, which this service never modifies."
    ),
)


class AlignmentConfig(BaseModel):
    entity: Literal["disorder", "region"] = "disorder"
    nComponents: int = 3
    nPermutations: int = 1000
    seed: int = 42


class LinkPredConfig(BaseModel):
    seed: int = 42
    hidden: int = 32
    epochs: int = 400
    lr: float = 1e-2
    negPerPos: int = 5
    patience: int = 60
    topK: int = 20


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/runs")
def list_runs() -> list[dict]:
    if not RUNS.exists():
        return []
    return [json.loads(p.read_text()) for p in sorted(RUNS.glob("*.run.json"))]


@app.get("/runs/{run_id}")
def get_run(run_id: str) -> dict:
    path = RUNS / f"{run_id}.run.json"
    if not path.exists() or path.parent != RUNS:
        raise HTTPException(404, f"unknown run {run_id}")
    return json.loads(path.read_text())


@app.post("/runs/alignment")
def create_alignment(config: AlignmentConfig) -> dict:
    return run_alignment(config.model_dump())


@app.post("/runs/link_prediction")
def create_linkpred(config: LinkPredConfig) -> dict:
    return run_linkpred(config.model_dump())
