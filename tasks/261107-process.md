# 261107-process — workflow rules for lead + agents

## Brief (lead)
- **Owner's request:** "Tạo rule md hoặc các tiêu chuẩn để việc deploy hay các process được đồng bộ tốt nhất, một số tiến trình hiện tại của tôi có thể giao cho agent khác, bạn sẽ thường chỉ là lead và lên process"
- **Goal:** any agent can pick up a task and ship it the same way; HANDOFF stays true.
- **Risk class:** C · owner review: reads the summary.
- **Claim:** PROCESS.md, AGENTS.md, CLAUDE.md, tasks/, scripts/preflight.py, scripts/verify_live.py, HANDOFF.md, BASEMENT.md (header + §2 layout).
- **Acceptance:** preflight runs end to end on main; HANDOFF matches the live state.

## Report (worker)
- **Agent / branch:** Claude (lead, solo path) · main
- **Why:** v1.23.1 / v1.24.0 shipped without HANDOFF/BASEMENT updates (HANDOFF still said Apps Script v4); v1.15.0 was used by three commits; PC folder is now a git clone where file copies would collide.
- **Checked:** `python scripts/preflight.py` and `--dry-run`, `python scripts/verify_live.py`.

## Lead review
- **Result:** done 2026-11-07 (docs, no version bump).
