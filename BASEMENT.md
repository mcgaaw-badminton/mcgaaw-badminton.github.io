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
1. Match = 5 doubles pairs by seed, played in this order: 1–2, 3–5, 2–4, 1–3, 4–5 (order changed 2026-11-03; results' "pairs" scores follow it). Each player plays exactly 2 pairs.
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
- Results go in `config/schedule.json`: preferred `"result": {"pairs": [[21, 15], ...]}` (score of each pair in pair order, left team first; totals derived, typed totals must agree), or totals only `{"a", "b", "pa", "pb"}` (no player stats for that match). The build fills later matches, winners and team records.
- Standings (BXH, v1.2.0): computed in `scripts/_lib/tournament.py` `stats()` — team table (placements from `config/site.json` `placements`, else wins, losses, pair diff, point diff), match list + highlights, player table (heat °, pairs won, points, diff, win rate) with filters. Heat 20–45°: prior from main seed + `sub_seeds` in `config/teams.json` (sub seed = rank 1–6 among players sharing a main seed; not shown on the site), weighted as 2 pairs, then each real pair: 60 % pair win rate + 40 % point diff per pair.
- Flying shuttle: `assets/shuttle.svg` + `assets/racket.svg` (approved 2026-10-21, source in `design/scroll-shuttle/`), injected as SVG symbols by the build. Since v1.12.0 it leaves the hero racket into the empty right margin and stays there (the robot owns the left), weaving across the margin section by section (hero → overview → schedule → bracket ×2 → standings → teams → smash beside the gallery → lands beside the footer), scaled to fit the margin; desktop only (≥ 901 px) and only when the margin is at least 64 px wide (about 1300 px windows and up), otherwise it rests on the racket; phones and reduced-motion show it resting on the racket.
- Player tags: static seed tag 1–5 on every player (main seed only; navy square, seed 1 with a gold ring); names containing the word "Thị" get a static "♥ Nữ" label (hearts also mark them in the pair tables). Animated emoji removed in v1.1.0.
- Palette C "Navy & Pearl" (v1.1.0): navy frames (nav, hero, footer) with a champagne-gold hairline, pearl reading area, logo blue for actions; light + dark mode, following the system until the viewer picks one with the nav button (saved in localStorage `gcl-theme`). Kept effects: drifting ambient, cursor spotlight on cards, scroll glide-in, flying shuttle, slider fade.
- Live site: https://mcgaaw-badminton.github.io — repo `mcgaaw-badminton/mcgaaw-badminton.github.io` (GitHub organization, free; moved from the personal account on 2026-10-21 so the address shows no personal ID).
- Deploy: git repo, branch `main` → GitHub Actions (`.github/workflows/deploy.yml`) runs `build_site.py` and publishes `output/site` to GitHub Pages. `output/` is not committed. Every build writes `version.json` (id = build time + commit, version from `config/site.json`, dataHash of matches+teams); asset URLs carry `?v=<id>` so F5 always loads the new release; open pages poll `version.json` every 60 s and show an update toast. Live clock in the nav uses Asia/Ho_Chi_Minh.
- Collapsed by default (v1.4.0), one pattern everywhere: tap the team names or the round ▾ arrow chip to open. Schedule card → the 5 pairs with member names; team card → roster ("Mở tất cả" opens all); bracket → each lane (Nhánh thắng / Nhánh thua) is an accordion (phones: winners open, losers closed, single column; desktop: both open), and each bracket card opens both teams' rosters.
- Player chips (v1.6.0): every player name is its own glass chip (pairs, team rosters, bracket rosters). Only the schedule chips are tappable: picking a name highlights that player's chips, pair rows and match card inside the schedule (no highlight in other sections) and shows a bottom bar with name, team, seed, match codes and the player's heat from the standings (°, trend, rank, won/lost pairs; links to BXH) — so it updates with every result. The pick is remembered per viewer in localStorage `gcl-player`.
- Heat tip (v1.7.0): outside the schedule (team rosters, bracket rosters) a name chip shows a small glass tip with the player's heat, trend, rank and won/lost pairs on mouse hover, keyboard focus or tap.
- Last season's champions: `past_champions` in `config/teams.json` (names must match a roster). They get a gold "Champion" cup label in team rosters, standings, the picked-player bar and the legend, and a small cup icon inside name chips. Gold stays reserved for champions (BASEMENT §4).
- Notes and captions (schedule hint, info boxes, legends, gallery and lightbox captions) are set in italic.
- Gallery album titles with Vietnamese marks: `"_title"` in the album's `captions.json` (album `00-tri-an-vo-dich-mua-truoc` = last season's champions, shown first).
- Mascot (v1.11.1): a TV-headed robot (112 px on desktop, 64 px on phones) from robot-heads (Fayaz Ahmed, MIT; renderer bundled without React from `scripts/robot-heads-vanilla.ts` into `assets/vendor/robot-heads.min.js`), navy shell with champagne trim. Bottom-left on desktop, bottom-right above the tab bar on phones. Its face follows the page: speaking while a reminder bubble shows, happy on match day and on every egg throw, error if the egg board is offline, sleeping when tucked away; it follows the pointer and hops on a tap. Bubble reminders: days to the next match, match-day alert, latest result, egg board, how to pick a player. "Ẩn mascot" tucks it to the edge (localStorage `gcl-mascot`).
- Rotten eggs (v1.9.0; BXH opens on VĐV › Trứng thối since v1.11.1): each player row in BXH › VĐV and the picked-player bar has an egg button. Effects use open-source libraries vendored in `assets/vendor/` (GSAP: Noto egg flies in an arc from the mascot and squashes, fried-egg splat; canvas-confetti: shell, yolk and rising embers; lottie-web: animated Noto fire that grows at 1 / 10 / 50 / 200 eggs) — licenses in `assets/vendor/README.md`, credit in the footer. Metric chip "Trứng thối" ranks players by eggs with heat beside it. Counts live in the Google Sheet "MCGAAW Cup — Trứng thối" behind an Apps Script web app (`scripts/apps_script/eggs.gs`; GET totals, POST batched increments under a lock); its URL goes in `config/site.json` `eggs.api_url`. Empty = counts only on the viewer's device. Pages refresh every 4 s while BXH or the picked-player bar is on screen, every 20 s otherwise; throws are sent 0.35 s after the last tap and the last known board is cached in localStorage `gcl-eggs-last` so it shows instantly. Live setup (2026-10-23): Sheet `MCGAAW Cup — Trứng thối` (tab `eggs`, column A ids kept as text), Apps Script project deployed as a web app (execute as owner, access: anyone); after editing `eggs.gs` paste it into the project and use Deploy › Manage deployments › edit › New version so the URL stays the same. To fix a count, edit column D in the sheet.
- Borders: interactive cards and chips are borderless at rest; a border appears only on mouse hover (`hover: hover` + `pointer: fine`), never on touch. All round arrow/close icon chips are 32 px.
- Referee page `trong-tai.html` (source `web/ref.html|css|js`; noindex, not linked from the main page). Phone first; every screen fits one phone screen (360×780 and up) and has Back; the phone's back works. Routes: `#T1` (pairs) · `#T1/<n>/vitri|diem|cacdiem|ket` · `#T1/tong`.
  - Modes: **Chính thức** (saves go to the sheet) and **Demo** (nothing sent; a finished pair goes to `referee_draft` with a report code). Match list follows `config/schedule.json`: today and earlier days open, later days locked in official mode ("Mở ngày dd/mm").
  - Pairs screen: any order; "Vắng" marks an unplayed pair for a later day (cannot be opened until "Có mặt"). A match with an absent pair cannot be closed.
  - Positions screen: one question only, the first server. Team 1 starts on the LEFT (as the referee sees it); the two team chips under the court change sides when one is slid across (or tapped). Far/near defaults to the first-listed player; drag a player to a box or tap to swap with the partner. Positions alone are never sent.
  - Court: four separate boxes (left blue, right orange, light→dark gradient, no lines); each player is centred in their own box. Scoring screen = scoreboard + bigger court; a point is scored only by tapping the scorer's box (scorer = attack, partner = support). Clock runs only on scoring screens.
  - Rules: rally scoring to 31 (no setting), BWF doubles service courts, ends change once when a side first reaches 16 (players keep their own service court; one "Đổi sân" sheet with undo). Manual "Kết thúc" only when one side leads; it can be undone.
  - Edit: "Các điểm" changes a rally's scorer (team + player in one tap) or deletes it; later scores recompute. "Đặt lại" (positions or scoring screen) clears a pair to not played and returns to positions.
  - Leaving a pair changed during the visit asks "Thoát, không lưu" (back to how it was on entry) / "Lưu và thoát" / "Ở lại"; finished pairs never ask.
  - Saving: phone first (localStorage `gcl-ref-<match>` / `gcl-refdemo-<match>`), then the sheet; every save echoes score + rally count; finishing a pair reads it back ("✓ … khớp"). Each save carries `state.stats` (per player attack/support, per side won-on-serve, breaks, longest run).
  - **Chốt**: when all 5 pairs are finished, "Chốt T1" sends the match result (5 pair scores + per player [attack, support]) to `referee_final`, read back before "✓ Đã chốt". Editing afterwards shows "Đã sửa sau khi chốt" and the old Chốt stays in use until "Chốt lại".
- Sheet tabs (Apps Script `scripts/apps_script/eggs.gs`, deployed as a web app; redeploy = Manage deployments → edit → New version, same URL): `referee` latest state per match+pair (newer `updated` wins) · `referee_log` every official save appended · `referee_final` every Chốt appended · `referee_draft` demo pairs · `eggs`.
- BXH › VĐV: metric chips, then a "Hạt giống" chip row (Tất cả · 1–5 · Chia nhóm = one ranking per seed, all players shown), team select, women-only toggle.
- Standings from referees: the build reads `?ref=all` and, for a match without a result in `config/schedule.json`, uses that match's **last Chốt** (pair scores + `result.players`, which feed "Tấn công"/"Hỗ trợ" in BXH › VĐV). Results typed in config always win. GitHub Actions builds every 15 min from 17:00 to 23:59 (Vietnam). Main page cards poll `?ref=all` every 30 s: "Đang đấu" → "Chờ chốt" → "Đã chốt".
- Never hand-edit `output/site/`; edit `web/` or `config/` and rebuild.
- Online preview (no photos): https://claude.ai/artifact/XCK7rwyFQHxcTtwRiaVmEr, republished from `output/site_preview.html`.

## 7. Commands (run from the workspace root)
- Once: `cd scripts && npm install` (needs Node 18+ and Chrome or Edge installed).
- Match sheets: `python scripts/build_sheets.py --days 1 2` · `--matches T5 T6` · add `--dry-run` to preview.
- Website: `python scripts/build_site.py` (add `--preview` for the single-file preview, `--dry-run` to check). Optional `pip install pillow` for resized photos and thumbnails.
- After a result: add `"result"` to that match in `config/schedule.json`, then rebuild the site and the next day's sheets.
