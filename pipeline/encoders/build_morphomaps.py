"""MRI morphometry brain maps: RegionScalarMap artifacts from the CNP run.

Reads the committed aggregate effect sizes of ModelRun
`mri_morphometry_cnp_v1` (Cohen's d, control minus patient, age/gender
adjusted — pipeline/encoders/build_mri_encoder.py) and writes one
RegionScalarMap per disorder to data/morphomaps/ + public/morphomaps/ for
the Morphometry viz mode. SIGNED values are preserved: positive = thinner
(cortical) / smaller (subcortical, eTIV-normalized) in patients; negative =
larger in patients (e.g. pallidum/putamen in schizophrenia). Single-dataset
effect sizes — a separate, data-derived stratum, never merged with the
curated corpus metrics and not meta-analytic consensus.

Run: python pipeline/encoders/build_morphomaps.py   (after the MRI encoder)
"""

from datetime import date
from pathlib import Path
import json
import sys

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "mlruns"))
from common import DATA, REPO  # noqa: E402

OUT = DATA / "morphomaps"
PUBLIC = REPO / "public" / "morphomaps"


def main() -> None:
    run = json.loads((DATA / "ml_runs/mri_morphometry_cnp_v1.run.json").read_text())
    effect_sizes = json.loads(
        (DATA / "ml_runs" / run["outputs"]["effectSizes"]).read_text())
    OUT.mkdir(exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)

    for e in effect_sizes:
        artifact = {
            "artifactId": f"morphomap_cnp_{e['disorder']}_v1",
            "atlas": "dk",
            "values": e["d_control_minus_patient"],
            "metricDef": (
                "Cohen's d (controls minus patients, age/gender-adjusted) "
                "for FreeSurfer mean cortical thickness (cortical regions) "
                "and eTIV-normalized volume (subcortical), UCLA CNP "
                f"ds000030: {e['nPatients']} patients vs {e['nControls']} "
                "controls. POSITIVE = thinner/smaller in patients; NEGATIVE "
                "= larger in patients. SINGLE-DATASET group differences — "
                "not meta-analytic consensus, not individual prediction "
                "(the same run's classification AUC is ~chance), not "
                "diagnostic."
            ),
            "provenance": {
                "method": (
                    "Aggregate effect sizes from ModelRun "
                    "mri_morphometry_cnp_v1 (pipeline/encoders/"
                    "build_mri_encoder.py). See data/provenance/"
                    "ds000030.json."
                ),
                "corpusVersion": None,
                "created": date.today().isoformat(),
            },
        }
        name = f"{e['disorder']}.morphomap.json"
        text = json.dumps(artifact, indent=2)
        (OUT / name).write_text(text)
        (PUBLIC / name).write_text(text)
        d = e["d_control_minus_patient"]
        top = sorted(d.items(), key=lambda kv: -abs(kv[1]))[:3]
        print(f"{e['disorder']}: " + ", ".join(f"{k}={v:+.2f}" for k, v in top))


if __name__ == "__main__":
    main()
