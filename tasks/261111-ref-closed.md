# 261111-ref-closed — closed matches on every referee phone

## Brief (lead)
- **Owner's request:** "tôi đã chốt rồi nhưng vẫn còn hiện ở trang trọng tài" (screenshot: T1 "Chờ chốt", T2 "3/5 cặp" under "Ngày trước").
- **Goal:** a match closed on the server shows as closed on every phone; closed past matches leave the "Ngày trước" list.
- **Risk class:** B, owner described the result · match day (T3, T4 today) → ship now.
- **Claim:** web/ref.js, web/ref.css (+ BASEMENT line, HANDOFF, BOARD by the lead).

## Report (worker)
- **Agent / branch:** Claude (lead, solo path) · `task/261111-ref-closed`
- **Changed:** ref.js reads `?ref=all` finals (cache `gcl-ref-finals`), groups past closed matches under a collapsed "Đã chốt (n)" toggle, labels "Đã chốt a–b", green note inside a closed match; ref.css toggle styles.
- **Checked:** mocked API test at 390×844 (list, toggle, T2 note, no page errors); `python scripts/preflight.py` (6 referee tests).

## Lead review
- **Result:** accepted in v1.25.1 · 2026-11-11
