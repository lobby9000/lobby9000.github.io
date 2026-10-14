"""
Checks that gate every release of the site (see .github/workflows/site.yml).

    python -m pytest -q tests

They run offline and only need pytest.
"""

from __future__ import annotations

import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit

import pytest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import build_site  # noqa: E402

PAGES = sorted(p for p in ROOT.glob("*.html"))
MAIN_PAGES = ["index.html", "professional.html", "cv.html", "fun.html"]
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
CHECKED_TAGS = {"div", "section", "article", "main", "nav", "header", "footer", "ul", "ol", "a",
                "button", "h1", "h2", "h3", "table", "form", "iframe", "script", "style"}


class Collector(HTMLParser):
    """Collects references, images, links and tag balance from one page."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.refs: list[str] = []
        self.imgs: list[dict] = []
        self.blank_links: list[dict] = []
        self.stack: list[tuple[str, int]] = []
        self.unbalanced: list[str] = []
        self.title = ""
        self._in_title = False
        self.meta: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        for key in ("href", "src"):
            if a.get(key):
                self.refs.append(a[key])
        if tag == "img":
            self.imgs.append(a)
        if tag == "a" and a.get("target") == "_blank":
            self.blank_links.append(a)
        if tag == "meta" and a.get("name"):
            self.meta[a["name"]] = a.get("content", "")
        if tag == "title":
            self._in_title = True
        if tag in CHECKED_TAGS:
            self.stack.append((tag, self.getpos()[0]))

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag in CHECKED_TAGS:
            self.stack.pop()

    def handle_endtag(self, tag):
        if tag == "title":
            self._in_title = False
        if tag not in CHECKED_TAGS:
            return
        if not self.stack or self.stack[-1][0] != tag:
            opened = self.stack[-1] if self.stack else None
            self.unbalanced.append(f"line {self.getpos()[0]}: </{tag}> closes {opened}")
            # recover: pop to the matching tag if it is open
            for i in range(len(self.stack) - 1, -1, -1):
                if self.stack[i][0] == tag:
                    del self.stack[i:]
                    break
            return
        self.stack.pop()

    def handle_data(self, data):
        if self._in_title:
            self.title += data


def parse(page: Path) -> Collector:
    c = Collector()
    c.feed(page.read_text(encoding="utf-8"))
    c.close()
    return c


def script_and_css_refs(text: str) -> list[str]:
    """Paths that live inside CSS url() or JavaScript strings rather than attributes."""
    # url('x'), url("x"), url(x) and url(\'x\') inside a JavaScript string
    refs = re.findall(r"url\(\\?['\"]?([^'\"\\)]+)\\?['\"]?\)", text)
    refs += re.findall(r"['\"]((?:/?assets/)[^'\"\s]+\.(?:png|jpe?g|gif|svg|pdf|html|json))['\"]", text)
    refs += re.findall(r"leaveTo\('([^']+)'\)", text)
    return refs


def is_local(ref: str) -> bool:
    if ref.startswith(("#", "mailto:", "tel:", "javascript:", "data:", "//")):
        return False
    scheme = urlsplit(ref).scheme
    return scheme == ""


def resolve(page: Path, ref: str) -> Path:
    path = unquote(urlsplit(ref).path)
    if path.startswith("/"):
        return ROOT / path.lstrip("/")
    return (page.parent / path)


# ---------------------------------------------------------------------------

def test_projects_json_is_valid():
    data = build_site.load()
    assert data["projects"], "no projects"


def test_generated_blocks_match_projects_json():
    for path, content in build_site.build().items():
        assert path.read_text(encoding="utf-8") == content, (
            f"{path.name} is out of date with projects.json: run python3 tools/build_site.py")


def test_a_card_cannot_link_to_another_projects_repo():
    data = build_site.load()
    data["projects"][0]["links"].append({"label": "Repo", "url": "https://github.com/lobby9000/some-other-repo"})
    assert any("not its repo" in p for p in build_site.validate(data))


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_every_local_reference_resolves(page):
    text = page.read_text(encoding="utf-8")
    refs = parse(page).refs + script_and_css_refs(text)
    missing = sorted({r for r in refs if is_local(r) and not resolve(page, r).exists()})
    assert not missing, f"{page.name} points at files that do not exist: {missing}"


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_tags_are_balanced(page):
    c = parse(page)
    assert not c.unbalanced, c.unbalanced[:5]
    assert not c.stack, f"never closed: {c.stack[:5]}"


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_images_declare_alt_text(page):
    without = [img.get("src") for img in parse(page).imgs if "alt" not in img]
    assert not without, f"{page.name}: images without alt: {without}"


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_links_in_new_tabs_use_noopener(page):
    bad = [a.get("href") for a in parse(page).blank_links if "noopener" not in (a.get("rel") or "")]
    assert not bad, f"{page.name}: target=_blank without rel=noopener: {bad}"


@pytest.mark.parametrize("name", MAIN_PAGES)
def test_main_pages_have_title_and_description(name):
    c = parse(ROOT / name)
    assert c.title.strip(), f"{name} has no <title>"
    assert c.meta.get("description", "").strip(), f"{name} has no meta description"


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_no_placeholders_left(page):
    text = page.read_text(encoding="utf-8")
    for marker in ("[INSERT", "Screenshot slot", "Project title", "lorem ipsum", "Repo pending</h3>"):
        assert marker not in text, f"{page.name} still contains {marker!r}"


@pytest.mark.parametrize("page", PAGES, ids=lambda p: p.name)
def test_nothing_points_back_to_neocities(page):
    text = page.read_text(encoding="utf-8")
    assert not re.search(r"(href|src)=\"https?://[^\"]*neocities\.org", text), page.name


def test_cv_pdfs_are_real_pdfs():
    pdfs = sorted((ROOT / "assets" / "cv").glob("*.pdf"))
    assert {p.name for p in pdfs} >= {"CV_Luis_Angel_Quiroz_Lopez_EN.pdf", "CV_Luis_Angel_Quiroz_Lopez_ES.pdf"}
    for p in pdfs:
        assert p.read_bytes()[:5] == b"%PDF-", p.name


def test_sitemap_lists_only_existing_pages():
    sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
    for loc in re.findall(r"<loc>https://lobby9000\.github\.io/([^<]*)</loc>", sitemap):
        assert (ROOT / (loc or "index.html")).exists(), loc


def test_pending_projects_stay_off_the_recruiter_page():
    data = build_site.load()
    cv = (ROOT / "cv.html").read_text(encoding="utf-8")
    for p in data["projects"]:
        if p["status"] == "pending":
            assert p["title"] not in cv, p["slug"]


# ---------------------------------------------------------------------------
# Terminal, demos and games (assets/apps). The browser checks are in test_apps.py.

APPS = ROOT / "assets" / "apps"


def test_app_scripts_the_page_loads_exist():
    text = (ROOT / "professional.html").read_text(encoding="utf-8")
    block = re.search(r"var APP_SCRIPTS = \[(.*?)\];", text, re.S)
    assert block, "professional.html no longer lists APP_SCRIPTS"
    scripts = re.findall(r"'([^']+\.js)'", block.group(1))
    assert len(scripts) >= 6, scripts
    assert not [s for s in scripts if not (ROOT / s).is_file()]


def test_app_styles_point_at_real_files():
    css = APPS / "apps.css"
    refs = re.findall(r"url\(['\"]?([^'\")]+)['\"]?\)", css.read_text(encoding="utf-8"))
    missing = [r for r in refs if is_local(r) and not (css.parent / r).resolve().exists()]
    assert not missing, missing


def test_demo_data_has_every_section():
    text = (APPS / "demo-data.js").read_text(encoding="utf-8")
    assert text.startswith("/* Generated by tools/demo_data.py")
    data = json.loads(text[text.index("{"): text.rindex("}") + 1])
    assert set(data) == {"btc", "api", "qa", "vigia", "notes", "retail", "inflation"}
    assert len(data["btc"]["closes"]) > 1000
    assert len(data["vigia"]["p95"]) == len(data["vigia"]["requests"]) == 192


def test_every_project_demo_is_registered_in_the_terminal():
    registered = build_site.demo_commands()
    assert registered, "no demos found in assets/apps/demos.js"
    for p in build_site.load()["projects"]:
        assert set(p.get("demos", [])) <= registered, p["slug"]


def test_a_card_cannot_offer_a_demo_that_does_not_exist():
    data = build_site.load()
    data["projects"][0]["demos"] = ["nope"]
    assert any("not registered" in p for p in build_site.validate(data))


def test_vendored_stemmer_keeps_its_licence():
    text = (APPS / "vendor" / "snowball-spanish.js").read_text(encoding="utf-8")
    assert "Copyright (c) 2001, Dr Martin Porter" in text
    assert "Redistribution and use in source and binary forms" in text
