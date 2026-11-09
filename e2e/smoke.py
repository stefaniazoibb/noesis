"""NOĒSIS end-to-end smoke suite (run via e2e/run.py or `npm run e2e`).

Covers the load-bearing flows: 3D picking on real anatomy, evidence overlay
legends, disorder pages (incl. gaps + personal-experience note), evidence
browser + study detail, comparison, representation space, search, and the
assistant's graceful degradation. Requires: pip install playwright &&
playwright install chromium. Assumes the app on http://localhost:3000.
"""

import re
import sys

from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
failures: list[str] = []
console_errors: list[str] = []


def check(name: str, ok: bool):
    print(f"  {'PASS' if ok else 'FAIL'}  {name}")
    if not ok:
        failures.append(name)


def main() -> int:
    with sync_playwright() as p:
        # SwiftShader keeps WebGL available on GPU-less CI runners; harmless
        # locally (Playwright headless Chromium already software-renders)
        browser = p.chromium.launch(
            headless=True,
            args=["--use-gl=angle", "--use-angle=swiftshader"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        print("landing + nav")
        page.goto(BASE, timeout=120_000)
        page.wait_for_load_state("networkidle")
        check("landing renders", "Understanding the brain" in page.locator("h1").inner_text()
              and "NOĒSIS" in page.locator("header").first.inner_text())

        print("3D brain")
        page.goto(f"{BASE}/brain", timeout=120_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(6000)  # GLB parse + first render
        box = page.locator("canvas").bounding_box()
        # first render can take longer on GPU-less CI runners: retry the
        # pick until the region panel answers (a miss is harmless)
        panel = ""
        for _ in range(8):
            page.mouse.click(
                box["x"] + box["width"] * 0.42, box["y"] + box["height"] * 0.45
            )
            page.wait_for_timeout(800)
            panel = page.locator("aside").inner_text()
            if "hemisphere" in panel.lower():
                break
        check("region picking returns a named region", "hemisphere" in panel.lower())
        page.get_by_role("button", name="Save", exact=True).click()
        page.wait_for_timeout(300)

        page.get_by_role("button", name="Evidence", exact=True).click()
        page.locator("select").first.select_option("schizophrenia")
        page.wait_for_timeout(1200)
        check("evidence legend", page.locator("text=Evidence density").count() > 0)
        page.get_by_role("button", name="Gaps", exact=True).click()
        page.wait_for_timeout(1200)
        check("gaps legend", page.locator("text=Evidence structure").count() > 0)

        print("disorders")
        page.goto(f"{BASE}/disorders/post_traumatic_stress_disorder", timeout=60_000)
        page.wait_for_load_state("networkidle")
        body = page.locator("main").inner_text()
        check("disorder page evidence", "INDEXED STUDIES" in body.upper())
        check("personal-experience note", "lived experience" in body)
        check("gaps section", "CONFLICTS & GAPS" in body.upper())
        check("research opportunities", "RESEARCH OPPORTUNITIES" in body.upper())

        print("evidence browser")
        page.goto(f"{BASE}/evidence", timeout=60_000)
        page.wait_for_load_state("networkidle")
        m = re.search(r"(\d+) of (\d+) studies", page.locator("main").inner_text())
        check("corpus listed", bool(m) and int(m.group(2)) >= 60)
        page.locator("main li a").first.click()
        page.wait_for_url("**/evidence/study_*", timeout=15_000)
        detail = page.locator("main").inner_text()
        check("study detail provenance", "PMID" in detail)
        check("curation status shown", "review" in detail or "yes" in detail)

        print("compare")
        page.goto(f"{BASE}/compare", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.get_by_label("First disorder…").select_option("major_depressive_disorder")
        page.get_by_label("Second disorder…").select_option("post_traumatic_stress_disorder")
        page.wait_for_timeout(1500)
        check("shared regions", "Hippocampus" in page.locator("main").inner_text())

        print("representation space")
        page.goto(f"{BASE}/ml", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        check("region points plotted", page.locator("svg circle").count() >= 50)

        print("ML Lab model runs")
        page.goto(f"{BASE}/ml/lab", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1500)
        lab = page.locator("main").inner_text()
        check("alignment + linkpred run cards", "Representation alignment" in lab
              and "Graph link prediction" in lab)
        check("validation protocols declared", "Permutation test" in lab
              and "Grouped pair-level split" in lab)
        check("candidates labeled model-suggested, not evidence",
              lab.lower().count("model-suggested") >= 20)

        print("search")
        page.goto(BASE, timeout=60_000)
        page.get_by_role("searchbox").fill("amygdala")
        page.wait_for_timeout(600)
        check("search results", page.locator("li button").count() > 0)

        print("notebook")
        page.goto(f"{BASE}/notebook", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(500)
        nb = page.locator("main").inner_text().upper()
        check("saved region appears in notebook", "BRAIN REGIONS (1)" in nb)

        print("assistant (graceful without key / answers with key)")
        page.goto(f"{BASE}/assistant", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.locator("main li button, main button").filter(
            has_text="depression"
        ).first.click()
        page.wait_for_timeout(20_000)
        text = page.locator("main").inner_text()
        check(
            "assistant responds (answer or setup notice)",
            "Anthropic API key" in text or "[1]" in text or "corpus" in text,
        )


        print("landing narrative (data-driven)")
        import json, pathlib
        root = pathlib.Path(__file__).parent.parent
        n_studies = len(json.loads((root / "data/studies/studies.json").read_text()))
        n_assert = len(json.loads((root / "data/evidence/assertions.json").read_text()))
        page.goto(BASE, timeout=60_000)
        page.wait_for_load_state("networkidle")
        ev = page.locator("#evidence")
        ev.scroll_into_view_if_needed()
        page.wait_for_timeout(2500)
        ev_text = ev.inner_text()
        check("landing counters match the data files",
              str(n_studies) in ev_text and str(n_assert) in ev_text)
        check("provenance chain links a DOI/PMID",
              page.locator("#evidence a[href*='doi.org'], #evidence a[href*='pubmed']").count() > 0)
        for sid in ["convergence", "disagreement", "gaps", "representations", "ask", "enter"]:
            check(f"landing section #{sid}", page.locator(f"#{sid}").count() == 1)
        check("ask section shows real source cards",
              page.locator("#ask a[href^='/evidence/study_']").count() >= 3)
        check("landing page scrolls (no scroll lock)",
              page.evaluate("document.documentElement.scrollHeight > 4 * window.innerHeight"))

        print("explore: anatomical search")
        page.goto(f"{BASE}/brain", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(4000)
        page.get_by_label("Find a brain region by anatomical name").fill("insula")
        page.wait_for_timeout(300)
        page.keyboard.press("Enter")
        page.wait_for_timeout(1500)
        check("region search selects the region", "Insula" in page.locator("aside").inner_text())
        page.get_by_role("button", name="Reset view").click()
        page.wait_for_timeout(800)
        check("reset view clears the selection", "Insula" not in page.locator("aside").inner_text())

        print("convergence explorer")
        page.goto(f"{BASE}/convergence", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        check("convergence profiles listed", page.locator("tbody tr").count() >= 10)
        page.get_by_role("button", name="≥2 categories").click()
        page.wait_for_timeout(500)
        rows = page.locator("tbody tr").count()
        check("≥2-category filter narrows the table", 0 < rows < 40)
        page.locator("tbody tr button[aria-expanded]").first.click()
        page.wait_for_timeout(500)
        check("profile expands to its studies",
              page.locator("tbody a[href^='/evidence/study_']").count() > 0)

        print("research gaps")
        page.goto(f"{BASE}/gaps", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(1000)
        gtext = page.locator("main").inner_text()
        check("gap cards with provenance", page.locator("main li a[href^='/evidence/study_']").count() > 5)
        check("modality matrix + sparse coverage",
              "Missing modality combinations" in gtext and "sparse coverage" in gtext)
        check("curation-gap caveat shown", "curation gap" in gtext)

        print("evidence traceability")
        page.goto(f"{BASE}/evidence?disorder=autism_spectrum_disorder", timeout=60_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(800)
        page.get_by_role("button", name="Trace evidence").first.click()
        page.wait_for_timeout(500)
        check("trace panel lists region assertions",
              page.locator("aside a[href^='/brain?region=']").count() > 0)

        print("about")
        page.goto(f"{BASE}/about", timeout=60_000)
        page.wait_for_load_state("networkidle")
        atext = page.locator("main").inner_text()
        check("about: methodology, metrics, sources, limitations",
              all(k in atext for k in ["Methodology", "Metric definitions", "Data sources", "Limitations"]))

        print("mobile")
        m = browser.new_page(viewport={"width": 390, "height": 844}, is_mobile=True, has_touch=True)
        m.on("pageerror", lambda e: console_errors.append(str(e)))
        for path in ["/", "/brain", "/evidence", "/convergence", "/gaps", "/ml", "/assistant", "/about"]:
            m.goto(f"{BASE}{path}", timeout=60_000)
            m.wait_for_load_state("networkidle")
            m.wait_for_timeout(800)
            over = m.evaluate("document.documentElement.scrollWidth - window.innerWidth")
            check(f"mobile {path}: no horizontal page scroll", over <= 1)
        m.goto(BASE, timeout=60_000)
        m.get_by_role("button", name="Menu").click()
        m.wait_for_timeout(300)
        check("mobile menu lists sections",
              m.locator("#mobile-nav a[href='/convergence']").count() == 1)
        m.close()

        browser.close()

    filtered = [e for e in console_errors if "503" not in e]
    check("no page errors", not filtered)
    print(f"\n{len(failures)} failure(s)" + (f": {failures}" if failures else ""))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
