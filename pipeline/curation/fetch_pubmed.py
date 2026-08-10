"""Fetch real study metadata + abstracts from PubMed (NCBI E-utilities).

Usage:
  python fetch_pubmed.py search "amygdala depression fMRI meta-analysis" --max 10
  python fetch_pubmed.py fetch 26122586 28469833

Every fetched record is cached verbatim-parsed to cache/pmid_<id>.json.
Curation MUST work only from these cached records — never from memory.
"""

import argparse
import json
import sys
import time
import xml.etree.ElementTree as ET
from pathlib import Path

import httpx

BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
CACHE = Path(__file__).parent / "cache"
DELAY_S = 0.4  # stay under NCBI rate limits


def esearch(query: str, retmax: int) -> list[str]:
    r = httpx.get(
        f"{BASE}/esearch.fcgi",
        params={
            "db": "pubmed", "term": query, "retmax": retmax,
            "retmode": "json", "sort": "relevance",
        },
        timeout=30,
    )
    r.raise_for_status()
    return r.json()["esearchresult"]["idlist"]


def parse_article(art: ET.Element) -> dict:
    pmid = art.findtext(".//PMID")
    title = "".join((art.find(".//ArticleTitle") is not None and
                     ET.tostring(art.find(".//ArticleTitle"), method="text",
                                 encoding="unicode") or "").split("\n")).strip()
    abstract_parts = []
    for ab in art.findall(".//Abstract/AbstractText"):
        label = ab.get("Label")
        text = ET.tostring(ab, method="text", encoding="unicode").strip()
        abstract_parts.append(f"{label}: {text}" if label else text)
    journal = art.findtext(".//Journal/Title")
    year = art.findtext(".//JournalIssue/PubDate/Year") or art.findtext(
        ".//JournalIssue/PubDate/MedlineDate", ""
    )[:4]
    authors = []
    for a in art.findall(".//AuthorList/Author"):
        last, init = a.findtext("LastName"), a.findtext("Initials")
        if last:
            authors.append(f"{last} {init}" if init else last)
    # PubmedData/ArticleIdList only — the article's own ids. A broader search
    # would also match ids inside the ReferenceList (wrong DOIs).
    doi = None
    for el in art.findall("./PubmedData/ArticleIdList/ArticleId"):
        if el.get("IdType") == "doi":
            doi = (el.text or "").strip()
            break
    return {
        "pmid": pmid, "title": title, "authors": authors,
        "year": int(year) if year and year.isdigit() else None,
        "journal": journal, "doi": doi,
        "abstract": "\n".join(abstract_parts),
        "fetched_from": "pubmed_efetch",
    }


def efetch(pmids: list[str]) -> list[dict]:
    records = []
    for i in range(0, len(pmids), 20):
        chunk = pmids[i : i + 20]
        r = httpx.get(
            f"{BASE}/efetch.fcgi",
            params={"db": "pubmed", "id": ",".join(chunk), "retmode": "xml"},
            timeout=60,
        )
        r.raise_for_status()
        root = ET.fromstring(r.text)
        for art in root.findall(".//PubmedArticle"):
            rec = parse_article(art)
            records.append(rec)
            (CACHE / f"pmid_{rec['pmid']}.json").write_text(
                json.dumps(rec, indent=2, ensure_ascii=False)
            )
        time.sleep(DELAY_S)
    return records


def main():
    CACHE.mkdir(exist_ok=True)
    ap = argparse.ArgumentParser()
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("search")
    s.add_argument("query")
    s.add_argument("--max", type=int, default=10)
    f = sub.add_parser("fetch")
    f.add_argument("pmids", nargs="+")
    args = ap.parse_args()

    if args.cmd == "search":
        ids = esearch(args.query, args.max)
        time.sleep(DELAY_S)
        records = efetch(ids)
        print(f"# query: {args.query}", file=sys.stderr)
    else:
        records = efetch(args.pmids)

    for r in records:
        print(json.dumps(
            {k: (r[k][:300] + "…" if k == "abstract" and len(r[k]) > 300 else r[k])
             for k in ("pmid", "year", "title", "journal", "doi", "abstract")},
            ensure_ascii=False))
    print(f"# cached {len(records)} records in {CACHE}", file=sys.stderr)


if __name__ == "__main__":
    main()
