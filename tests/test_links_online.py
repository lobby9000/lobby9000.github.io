"""
Every link and badge that points at one of my GitHub repositories responds.

    python -m pytest -q tests -m network

Needs internet access. CI runs it before publishing, so a renamed repository
or a moved file cannot leave a dead link on the site.
"""

from __future__ import annotations

import re
import time
import urllib.error
import urllib.request
from pathlib import Path

import pytest

pytestmark = pytest.mark.network

ROOT = Path(__file__).resolve().parents[1]
PAGES = sorted(ROOT.glob("*.html"))
GITHUB = re.compile(r'(?:href|src)="(https://github\.com/lobby9000/[^"#]+)')


def github_urls() -> list[str]:
    urls = set()
    for page in PAGES:
        urls.update(GITHUB.findall(page.read_text(encoding="utf-8")))
    return sorted(urls)


def status(url: str) -> int | str:
    """HTTP status of url, retried once on rate limits, server errors and timeouts."""
    for attempt in range(2):
        for method in ("HEAD", "GET"):
            req = urllib.request.Request(url, method=method, headers={"User-Agent": "lobby9000-site-check"})
            try:
                with urllib.request.urlopen(req, timeout=20) as resp:
                    return resp.status
            except urllib.error.HTTPError as exc:
                if exc.code == 405 and method == "HEAD":
                    continue
                if exc.code in (429, 500, 502, 503, 504) and attempt == 0:
                    break
                return exc.code
            except (urllib.error.URLError, TimeoutError) as exc:
                if attempt == 0:
                    break
                return str(exc)[:80]
        time.sleep(3)
    return "no answer"


def test_the_site_links_to_github():
    assert len(github_urls()) > 10


@pytest.mark.parametrize("url", github_urls())
def test_github_link_responds(url):
    code = status(url)
    assert code == 200, f"{url} answered {code}"
