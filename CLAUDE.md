# CLAUDE.md — Giai cau long MCGAAW
Read in this order: `BASEMENT.md` (product rules) → `PROCESS.md` (how work flows: roles, tasks, checks, release) → `HANDOFF.md` (current state) → your task file in `tasks/` if you were given one. Know your role (PROCESS §1): a worker stays inside its task claim and never pushes to `main`; the lead releases and keeps HANDOFF/BOARD true. Replies to the user in Vietnamese, rule files in English.

- Standalone workspace: do not read or edit `Agent research/` (incl. `Visualize/P04-cau-long`) or other workspaces for this project.
- Data changes (names, seeds, dates, results) → edit `config/*.json`, then rebuild; never hand-edit generated PDFs.
- Posters are designed on the live canvas (link in `design/README.md`); `design/*.dc.html` are source copies — after a canvas change, refresh the copy.
- Any visual change keeps the style in BASEMENT §4 (same font and sizes).
- Website: source in `web/`, data in `config/`, photos in `slides/` + `gallery/<album>/`; `output/site/` is generated.
- Deliver only changed files; generated files go to `output/`. Sync the PC folder through git only (PROCESS §2).
- Before a report or release: `python scripts/preflight.py` must end with `[OK]`.
