# BOARD — who is doing what (PROCESS.md §3)

One row per task. Status: `todo` → `doing` → `review` → `done` (or `dropped`). Keep finished rows for the last 2 weeks, then delete them (git keeps history).
A file in the conflict zone (PROCESS.md §7) may be claimed by only one `doing`/`review` row.

| id | title | class | claim (files) | owner of work | status | version / note |
|---|---|---|---|---|---|---|
| 261107-process | Process rules for lead + agents: PROCESS.md, tasks/, preflight, verify_live | C | PROCESS.md, tasks/, scripts/preflight.py, scripts/verify_live.py, CLAUDE.md, AGENTS.md, HANDOFF.md, BASEMENT.md (header + layout only) | Claude (lead) | done | docs: no version bump |
| 261111-ref-closed | Referee page: every phone sees closed matches (server Chốt list), past closed matches hidden behind "Đã chốt" | B (owner asked) | web/ref.js, web/ref.css | Claude (lead, solo) | done | v1.25.1 |
| 261111-album-doi-1-2 | Gallery album with 4 team photos (Đội 1, Đội 2) | C | gallery/01-doi-1-va-doi-2/ | Claude (lead, solo) | done | v1.25.2 |
| 261111-bracket-tabs-lines | Bracket: round tabs filter for real (+ Tất cả), lines end on the fed team row, skip-column line routed around cards, redraw while rosters open | B (owner asked) | web/site.js, web/site.css, web/body.html | Claude (lead, solo) | done | v1.25.3 |
| 261111-close-t3-avg-rank | Close T3 (pair 5 absent) + T4; rank by per-pair averages | A (owner asked) | config/schedule.json, scripts/_lib/tournament.py, web/site.js, web/site.css, web/ref.js | Claude (lead, solo) | done | v1.26.0 |
| 261111-reports-1111 | Day report 11/11 + GOAT (per-pair titles); reports read typed results and bracket labels | C (owner asked) | scripts/build_report.py, config/reports.json, downloads/ | Claude (lead, solo) | done | v1.26.1 |
| 261111-sub-rename-metrics | Rename 5-4 → Nguyễn Xuân Phi; T3 pair 3 stand-in Chi; BXH metrics review (drop Tỉ lệ thắng, Điểm ghi; add Thủng lưới, Hiệu suất) | B (owner asked) | config/teams.json, config/schedule.json, scripts/_lib/tournament.py, scripts/build_report.py, web/site.js, web/site.css, config/reports.json, downloads/ | Claude (lead, solo) | done | v1.27.0 |
| 261111-profile-ui-goat-streak | Profile pop-up: gauge no longer overlaps, 9 tiles in full rows; GOAT "Chuỗi thắng cặp" replaces "Tỉ lệ thắng cặp" | B (owner asked) | web/site.js, web/site.css, scripts/build_report.py, config/reports.json, downloads/ | Claude (lead, solo) | done | v1.27.1 |
| 261111-goat-min1 | GOAT titles need only 1 pair (owner: rates/averages already divide by pairs) | C (owner asked) | scripts/build_report.py, config/reports.json, downloads/ | Claude (lead, solo) | done | v1.27.2 |
| 261111-bracket-v2 | Bracket map with pipelines + pop-up + team chips; result colours (win green / lose red, draw default); unified pair row on site and referee page (owner approved review 2026-11-12) | B | web/site.js, web/site.css, web/body.html, web/ref.js, web/ref.css, web/ref.html, BASEMENT.md | Claude (lead, solo) | done | v1.28.0 |
| 261112-bracket-chips | Bracket team chips did not light a team's pipes (string vs number team id) | C (owner reported) | web/site.js | Claude (lead, solo) | done | v1.28.1 |
| 261112-bracket-bye | Đội 5–6 bye: T3 beside T4 as Bán kết; T7 = Thua T4 – Thua T3, T8 = Thắng T7 – Thắng T5; losers of T5/T7 share 5th | A (owner asked) | config/schedule.json, config/site.json, web/site.js, BASEMENT.md | Claude (lead, solo) | done | v1.29.0 |
