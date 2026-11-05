# HANDOFF — session backup (read after BASEMENT.md; update at the end of every session)

Keep this file short: current state, live endpoints, how to verify, open items. Rules live in `BASEMENT.md`; history lives in git.

## Current state (2026-11-05, v1.17.2)
- Live site: https://mcgaaw-badminton.github.io · referee page: `/trong-tai.html` · repo `mcgaaw-badminton/mcgaaw-badminton.github.io` (push to `main` deploys).
- Apps Script web app (same URL for every version): `https://script.google.com/macros/s/AKfycbwokvj0XppGWxny8F3NBjy1rVPTXSQ6P0_QC2vYjY4YovIuHJRSpcXRPenYioFKU0ANhA/exec` — deployed version 4 = `scripts/apps_script/eggs.gs` (history log + Chốt).
- Sheet "MCGAAW Cup — Trứng thối" id `1ZCP48Eg-2kJ7nFiIXaM3zs3qEJOx4fX7cwtOf35e1mI`, tabs: eggs, referee, referee_log, referee_final, referee_draft.
- Schedule: T1, T2 on 04/11/2026; T3 (+T4) on 11/11/2026.
- Results: T1 Chốt #T1-F1NB36 (Đội 2 155–88, 5–0 pairs) is live in the standings. T2 not closed: pairs 1 and 3 unplayed (0–0); played pairs 25–31, 31–29, 17–31.
- GitHub's scheduled builds are unreliable: on 04/11 only one run fired (00:50) out of the planned every-15-min evening runs. After a Chốt, a manual run (`gh workflow run` or any push) updates the site at once.
- 2026-11-04 10:55: the user's T1 test was reset on the live sheet (pairs 1 and 4 re-sent blank with a newer `updated`, so phones pull the reset; rows stay in `referee`, history in `referee_log`). No finals exist.

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
- Trust (deferred by the user on 2026-11-04, "tạm thời không cần"): the Apps Script endpoint is public; anyone could POST a fake "Chốt". Proposal kept: server checks the Chốt against the `referee` rows and/or a referee PIN.
- Other phones only learn "Đã chốt" from their own press (status is per phone); could pull `finals` from `?ref=all`.
- Intro animation (dev only): storyboard v2 https://claude.ai/artifact/MsioXD6SSReWoKH1qY1VZ2 awaits approval.
- Older questions still open: referee PIN; tap targets/font scale on the main page.
