# lobby9000.github.io

[![site](https://github.com/lobby9000/lobby9000.github.io/actions/workflows/site.yml/badge.svg)](https://github.com/lobby9000/lobby9000.github.io/actions/workflows/site.yml)

Personal site of Luis Ángel Quiroz López: a CRT portal, a Windows XP style Professional Log with every project, a plain recruiter view and a Personal Hub still under construction. Built by hand in HTML, CSS and plain JavaScript, first on Neocities and now on GitHub Pages.

**[lobby9000.github.io](https://lobby9000.github.io)** · [Recruiter view](https://lobby9000.github.io/cv.html) · [Professional Log](https://lobby9000.github.io/professional.html)

## Pages

| Page | What it is |
|---|---|
| `index.html` | The portal: boot sequence, three destinations and a shortcut to the recruiter view |
| `professional.html` | The Professional Log: about, thesis, projects by track, written work and languages, with draggable windows and synthesised sounds |
| `cv.html` | Recruiter view: the CV on one plain page, printable, with PDF downloads in English and Spanish |
| `qa-case-study.html` | The QA case study: a sales-commission API tested from requirements to release, plus the MACD signal API |
| `fun.html` | The Personal Hub, under construction and supervised by three cats |
| `404.html` | Abort, Retry, Portal? |

## Adding or changing a project

Every project card lives in [`projects.json`](projects.json). The tabs and cards in `professional.html` and the selected projects in `cv.html` are generated from it.

1. Edit `projects.json`. Images go in `assets/projects/<slug>/`.
2. Run `python3 tools/build_site.py` to rewrite the generated blocks.
3. Run `python3 -m pytest -q tests` and commit. Without Playwright installed the browser checks are skipped; the next section shows how to run them.

A project can be `live`, `wip` (in progress) or `pending` (repository not public yet). Pending projects show on the Professional Log without links and stay off the recruiter view. `featured_order` decides which projects the recruiter view lists and in what order. A card can be opened directly with `professional.html#project-<slug>`.

## How it is published

`.github/workflows/site.yml` runs on every push:

1. **Checks.** `build_site.py --check` validates `projects.json` (unique slugs, known tracks, images that exist, no card linking to another project's repository) and fails if a page is out of sync with it. The tests then confirm that every local link, image, cursor and script path resolves, that tags are balanced, that images declare alt text, that links opening a new tab use `noopener`, that no placeholder text is left and that the CV files are real PDFs.
2. **Browser and link checks.** Chromium, driven by Playwright, loads every page from a local server and fails on script errors, local files that do not load or images that do not decode. It also checks that `cv.html` and the case study fit a 390 px phone without sideways scrolling, that each project tab shows exactly its own cards, that every `professional.html#project-<slug>` link lands on its card, that each gallery window holds every image of its card and that the case study and the Professional Log link to each other. A last step confirms that every link and badge pointing at a GitHub repository answers 200.
3. **Publish.** Only on `main`, and only if both jobs pass, the site files are uploaded to GitHub Pages. Tools, tests and this README are not published.

To run everything locally:

```bash
python3 -m pip install -r requirements-dev.txt
python3 -m playwright install chromium
python3 -m pytest -q tests              # static, browser and link checks
python3 -m pytest -q tests -m "not network"   # offline
```

## Structure

```
├── index.html, professional.html, cv.html, qa-case-study.html, fun.html, 404.html
├── projects.json            Single source of truth for the project cards
├── assets/
│   ├── ui/                  Cursors, icons, GIFs, background and social card
│   ├── projects/<slug>/     Figures for each project
│   ├── qa/                  Newman HTML reports linked from the case study
│   └── cv/                  CV in English and Spanish (PDF)
├── tools/build_site.py      Validates projects.json and writes the generated blocks
└── tests/
    ├── test_site.py         Static checks on the HTML and projects.json
    ├── test_browser.py      The same pages loaded in Chromium
    └── test_links_online.py Links to GitHub, checked over the network
```

## Credits

Background image from the Hubble Space Telescope (NASA, ESA). Fonts: VT323 and Press Start 2P from Google Fonts. Pixel-art cursors and icons drawn for this site.
