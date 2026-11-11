# 261111-bracket-tabs-lines — Bracket: round tabs that really filter, lines that stay attached

## Brief (lead)
- **Owner's request (verbatim):** "Sơ đồ thi đấu có vấn đề, 4 filter bán kết, chung kết nhánh và chung kết có vấn đề khi thực chất hiển thị như nhau. Phần nhánh trong ảnh các đường line có vấn đề khi mở rộng bảng xem thành viên và line của T3 đến Chung kết nhánh thắng cũng bị trùng lặp"
- **Goal:** each round tab shows a different view; lines stay on their cards while a roster opens; two lines into one match end on different rows.
- **Risk class:** B (owner described the fix) · **Owner review needed before release:** screenshots sent in chat
- **Claim — may change:** `web/site.js`, `web/site.css`, `web/body.html`, `config/site.json` (version), `BASEMENT.md`, `HANDOFF.md`, `tasks/`
- **Must not change:** data, referee page, other sections.
- **Acceptance checks:**
  - [x] `python scripts/preflight.py` → `[OK]`
  - [x] screens 360×640 · 390×844 · 768×1024 · 1366×800, no sideways scroll, no console errors
  - [x] line ends stay on the team row while T1's roster opens (measured every 150 ms: ≤ 0.5 px off)

## Report (worker)
- **Agent / branch:** Claude (lead, solo) · `task/261111-bracket-tabs-lines`
- **Changed files:**
  - `web/site.js` — bracket flow rewritten: a line ends on the row of the side it feeds (`a`/`b` from the label "Thắng Tn"), starts on the winner's row once played; a line that skips a column runs along a free lane past the cards in between and turns in the last gutter (T3 → T6 no longer crosses under T4); redraw via ResizeObserver on every card + transitionend (old code redrew once at 320 ms while the roster animation lasts 450 ms). Round tabs: real filter (Tất cả · Vòng 1 · Bán kết · CK nhánh = CK nhánh thắng + CK nhánh thua · Chung kết), fade the rest and their lines, scroll to the first picked match only when the bracket can scroll; removed the scroll-to-tab sync. Helper renamed `bkCurve` (a `var seg` already exists for the day picker).
  - `web/body.html` — tabs use `data-focus`, new "Tất cả" (default).
  - `web/site.css` — focus/dim styles, end dot of a played line.
- **How it was checked:** preflight `[OK]`; Playwright screenshots before/after at the 4 sizes; endpoint measurement during the roster animation.
- **Not done / known issues:** none.

## Lead review
- **Result:** accepted in v1.25.3 · 2026-11-11 · patch applied by the lead on top of v1.25.2 (3-way, no conflict), preflight --release [OK], pushed.
