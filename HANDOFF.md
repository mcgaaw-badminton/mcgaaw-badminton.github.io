# HANDOFF — current state (read after BASEMENT.md and PROCESS.md; the lead updates it in every release commit)

Keep this file short: current state, live endpoints, how to verify, open items. Rules live in `BASEMENT.md`; history lives in git.

## Current state (2026-11-11, v1.25.2)
- Live site: https://mcgaaw-badminton.github.io · referee page `/trong-tai.html` · repo `mcgaaw-badminton/mcgaaw-badminton.github.io` (push to `main` deploys). Last releases: v1.23.0 T2 closed · v1.23.1 Turnstile on + Apps Script v5 + deploy on Chốt · v1.24.0 GOAT top-1 badges, heat arc gauge, H2H compare bars (no BASEMENT line yet — see open items).
- Apps Script web app (same URL for every version): `https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec` — version 5 deployed 2026-11-06 per commit 0e9afd5 (cache, flower rate limit, Turnstile, optional REF_PIN, `triggerDeploy_()` runs the GitHub workflow after every Chốt when Script property `GH_TOKEN` is set).
- Turnstile public site key is in `config/site.json` `protect`; the secret lives only in Script properties (owner).
- Sheet "MCGAAW Cup — Trứng thối" id `1ZCP48Eg-2kJ7nFiIXaM3zs3qEJOx4fX7cwtOf35e1mI`, tabs: eggs (flowers), referee, referee_log, referee_final, referee_draft.
- Results (both closed): T1 Chốt #T1-FUJF8B (Đội 2 155–88, 5–0). T2 Chốt #T2-FC2S83 (pairs 1 and 3 absent, not played; Đội 4 91–73, pairs 2–1).
- Next: 11/11 T3 Đội 5–Đội 6 and T4 (semi) Đội 2–Đội 4 · 18/11 T5 Đội 1–Đội 3.
- v1.25.1 (2026-11-11): the referee page reads the server Chốt list, so T1/T2 show as closed on every phone and leave "Ngày trước".
- Gallery: album `01-doi-1-va-doi-2` (4 team photos from the owner, 2026-11-11; Đội 1 pink shirts, Đội 2 red KAIZEN shirts) after the champions album.
- Reports published for 04/11 (day + GOAT) in `downloads/` and `config/reports.json`.
- GitHub cron builds are unreliable; with GH_TOKEN set the Chốt itself starts a build. If the site is not updated 10 min after a Chốt: `gh workflow run deploy.yml` or any push.
- Work is split between agents by `PROCESS.md` (roles, task briefs in `tasks/`, `scripts/preflight.py`, `scripts/verify_live.py`). The PC folder is a git clone: sync it with `git pull --ff-only`, never by copying files.

## How to change things safely
- Data (names, seeds, dates, results) → `config/*.json`, then `python scripts/build_site.py`.
- Referee page → `web/ref.*`; then run `scripts/tests/referee_*.py` (mocked API, no real data touched). All must end with `errors []`.
- Apps Script → edit `scripts/apps_script/eggs.gs`, paste into the editor (Monaco `setValue`), Ctrl+S, Deploy → Manage deployments → edit → New version → Deploy. Verify with curl: `?ref=all` returns `{"matches":…,"finals":…}`; POST test rows only under match `T10`, then delete them in all three referee tabs.
- Never write test data under T1–T9.

## Verify checklist (after any referee change)
1. `python scripts/build_site.py` prints `[OUTPUT]` and `[REFEREE]` lines.
2. Six tests in `scripts/tests/` → `errors []`; positions/scoring/end/pairs screens fit 360×780 and 375×667.
3. After deploy: `curl -s <site>/version.json` shows the new version.

## Open items (ask the owner, do not decide alone)
- Not confirmed by the owner: is `REF_PIN` set, is `TURNSTILE_SECRET` set, is `GH_TOKEN` set (Chốt → auto build)? Check once and record here.
- v1.24.0 (GOAT badges, heat arc, H2H bars) shipped without a BASEMENT line or HANDOFF note: the lead should add one line to BASEMENT §6 after looking at it.
- Trust (deferred 2026-11-04): anyone could POST a fake Chốt; with REF_PIN set this is closed.
- Robot ideas (live scores, profile, compare, BXH, reports, schedule, theme, offline, Turnstile, referee page) offered 2026-11-05; the owner has not picked any.
- Intro animation storyboard v2 https://claude.ai/artifact/MsioXD6SSReWoKH1qY1VZ2 awaits approval.
- Referee page: a "Chốt with absent pairs = not played" button (today the lead posts it by hand).
