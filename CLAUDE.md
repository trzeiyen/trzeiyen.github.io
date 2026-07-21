# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`trzeiyen.github.io` — a GitHub Pages static site: "Zeiyen 老師的教學工具箱", a Taiwanese elementary-school
teacher's collection of self-contained interactive teaching tools (history RPGs, card games, sorting games,
flashcards, etc.), all in Traditional Chinese (`zh-Hant`).

There is no build system, no package manager, and no test suite. Every page is a single, fully self-contained
`.html` file with inline `<style>` and `<script>` — open it directly in a browser or via the deployed Pages URL.
Any third-party JS (e.g. `astronomy-engine`, `qrcode.min.js`) is pulled from a CDN via `<script src="https://...">`,
never bundled.

## Commands

None. There is nothing to install, build, lint, or test. To preview a page locally, just open the `.html` file
in a browser, or serve the repo root with any static file server (e.g. `python3 -m http.server`).

Deploys are just a `git push` to the branch GitHub Pages serves from — editing/adding an `.html` file *is* the
deployment.

## Structure

- `index.html` — the landing page / catalog. Lists every tool as a `<article class="card">` inside a filterable
  grid (`#tools`), plus `#resources`, `#counseling`, and `#about` sections. Filtering is done client-side by a
  ~15-line vanilla JS block at the bottom of the file that toggles `.hidden` based on each card's `data-cat`
  attribute matching the clicked `.filter-btn`'s `data-filter`.
- `tools/*.html` — the actual teaching tools/games, one file each. This is where most content work happens.
- `qrcode-generator-v2.html`, `redirect.html` — standalone utility pages at the repo root (not part of the
  `tools/` catalog).
- `README.md` — just the repo title, no content.

## Adding a new tool

1. Add the new self-contained page under `tools/` (or the repo root, following existing precedent for
   root-level utility pages).
2. Add a matching `<article class="card" data-cat="...">` entry to the `.grid` in `index.html`, using one of the
   existing `data-filter` categories (`early`, `qing`, `japan`, `roc`, `community`, `finance`, `life`) — or add a
   new filter button if it doesn't fit. Follow the existing card markup: `.card-cat`, `h3`, `p` description,
   `.card-meta` with a `.grade` badge and a `.card-link` pointing at the new file (`target="_blank" rel="noopener"`).
3. Keep the new page dependency-free apart from CDN `<script>`/`<link>` tags — no local build artifacts, no
   `node_modules`.

## Conventions across pages

- Traditional Chinese UI text throughout; keep new pages in `zh-Hant`.
- Recurring font pairing: a serif/kai display face (`LXGW WenKai TC` or `Noto Serif TC`/`Songti TC`) for
  headings, `Noto Sans TC` for body text, loaded via Google Fonts `<link>` tags.
- Each page defines its own CSS custom-property color palette in `:root` rather than sharing a stylesheet —
  there is no shared CSS file across pages, so palettes differ per tool by design.
- `@media (prefers-reduced-motion: reduce)` is used in some pages to disable animation; follow this pattern for
  any new animated tool.
