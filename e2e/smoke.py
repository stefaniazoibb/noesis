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
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: console_errors.append(str(e)))

        print("landing + nav")
        page.goto(BASE, timeout=120_000)
        page.wait_for_load_state("networkidle")
        check("landing renders", "NOĒSIS" in page.locator("h1").inner_text())

        print("3D brain")
        page.goto(f"{BASE}/brain", timeout=120_000)
        page.wait_for_load_state("networkidle")
        page.wait_for_timeout(6000)  # GLB parse + first render
        box = page.locator("canvas").bounding_box()
        page.mouse.click(box["x"] + box["width"] * 0.42, box["y"] + box["height"] * 0.45)
        page.wait_for_timeout(800)
        panel = page.locator("aside").inner_text()
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

        browser.close()

    filtered = [e for e in console_errors if "503" not in e]
    check("no page errors", not filtered)
    print(f"\n{len(failures)} failure(s)" + (f": {failures}" if failures else ""))
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
