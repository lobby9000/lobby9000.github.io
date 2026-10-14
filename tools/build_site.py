#!/usr/bin/env python3
"""
Build the project sections of the site from projects.json.

projects.json is the single source of truth for every project card. This script
validates it and rewrites the blocks between the GENERATED markers in
professional.html (all projects, grouped by track) and cv.html (featured
projects only). Everything else in those pages is edited by hand.

    python3 tools/build_site.py           # validate and rewrite the pages
    python3 tools/build_site.py --check   # validate and fail if a page is out of date (CI)

Standard library only, so it runs anywhere Python 3.10+ does.
"""

from __future__ import annotations

import argparse
import html
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "projects.json"

STATUS_LABEL = {"live": "Live", "wip": "In progress", "pending": "Repo pending"}
STATUS_CLASS = {"live": "live", "wip": "wip", "pending": "wip"}
GITHUB_REPO_URL = re.compile(r"^https://github\.com/([^/]+/[^/#?]+)")


class InvalidProjects(ValueError):
    """projects.json breaks one of the rules below."""


def esc(text: str) -> str:
    return html.escape(text, quote=True)


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

def validate(data: dict, root: Path = ROOT) -> list[str]:
    """Return every problem found, so one run reports all of them."""
    problems: list[str] = []
    tracks = data.get("tracks", [])
    track_ids = [t.get("id") for t in tracks]
    if len(track_ids) != len(set(track_ids)):
        problems.append("track ids must be unique")
    for t in tracks:
        for key in ("id", "label", "icon", "intro"):
            if not t.get(key):
                problems.append(f"track {t.get('id')!r}: missing {key}")

    slugs: set[str] = set()
    for p in data.get("projects", []):
        where = f"project {p.get('slug')!r}"
        for key in ("slug", "title", "track", "status", "summary"):
            if not p.get(key):
                problems.append(f"{where}: missing {key}")
        if p.get("slug") in slugs:
            problems.append(f"{where}: duplicate slug")
        slugs.add(p.get("slug"))
        if not re.fullmatch(r"[a-z0-9-]+", p.get("slug", "")):
            problems.append(f"{where}: slug must be lowercase letters, digits and hyphens")
        if p.get("track") not in track_ids:
            problems.append(f"{where}: unknown track {p.get('track')!r}")
        if p.get("status") not in STATUS_LABEL:
            problems.append(f"{where}: status must be one of {sorted(STATUS_LABEL)}")
        if not isinstance(p.get("featured"), bool):
            problems.append(f"{where}: featured must be true or false")
        if not p.get("stack") or not all(isinstance(s, str) and s for s in p["stack"]):
            problems.append(f"{where}: stack must be a non-empty list of names")
        highlights = p.get("highlights", [])
        if not 1 <= len(highlights) <= 4:
            problems.append(f"{where}: give between 1 and 4 highlights")

        for img in p.get("images", []):
            src = img.get("src", "")
            if not (root / src).is_file():
                problems.append(f"{where}: image not found: {src}")
            for key in ("alt", "caption"):
                if not img.get(key):
                    problems.append(f"{where}: image {src} needs {key}")

        repo = p.get("repo")
        for link in p.get("links", []):
            if not link.get("label") or not link.get("url"):
                problems.append(f"{where}: every link needs label and url")
                continue
            m = GITHUB_REPO_URL.match(link["url"])
            # A card may only point at its own repository. This is the rule that
            # catches a card linking to another project's repo by copy and paste.
            if m and (not repo or m.group(1).lower() != repo.lower()):
                problems.append(f"{where}: links to {m.group(1)}, which is not its repo ({repo})")
        if p.get("ci_workflow") and not repo:
            problems.append(f"{where}: ci_workflow needs repo")
        if p.get("status") == "live" and not p.get("links") and not p.get("note"):
            problems.append(f"{where}: a live project needs a link or a note explaining why not")

        text = " ".join([p.get("title", ""), p.get("summary", "")] + list(highlights))
        if "—" in text:
            problems.append(f"{where}: avoid em dashes in the copy")

    for slug in data.get("featured_order", []):
        match = [p for p in data.get("projects", []) if p.get("slug") == slug]
        if not match:
            problems.append(f"featured_order: unknown project {slug!r}")
        elif not match[0].get("featured"):
            problems.append(f"featured_order: {slug!r} is not marked featured")
    return problems


def load(path: Path = DATA) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    problems = validate(data, path.parent)
    if problems:
        raise InvalidProjects("projects.json:\n  - " + "\n  - ".join(problems))
    return data


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

def badge(p: dict) -> str:
    if not (p.get("repo") and p.get("ci_workflow")) or p["status"] == "pending":
        return ""
    repo, wf = p["repo"], p["ci_workflow"]
    return (f'<a class="ci-link" href="https://github.com/{esc(repo)}/actions/workflows/{esc(wf)}" '
            f'target="_blank" rel="noopener"><img class="ci-badge" '
            f'src="https://github.com/{esc(repo)}/actions/workflows/{esc(wf)}/badge.svg" '
            f'alt="Test status of {esc(repo.split("/")[1])}" loading="lazy"></a>')


def gallery_title(title: str, limit: int = 30) -> str:
    """Window title in the style of the site: the part before any colon, words joined
    by underscores, cut at a word and never ending on a small word like "and"."""
    words = re.sub(r"[^A-Za-z0-9]+", " ", title.split(":")[0]).split()
    kept: list[str] = []
    for w in words:
        if len("_".join(kept + [w])) > limit:
            break
        kept.append(w)
    while kept and kept[-1].lower() in {"a", "an", "and", "the", "of", "with", "for", "in", "on", "to"}:
        kept.pop()
    return "_".join(kept) or "Gallery"


def card(p: dict, pad: str) -> str:
    status = p["status"]
    out = [f'{pad}<article class="project-card" id="project-{esc(p["slug"])}">',
           f'{pad}  <h3>{esc(p["title"])} <span class="status {STATUS_CLASS[status]}">{STATUS_LABEL[status]}</span></h3>',
           f'{pad}  <p class="tags">' + "".join(f'<span class="tag">{esc(s)}</span>' for s in p["stack"]) + "</p>",
           f'{pad}  <p>{esc(p["summary"])}</p>',
           f'{pad}  <ul class="highlights">']
    out += [f"{pad}    <li>{esc(h)}</li>" for h in p["highlights"]]
    out.append(f"{pad}  </ul>")
    if p.get("snippet"):
        out.append(f'{pad}  <pre class="snippet">{esc(p["snippet"])}</pre>')
    if p.get("note"):
        out.append(f'{pad}  <p class="note">{esc(p["note"])}</p>')
    images = p.get("images", [])
    if images:
        out.append(f'{pad}  <div class="carrusel-mini">')
        for img in images:
            out.append(
                f'{pad}    <img src="{esc(img["src"])}" alt="{esc(img["alt"])}" class="shot" loading="lazy" '
                f'data-caption="{esc(img["caption"])}" data-description="{esc(img.get("description", img["alt"]))}">')
        out.append(f"{pad}  </div>")
        if len(images) > 1:
            out.append(f'{pad}  <button class="btn-galeria" data-gallery-title="{esc(gallery_title(p["title"]))}">'
                       f"⊞ View full gallery</button>")
    if p.get("embed"):
        out.append(f'{pad}  <iframe class="dashboard-frame" src="{esc(p["embed"]["src"])}" '
                   f'title="{esc(p["embed"]["title"])}" loading="lazy"></iframe>')
    out.append(f'{pad}  <div class="link-row">')
    if status == "pending":
        out.append(f'{pad}    <span class="pending-note">Repository being published</span>')
    else:
        out += [f'{pad}    <a href="{esc(link["url"])}" target="_blank" rel="noopener">{esc(link["label"])}</a>'
                for link in p.get("links", [])]
        if p.get("ci_workflow"):
            out.append(f"{pad}    {badge(p)}")
    out.append(f"{pad}  </div>")
    out.append(f"{pad}</article>")
    return "\n".join(out)


def render_projects(data: dict) -> str:
    pad = "          "
    tracks = data["tracks"]
    by_track = {t["id"]: [p for p in data["projects"] if p["track"] == t["id"]] for t in tracks}
    lines = [f'{pad}<div class="tab-strip" role="tablist" aria-label="Project tracks">']
    for i, t in enumerate(tracks):
        active = " active" if i == 0 else ""
        lines.append(
            f'{pad}  <button class="tab-btn{active}" role="tab" aria-selected="{"true" if i == 0 else "false"}" '
            f'aria-controls="tab-{t["id"]}" data-tab="tab-{t["id"]}" title="{esc(t["label"])}">'
            f'{t["icon"]} {esc(t.get("tab", t["label"]))} '
            f'<span class="tab-count">{len(by_track[t["id"]])}</span></button>')
    lines.append(f"{pad}</div>")
    for i, t in enumerate(tracks):
        active = " active" if i == 0 else ""
        lines.append("")
        lines.append(f'{pad}<div id="tab-{t["id"]}" class="tab-panel{active}" role="tabpanel">')
        lines.append(f'{pad}  <p class="panel-intro"><strong>{esc(t["label"])}.</strong> {esc(t["intro"])}</p>')
        for p in by_track[t["id"]]:
            lines.append(card(p, pad + "  "))
        lines.append(f"{pad}</div>")
    return "\n".join(lines)


def render_featured(data: dict) -> str:
    pad = "      "
    by_slug = {p["slug"]: p for p in data["projects"]}
    lines = []
    for slug in data["featured_order"]:
        p = by_slug[slug]
        if p["status"] == "pending":
            continue          # the recruiter page only lists work that can be opened
        primary = p["links"][0]["url"] if p.get("links") else None
        title = (f'<a href="{esc(primary)}">{esc(p["title"])}</a>' if primary else esc(p["title"]))
        lines.append(f'{pad}<article class="cv-project">')
        lines.append(f"{pad}  <h3>{title}</h3>")
        lines.append(f'{pad}  <p class="cv-stack">{esc(" · ".join(p["stack"]))}</p>')
        lines.append(f'{pad}  <p>{esc(p["summary"])}</p>')
        lines.append(f"{pad}  <ul>")
        lines += [f"{pad}    <li>{esc(h)}</li>" for h in p["highlights"][:2]]
        lines.append(f"{pad}  </ul>")
        links = " · ".join(f'<a href="{esc(link["url"])}">{esc(link["label"])}</a>' for link in p.get("links", []))
        if links:
            lines.append(f'{pad}  <p class="cv-links">{links}</p>')
        elif p.get("note"):
            lines.append(f'{pad}  <p class="cv-links">{esc(p["note"])}</p>')
        lines.append(f"{pad}</article>")
    return "\n".join(lines)


# ---------------------------------------------------------------------------
# Page surgery
# ---------------------------------------------------------------------------

def replace_block(page: str, name: str, body: str) -> str:
    begin = f"<!-- BEGIN GENERATED: {name} -->"
    end = f"<!-- END GENERATED: {name} -->"
    i, j = page.find(begin), page.find(end)
    if i < 0 or j < i:
        raise InvalidProjects(f"markers for {name!r} not found or out of order")
    line_start = page.rfind("\n", 0, j) + 1
    indent = page[line_start:j]
    return page[: i + len(begin)] + "\n" + body + "\n" + indent + page[j:]


def build(root: Path = ROOT) -> dict[Path, str]:
    data = load(root / "projects.json")
    outputs = {}
    for page, name, render in (("professional.html", "projects", render_projects),
                               ("cv.html", "featured", render_featured)):
        path = root / page
        outputs[path] = replace_block(path.read_text(encoding="utf-8"), name, render(data))
    return outputs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[1])
    parser.add_argument("--check", action="store_true",
                        help="do not write; fail if a generated block is out of date")
    args = parser.parse_args(argv)
    try:
        outputs = build()
    except InvalidProjects as exc:
        print(exc, file=sys.stderr)
        return 1
    stale = []
    for path, content in outputs.items():
        if path.read_text(encoding="utf-8") != content:
            stale.append(path.name)
            if not args.check:
                path.write_text(content, encoding="utf-8")
    if args.check and stale:
        print("Out of date with projects.json: " + ", ".join(stale) +
              "\nRun: python3 tools/build_site.py", file=sys.stderr)
        return 1
    print("Up to date." if not stale else "Rewrote: " + ", ".join(stale))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
