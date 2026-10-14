"""
Checks in a real browser (Chromium through Playwright).

    python -m pip install playwright && python -m playwright install chromium
    python -m pytest -q tests -m browser

The static checks in test_site.py read the HTML. These load it: they catch
script errors, images that fail to decode, layouts that overflow a phone and
navigation that stops working, none of which shows up in the markup.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

pytestmark = pytest.mark.browser

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(p.name for p in ROOT.glob("*.html"))
# Pages meant to work on a phone. The XP desktop pages are desktop-first by design.
MOBILE_PAGES = ["cv.html", "qa-case-study.html"]
PROFESSIONAL = (ROOT / "professional.html").read_text(encoding="utf-8")
CARD_IDS = re.findall(r'<article class="project-card" id="([^"]+)"', PROFESSIONAL)
GALLERIES = re.findall(r'id="(project-[^"]+)">(?:(?!</article>).)*?class="btn-galeria"', PROFESSIONAL, re.S)

LOCAL_IMAGES = "[...document.images].filter(i => !/^(https?:)?\\/\\//.test(i.getAttribute('src') || ''))"


@pytest.mark.parametrize("page", PAGES)
def test_page_loads_without_errors(tab, site_url, page):
    errors, failed = [], []
    tab.on("pageerror", lambda exc: errors.append(str(exc)))
    # External resources (fonts, the embedded dashboard) are judged by the
    # network-marked checks, so only local files can fail this test.
    tab.on("console", lambda msg: errors.append(msg.text)
           if msg.type == "error" and not msg.text.startswith("Failed to load resource") else None)
    tab.on("response", lambda r: failed.append(f"{r.status} {r.url}")
           if r.url.startswith(site_url) and r.status >= 400 else None)
    tab.on("requestfailed", lambda r: failed.append(f"failed {r.url}") if r.url.startswith(site_url) else None)
    tab.goto(f"{site_url}/{page}", wait_until="load")
    tab.wait_for_timeout(400)
    assert failed == [], f"{page}: local requests failed: {failed}"
    assert errors == [], f"{page}: JavaScript errors: {errors}"


@pytest.mark.parametrize("page", PAGES)
def test_local_images_decode(tab, site_url, page):
    tab.goto(f"{site_url}/{page}", wait_until="load")
    # Lazy images in closed tabs would never load on their own, so load them all.
    tab.evaluate(f"() => Promise.all({LOCAL_IMAGES}.map(i => {{ i.loading = 'eager'; return i.decode().catch(() => null); }}))")
    broken = tab.evaluate(f"() => {LOCAL_IMAGES}.filter(i => i.naturalWidth === 0).map(i => i.getAttribute('src'))")
    assert broken == [], f"{page}: images that did not decode: {broken}"


@pytest.mark.parametrize("page", MOBILE_PAGES)
def test_no_sideways_scroll_on_a_phone(browser, site_url, page):
    tab = browser.new_page(viewport={"width": 390, "height": 844})
    tab.goto(f"{site_url}/{page}", wait_until="load")
    overflow = tab.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    tab.close()
    assert overflow <= 0, f"{page} scrolls sideways by {overflow}px at 390px wide"


def test_each_project_tab_shows_its_own_cards(tab, site_url):
    tab.goto(f"{site_url}/professional.html", wait_until="load")
    tab.click('.nav-btn[data-section="projects"]')
    buttons = tab.locator(".tab-btn[data-tab]")
    assert buttons.count() >= 2
    for i in range(buttons.count()):
        button = buttons.nth(i)
        panel_id = button.get_attribute("data-tab")
        button.click()
        expected = int(button.locator(".tab-count").inner_text())
        assert tab.locator(f"#{panel_id}").is_visible()
        visible = tab.locator(".tab-panel .project-card:visible")
        shown = visible.evaluate_all("cards => cards.map(c => c.closest('.tab-panel').id)")
        assert shown == [panel_id] * expected, f"tab {panel_id}: expected {expected} cards of its own, saw {shown}"


@pytest.mark.parametrize("card_id", CARD_IDS)
def test_deep_link_opens_its_card(tab, site_url, card_id):
    # The repositories link to professional.html#project-<slug> from their GitHub page.
    tab.goto(f"{site_url}/professional.html#{card_id}", wait_until="load")
    tab.wait_for_function(
        """id => {
            const card = document.getElementById(id), area = document.querySelector('.content-area');
            if (!card || card.offsetParent === null) return false;
            const r = card.getBoundingClientRect(), a = area.getBoundingClientRect();
            return r.top >= a.top - 1 && r.top < a.bottom;
        }""",
        arg=card_id, timeout=3000)


@pytest.mark.parametrize("card_id", GALLERIES)
def test_gallery_window_holds_every_image_of_its_card(tab, site_url, card_id):
    tab.goto(f"{site_url}/professional.html#{card_id}", wait_until="load")
    card = tab.locator(f"#{card_id}")
    expected = card.locator(".carrusel-mini img").count()
    card.locator(".btn-galeria").click()
    thumbs = tab.locator(".mosaico-grid .shot-mosaico")
    thumbs.first.wait_for(timeout=3000)
    assert thumbs.count() == expected


def test_case_study_round_trip(tab, site_url):
    tab.goto(f"{site_url}/professional.html", wait_until="load")
    tab.click("text=QA Case Study")
    tab.wait_for_url("**/qa-case-study.html", timeout=3000)
    tab.click("text=Professional Log")
    tab.wait_for_url("**/professional.html", timeout=3000)
