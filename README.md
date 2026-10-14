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
| `fun.html` | The Personal Hub, under construction and supervised by three cats |
| `404.html` | Abort, Retry, Portal? |

## Adding or changing a project

Every project card lives in [`projects.json`](projects.json). The tabs and cards in `professional.html` and the selected projects in `cv.html` are generated from it.

1. Edit `projects.json`. Images go in `assets/projects/<slug>/`.
2. Run `python3 tools/build_site.py` to rewrite the generated blocks.
3. Run `python3 -m pytest -q tests` and commit.

A project can be `live`, `wip` (in progress) or `pending` (repository not public yet). Pending projects show on the Professional Log without links and stay off the recruiter view. `featured_order` decides which projects the recruiter view lists and in what order. A card can be opened directly with `professional.html#project-<slug>`.

## How it is published

`.github/workflows/site.yml` runs on every push:

1. **Checks.** `build_site.py --check` validates `projects.json` (unique slugs, known tracks, images that exist, no card linking to another project's repository) and fails if a page is out of sync with it. The tests then confirm that every local link, image, cursor and script path resolves, that tags are balanced, that images declare alt text, that links opening a new tab use `noopener`, that no placeholder text is left and that the CV files are real PDFs.
2. **Publish.** Only on `main`, and only if the checks pass, the site files are uploaded to GitHub Pages. Tools, tests and this README are not published.

## Structure

```
├── index.html, professional.html, cv.html, fun.html, 404.html
├── projects.json            Single source of truth for the project cards
├── assets/
│   ├── ui/                  Cursors, icons, GIFs, background and social card
│   ├── projects/<slug>/     Figures for each project
│   └── cv/                  CV in English and Spanish (PDF)
├── tools/build_site.py      Validates projects.json and writes the generated blocks
└── tests/test_site.py       The checks that gate publishing
```

## Credits

Background image from the Hubble Space Telescope (NASA, ESA). Fonts: VT323 and Press Start 2P from Google Fonts. Pixel-art cursors and icons drawn for this site.
