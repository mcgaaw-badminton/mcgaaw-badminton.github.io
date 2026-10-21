# BASEMENT — Giai cau long MCGAAW (single rule set)

Standalone workspace for the MCGAAW team badminton tournament (6 teams × 5 players, double elimination, 10 matches).
It is isolated on purpose: nothing here reads from or writes to `Agent research/` or any other workspace, and no other workspace reads from here.

## 1. Scope
- Tournament paperwork, graphics and website: bracket poster, schedule poster, match sheets, results, the tournament website.
- The `Visualize/P04-cau-long` kit in Agent research is a different brand (game kit). Do not reuse or change it for this tournament.

## 2. Folder layout
```
Giai cau long MCGAAW/
├── .workspace-root        marker — scripts find the root from here
├── BASEMENT.md · CLAUDE.md
├── config/                single sources of data (edit here, then rebuild)
│   ├── teams.json         rosters, seed order 1..5 + the 5 pairs
│   ├── schedule.json      10 matches, dates, rules, busy-team note, optional results
│   └── site.json          website title, match time, venue, hero slide texts, bracket layout
├── assets/                logo_mcgaaw.png · fonts/ (Be Vietnam Pro, OFL) · sheet.css
├── design/                source copies of the 2 posters (live canvas link in design/README.md)
├── web/                   website source: body.html · site.css · site.js (no data inside)
├── slides/  gallery/  downloads/   INPUT photos/files for the website (see README in each)
├── .github/workflows/deploy.yml   build + publish on every push to main
├── scripts/               build_sheets.py · build_site.py · render_pdf.mjs · _lib/paths.py · package.json
└── output/                generated only: PDFs · site/ (whole website, rebuilt from scratch each run) · site_preview.html · _build/
```

## 3. Tournament rules (source of truth for every output)
1. Match = 5 doubles pairs by seed: 1–2, 1–3, 2–4, 3–5, 4–5. Each player plays exactly 2 pairs.
2. Match winner: higher total points over 5 pairs; tie on total → more pairs won.
3. Double elimination, 10 matches, T10 is the deciding final (no reset match T11).
4. Play only on Wednesdays, 04/11 → 16/12/2026 (7 days; 23/12 and 30/12 avoided), max 2 matches per day, no team plays twice on one day.
5. If one team is busy on the Wednesday, both teams arrange another day so the result is in before the next Wednesday.

## 4. Visual style (all outputs)
- A4 landscape (1123 × 794 px at 96 dpi), font Be Vietnam Pro only (400/700/800, 800 italic for titles), title line-height ≥ 1.25 so Vietnamese marks never touch.
- Colors: blue #1D2BD9 (winners bracket, brand) · orange #B5440F / #D9561C (losers bracket) · navy #0E1430 (final, text) · ground #F6F7FC · gold #F2C14E (champion only).
- Header: shuttle icon + eyebrow + italic uppercase title; MCGAAW logo top right; blue footer band "SMASH · DROP · CLEAR / MCGAAW BADMINTON".

## 5. Script contract
- Paths come from `scripts/_lib/paths.py` only.
- Data and changeable values live in `config/`, never in source.
- Scripts never write into `scripts/`, `config/` or `assets/`; output goes to `output/`.
- Every script has `--dry-run` and prints `[OUTPUT] <path>` as its last line.
- Rebuilding overwrites the PDF of the same name in place (no .bak; user keeps own backups).

## 6. Website
- Sections: hero slider · next match + countdown · schedule (filters, 5 pairs per match) · bracket · teams · rules · gallery (albums + lightbox) · documents.
- Results go in `config/schedule.json` as `"result": {"a": 105, "b": 98, "pa": 3, "pb": 2}` (points, pairs won); the build fills later matches, winners and team records.
- Flying shuttle: `assets/shuttle.svg` + `assets/racket.svg` (approved 2026-10-21, source in `design/scroll-shuttle/`), injected as SVG symbols by the build. It follows scroll through 8 anchors (racket → serve → overview → schedule → bracket ×2 → teams → smash to gallery → lands on footer), desktop only (≥ 901 px); phones and reduced-motion show it resting on the racket.
- Player tags: seed tag 1–5 on every player (main seed only) with an animated emoji per seed from `config/site.json` `seed_fx` (1 fire · 2 zap · 3 sparkles · 4 star · 5 rocket); names containing the word "Thị" get a "Nữ" label with an animated heart (hearts also mark them in the pair tables). Animations: Noto Animated Emoji Lottie files in `assets/lottie/` (CC BY 4.0, credited in footer) played by lottie-web 5.12.2 (MIT, `assets/vendor/`); one player per emoji, copied into every tag, running only while the Teams section is on screen.
- Deploy: git repo, branch `main` → GitHub Actions (`.github/workflows/deploy.yml`) runs `build_site.py` and publishes `output/site` to GitHub Pages. `output/` is not committed. Every build writes `version.json` (id = build time + commit, version from `config/site.json`, dataHash of matches+teams); asset URLs carry `?v=<id>` so F5 always loads the new release; open pages poll `version.json` every 60 s and show an update toast. Live clock in the nav uses Asia/Ho_Chi_Minh.
- Never hand-edit `output/site/`; edit `web/` or `config/` and rebuild.
- Online preview (no photos): https://claude.ai/artifact/XCK7rwyFQHxcTtwRiaVmEr, republished from `output/site_preview.html`.

## 7. Commands (run from the workspace root)
- Once: `cd scripts && npm install` (needs Node 18+ and Chrome or Edge installed).
- Match sheets: `python scripts/build_sheets.py --days 1 2` · `--matches T5 T6` · add `--dry-run` to preview.
- Website: `python scripts/build_site.py` (add `--preview` for the single-file preview, `--dry-run` to check). Optional `pip install pillow` for resized photos and thumbnails.
- After a result: add `"result"` to that match in `config/schedule.json`, then rebuild the site and the next day's sheets.
