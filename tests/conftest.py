"""
Shared fixtures for the browser checks.

The site is served from this folder on a free local port, so Chromium sees it
the way GitHub Pages will serve it. Playwright is only needed for the tests
marked `browser`; without it they are skipped locally and fail in CI.
"""

from __future__ import annotations

import functools
import http.server
import os
import socketserver
import threading
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]


class _QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


@pytest.fixture(scope="session")
def site_url():
    handler = functools.partial(_QuietHandler, directory=str(ROOT))
    server = socketserver.TCPServer(("127.0.0.1", 0), handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    yield f"http://127.0.0.1:{server.server_address[1]}"
    server.shutdown()
    server.server_close()


@pytest.fixture(scope="session")
def browser():
    if os.environ.get("CI"):
        from playwright.sync_api import sync_playwright  # in CI a missing browser is a failure
    else:
        sync_api = pytest.importorskip(
            "playwright.sync_api",
            reason="pip install playwright, then python -m playwright install chromium",
        )
        sync_playwright = sync_api.sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch()
        yield b
        b.close()


@pytest.fixture()
def tab(browser):
    page = browser.new_page()
    yield page
    page.close()
