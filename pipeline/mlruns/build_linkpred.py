"""GNN link prediction on the NOESIS heterogeneous evidence graph.

Graph: disorder / region / network nodes; edges are the 257 distinct
disorder-region pairs from the curated assertions plus Yeo region-network
memberships. Study nodes are DELIBERATELY EXCLUDED from message passing: a
study linking disorder D and region R would create a two-hop D-study-R path
that trivially leaks held-out D-R pairs — the graph analog of a subject-level
split violation (see docs/NOESIS_DECISIONS.md).

Split: grouped at the disorder-region PAIR level (every assertion for a pair
collapses to one edge and is held out together), 70/15/15 train/val/test,
fixed seed. Model: 2-layer relational GCN (learned node embeddings, dense
per-relation mean aggregation — the graph has ~109 nodes) with a dot-product
decoder, BCE on sampled negatives; model selection on validation ROC-AUC.

Output: ModelRun manifest (test ROC-AUC / average precision) + top-ranked
NON-corpus disorder-region candidates. Candidates are MODEL-SUGGESTED
hypotheses reflecting the structure of the indexed corpus — never evidence,
never biology (SCIENTIFIC_RULES: ML importance != causality).

Run: python pipeline/mlruns/build_linkpred.py   (conda env `noesis`)
"""

from datetime import date
from pathlib import Path
import sys

import numpy as np
import torch
from sklearn.metrics import average_precision_score, roc_auc_score

sys.path.insert(0, str(Path(__file__).resolve().parent))
from common import load_json, write_run

SEED = 42
HIDDEN = 32
EPOCHS = 400
LR = 1e-2
NEG_PER_POS = 5
PATIENCE = 60
TOP_K = 20


class RelGCN(torch.nn.Module):
    """Two rounds of per-relation mean aggregation over dense adjacencies."""

    def __init__(self, n_nodes: int, adjs: list[torch.Tensor], dim: int):
        super().__init__()
        self.adjs = adjs  # row-normalized, one per directed relation
        self.emb = torch.nn.Embedding(n_nodes, dim)
        torch.nn.init.xavier_uniform_(self.emb.weight)
        self.layers = torch.nn.ModuleList(
            torch.nn.ModuleDict(
                {"self": torch.nn.Linear(dim, dim)}
                | {f"rel{i}": torch.nn.Linear(dim, dim) for i in range(len(adjs))}
            )
            for _ in range(2)
        )

    def forward(self) -> torch.Tensor:
        h = self.emb.weight
        for li, layer in enumerate(self.layers):
            out = layer["self"](h)
            for i, adj in enumerate(self.adjs):
                out = out + layer[f"rel{i}"](adj @ h)
            # no activation on the output layer — a trailing ReLU forces
            # non-negative embeddings and collapses dot-product scores
            h = torch.relu(out) if li < len(self.layers) - 1 else out
        return h


def row_normalize(adj: torch.Tensor) -> torch.Tensor:
    deg = adj.sum(dim=1, keepdim=True).clamp(min=1)
    return adj / deg


def sample_negatives(
    rng: np.random.Generator, n_dis: int, n_reg: int,
    forbidden: set[tuple[int, int]], count: int,
) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    seen = set(forbidden)
    while len(out) < count:
        d = int(rng.integers(n_dis))
        r = int(rng.integers(n_reg))
        if (d, r) not in seen:
            seen.add((d, r))
            out.append((d, r))
    return out


def run_linkpred(config: dict | None = None) -> dict:
    cfg = {"seed": SEED, "hidden": HIDDEN, "epochs": EPOCHS, "lr": LR,
           "negPerPos": NEG_PER_POS, "patience": PATIENCE, "topK": TOP_K,
           # "binary": one disorder-region relation; "modality": one
           # relation per evidence modality category (typed edges, v2)
           "relations": "binary"}
    cfg.update(config or {})
    if cfg["relations"] not in ("binary", "modality"):
        raise SystemExit(f"unknown relations mode {cfg['relations']!r}")
    rng = np.random.default_rng(cfg["seed"])
    torch.manual_seed(cfg["seed"])
    device = torch.device("cpu")  # determinism over speed at this scale

    disorders = [d["id"] for d in load_json("disorders/disorders.json")]
    atlas = load_json("atlases/atlas.dk.json")
    regions = [r["id"] for r in atlas["regions"]]
    networks = load_json("networks/networks.json")
    assertions = load_json("evidence/assertions.json")

    d_idx = {d: i for i, d in enumerate(disorders)}
    r_idx = {r: i for i, r in enumerate(regions)}
    pairs = sorted({(d_idx[a["disorder"]], r_idx[a["region"]]) for a in assertions})

    order = rng.permutation(len(pairs))
    n_train = int(0.7 * len(pairs))
    n_val = int(0.15 * len(pairs))
    train = [pairs[i] for i in order[:n_train]]
    val = [pairs[i] for i in order[n_train:n_train + n_val]]
    test = [pairs[i] for i in order[n_train + n_val:]]
    positives = set(pairs)

    # node index space: disorders | regions | networks
    n_dis, n_reg = len(disorders), len(regions)
    n_nodes = n_dis + n_reg + len(networks)
    reg_of = lambda r: n_dis + r  # noqa: E731
    train_set = set(train)
    if cfg["relations"] == "binary":
        adj_dr = torch.zeros(n_nodes, n_nodes)
        for d, r in train:  # message passing sees TRAIN pairs only
            adj_dr[d, reg_of(r)] = adj_dr[reg_of(r), d] = 1
        dr_adjs = [adj_dr]
    else:
        # typed edges: one relation per evidence modality category; a train
        # pair appears in every category that has an assertion for it
        category_of = {m["id"]: m["category"]
                       for m in load_json("modalities/modalities.json")}
        categories = sorted(set(category_of.values()))
        by_cat = {cat: torch.zeros(n_nodes, n_nodes) for cat in categories}
        for a in assertions:
            pair = (d_idx[a["disorder"]], r_idx[a["region"]])
            if pair not in train_set:  # still TRAIN pairs only
                continue
            adj = by_cat[category_of[a["modality"]]]
            adj[pair[0], reg_of(pair[1])] = adj[reg_of(pair[1]), pair[0]] = 1
        dr_adjs = [by_cat[cat] for cat in categories]
    adj_rn = torch.zeros(n_nodes, n_nodes)
    for k, net in enumerate(networks):
        for r in net["regions"]:
            if r in r_idx:
                i, j = reg_of(r_idx[r]), n_dis + n_reg + k
                adj_rn[i, j] = adj_rn[j, i] = 1
    adjs = [row_normalize(a).to(device) for a in (*dr_adjs, adj_rn)]

    # non-learned collaborative-filtering baseline for context: disorders
    # similar in their TRAIN region sets vote for their regions
    a_train = np.zeros((n_dis, n_reg))
    for d, r in train:
        a_train[d, r] = 1
    inter = a_train @ a_train.T
    union = a_train.sum(1, keepdims=True) + a_train.sum(1) - inter
    jaccard = np.divide(inter, union, out=np.zeros_like(inter), where=union > 0)
    np.fill_diagonal(jaccard, 0)
    cf_scores = jaccard @ a_train

    def cf_auc(pos: list, neg: list) -> float:
        y = np.r_[np.ones(len(pos)), np.zeros(len(neg))]
        s = np.array([cf_scores[d, r] for d, r in pos + neg])
        return float(roc_auc_score(y, s))

    model = RelGCN(n_nodes, adjs, cfg["hidden"]).to(device)
    opt = torch.optim.Adam(model.parameters(), lr=cfg["lr"], weight_decay=1e-4)
    bce = torch.nn.BCEWithLogitsLoss()

    def score(h: torch.Tensor, pl: list[tuple[int, int]]) -> torch.Tensor:
        d = torch.tensor([p[0] for p in pl])
        r = torch.tensor([reg_of(p[1]) for p in pl])
        return (h[d] * h[r]).sum(dim=1)

    # fixed, seeded evaluation negatives (equal count, disjoint from ALL positives)
    val_neg = sample_negatives(rng, n_dis, n_reg, positives, len(val))
    test_neg = sample_negatives(rng, n_dis, n_reg, positives | set(val_neg), len(test))

    def auc_of(h: torch.Tensor, pos: list, neg: list) -> float:
        y = np.r_[np.ones(len(pos)), np.zeros(len(neg))]
        s = torch.cat([score(h, pos), score(h, neg)]).detach().numpy()
        return float(roc_auc_score(y, s))

    best_val, best_state, best_epoch, since = -1.0, None, 0, 0
    for epoch in range(cfg["epochs"]):
        model.train()
        opt.zero_grad()
        h = model()
        neg = sample_negatives(rng, n_dis, n_reg, positives,
                               len(train) * cfg["negPerPos"])
        logits = torch.cat([score(h, train), score(h, neg)])
        labels = torch.cat([torch.ones(len(train)), torch.zeros(len(neg))])
        loss = bce(logits, labels)
        loss.backward()
        opt.step()

        model.eval()
        with torch.no_grad():
            va = auc_of(model(), val, val_neg)
        if va > best_val:
            best_val, best_epoch, since = va, epoch, 0
            best_state = {k: v.clone() for k, v in model.state_dict().items()}
        else:
            since += 1
            if since >= cfg["patience"]:
                break

    model.load_state_dict(best_state)
    model.eval()
    with torch.no_grad():
        h = model()
        test_auc = auc_of(h, test, test_neg)
        y = np.r_[np.ones(len(test)), np.zeros(len(test_neg))]
        s = torch.cat([score(h, test), score(h, test_neg)]).numpy()
        test_ap = float(average_precision_score(y, s))

        # rank every pair absent from the corpus (candidates, not evidence)
        non_corpus = [(d, r) for d in range(n_dis) for r in range(n_reg)
                      if (d, r) not in positives]
        cand_scores = torch.sigmoid(score(h, non_corpus)).numpy()

    # bootstrap 95% CI on the test metrics (rng consumed after all results
    # above, so earlier numbers are untouched)
    sp = score(h, test).detach().numpy()
    sn = score(h, test_neg).detach().numpy()
    boot_auc, boot_ap = [], []
    for _ in range(2000):
        bp = sp[rng.integers(0, len(sp), len(sp))]
        bn = sn[rng.integers(0, len(sn), len(sn))]
        yb = np.r_[np.ones(len(bp)), np.zeros(len(bn))]
        sb = np.r_[bp, bn]
        boot_auc.append(roc_auc_score(yb, sb))
        boot_ap.append(average_precision_score(yb, sb))
    ci = lambda v: (round(float(np.percentile(v, 2.5)), 4),  # noqa: E731
                    round(float(np.percentile(v, 97.5)), 4))
    auc_lo, auc_hi = ci(boot_auc)
    ap_lo, ap_hi = ci(boot_ap)

    top = np.argsort(-cand_scores)[: cfg["topK"]]
    candidates = [
        {"disorder": disorders[non_corpus[i][0]],
         "region": regions[non_corpus[i][1]],
         "score": round(float(cand_scores[i]), 4),
         "label": "MODEL-SUGGESTED — not evidence"}
        for i in top
    ]

    typed = cfg["relations"] == "modality"
    run = {
        "runId": "linkpred_rgcn_typed_v1" if typed else "linkpred_rgcn_v1",
        "task": "link_prediction",
        "datasetDef": (
            f"Heterogeneous graph: {n_dis} disorders + {n_reg} regions + "
            f"{len(networks)} Yeo networks; {len(pairs)} distinct "
            "disorder-region pairs from the curated assertions (positives) + "
            "region-network membership edges. "
            + ("Disorder-region edges are TYPED by evidence modality "
               "category (imaging / electrophysiology / stimulation), one "
               "GCN relation each; same split and seed as linkpred_rgcn_v1 "
               "for direct comparison. "
               if typed else "")
            + "Study nodes excluded from the "
            "graph to prevent study-mediated train/test leakage."
        ),
        "splitStrategy": "grouped_pair_level",
        "preprocessing": (
            "Assertions collapsed to distinct disorder-region pairs; "
            "70/15/15 pair-level split "
            f"({len(train)}/{len(val)}/{len(test)}); message passing on "
            "train pairs only; seeded evaluation negatives disjoint from all "
            "positives. Caveat: training negatives exclude ALL positives "
            "(incl. held-out ones), and evaluation negatives can recur as "
            "training negatives — both make reported AUC/AP mildly "
            "optimistic."
        ),
        "model": (
            f"2-layer relational GCN over {len(adjs)} relations (learned "
            f"{cfg['hidden']}-d node embeddings, per-relation mean "
            "aggregation, dot-product decoder), "
            f"BCE with {cfg['negPerPos']} sampled negatives/positive, Adam "
            f"lr={cfg['lr']}, early stopping on validation ROC-AUC "
            f"(best epoch {best_epoch}). PyTorch {torch.__version__}, CPU."
        ),
        "config": {k: v for k, v in cfg.items()},
        "metrics": {
            "val_auc": round(best_val, 4),
            "test_auc": round(test_auc, 4),
            "test_ap": round(test_ap, 4),
            "baseline_cf_test_auc": round(cf_auc(test, test_neg), 4),
            "n_pairs": float(len(pairs)),
        },
        "uncertainty": {
            "test_auc_ci95_low": auc_lo,
            "test_auc_ci95_high": auc_hi,
            "test_ap_ci95_low": ap_lo,
            "test_ap_ci95_high": ap_hi,
        },
        "modelVersion": "v1",
        "created": date.today().isoformat(),
    }
    write_run(run, {"candidates": candidates})
    print(f"val AUC {best_val:.3f} (epoch {best_epoch}) | "
          f"test AUC {test_auc:.3f} | test AP {test_ap:.3f}")
    print("top candidates:", ", ".join(
        f"{c['disorder']}~{c['region']}({c['score']:.2f})" for c in candidates[:5]))
    return run


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--relations", choices=["binary", "modality"],
                        default="binary")
    run_linkpred({"relations": parser.parse_args().relations})
