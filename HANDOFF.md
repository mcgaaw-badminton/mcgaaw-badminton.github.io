# HANDOFF — session backup (read after BASEMENT.md; update at the end of every session)

Keep this file short: current state, live endpoints, how to verify, open items. Rules live in `BASEMENT.md`; history lives in git.

## Current state (2026-11-06, v1.23.1)
- Live site: https://mcgaaw-badminton.github.io · referee page: `/trong-tai.html` · repo `mcgaaw-badminton/mcgaaw-badminton.github.io` (push to `main` deploys).
- Apps Script web app (same URL for every version): `https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec` — deployed version 4 = `scripts/apps_script/eggs.gs` (history log + Chốt).
- Sheet "MCGAAW Cup — Trứng thối" id `1ZCP48Eg-2kJ7nFiIXaM3zs3qEJOx4fX7cwtOf35e1mI`, tabs: eggs, referee, referee_log, referee_final, referee_draft.
- Schedule: T1, T2 on 04/11/2026; T3 (+T4) on 11/11/2026.
- Results (both closed): T1 Chốt #T1-FUJF8B (re-closed 2026-11-05 08:07; same scores, Đội 2 155–88, 5–0). T2 Chốt #T2-FC2S83 posted 2026-11-06 at the user's request: pairs 1 and 3 absent and NOT played ([0, 0]), Đội 4 wins 91–73, pairs 2–1. Next: 11/11 T3 Đội 5–Đội 6 and T4 (semi) Đội 2–Đội 4; 18/11 T5 Đội 1–Đội 3. Day + GOAT reports re-published with T2 closed.
- GitHub's scheduled builds are unreliable: on 04/11 only one run fired (00:50) out of the planned every-15-min evening runs. After a Chốt, a manual run (`gh workflow run` or any push) updates the site at once.
- 2026-11-04 10:55: the user's T1 test was reset on the live sheet (pairs 1 and 4 re-sent blank with a newer `updated`, so phones pull the reset; rows stay in `referee`, history in `referee_log`). No finals exist.

- Reports: the user's "xuất report" = both the day report and the GOAT report (`build_report.py goat`). GOAT 04/11 published (`downloads/Bao_cao_GOAT_04-11-2026.pdf`, `config/reports.json` goat) and shown in the site's Kết quả › GOAT tab.
- After each match day: `build_report.py --publish` + `build_report.py goat --publish`, copy both summaries into `config/reports.json`, rebuild, push.
- Report published: `downloads/Bao_cao_04-11-2026.pdf` + `config/reports.json` → first hero slide on the site. Update the entry when T2 is closed (rerun build_report --publish).
- Report: `output/Bao_cao_04-11-2026.pdf` (3 pages: day overview, T1, T2) from `scripts/build_report.py`; raw rally data cached in `output/report/2026-11-04/`.

## How to change things safely
- Data (names, seeds, dates, results) → `config/*.json`, then `python scripts/build_site.py`.
- Referee page → `web/ref.*`; then run `scripts/tests/referee_*.py` (mocked API, no real data touched). All must end with `errors []`.
- Apps Script → edit `scripts/apps_script/eggs.gs`, paste into the editor (Monaco `setValue`), Ctrl+S, Deploy → Manage deployments → edit → New version → Deploy. Verify with curl: `?ref=all` returns `{"matches":…,"finals":…}`; POST test rows only under match `T10`, then delete them in all three referee tabs.
- Never write test data under T1–T9.

## Verify checklist (after any referee change)
1. `python scripts/build_site.py` prints `[OUTPUT]` and `[REFEREE]` lines.
2. Six tests in `scripts/tests/` → `errors []`; positions/scoring/end/pairs screens fit 360×780 and 375×667.
3. After deploy: `curl -s <site>/version.json` shows the new version.

## Open items (ask the user, do not decide alone)
- PROTECTION (user asked for all 5 layers, 2026-11-05): site v1.21.0 is live; `scripts/apps_script/eggs.gs` (cache, rate limit, Turnstile, PIN) is committed but NOT yet deployed (Chrome was offline) → deploy it (version 5) and verify; it adds UrlFetchApp, so the owner must run `authorize()` once and click Allow. User steps still to do: Turnstile widget (send the site key; put the secret in Script properties), REF_PIN in Script properties, domain + Cloudflare (purchase is the user's).
- Trust (deferred by the user on 2026-11-04, "tạm thời không cần"): the Apps Script endpoint is public; anyone could POST a fake "Chốt". Proposal kept: server checks the Chốt against the `referee` rows and/or a referee PIN.
- Other phones only learn "Đã chốt" from their own press (status is per phone); could pull `finals` from `?ref=all`.
- FLOWERS shipped in v1.22.0 (rules in BASEMENT §6 "Flowers"). Egg totals snapshotted into `config/site.json` eggs.flower_base at 11:00 on 2026-11-05 (bouquets count from there). Robot ideas list (live scores, profile, compare, BXH, reports, schedule, theme, offline, Turnstile, referee page) offered; the user has not picked any yet. `scripts/flower_draft/` holds the review drafts only.
- Intro animation (dev only): storyboard v2 https://claude.ai/artifact/MsioXD6SSReWoKH1qY1VZ2 awaits approval.
- Older questions still open: referee PIN; tap targets/font scale on the main page.
