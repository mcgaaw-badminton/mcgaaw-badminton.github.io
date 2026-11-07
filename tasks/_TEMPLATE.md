# <id> — <short title>
<!-- copy to tasks/<YYMMDD-slug>.md · the lead fills "Brief", the worker fills "Report" · English, short lines -->

## Brief (lead)
- **Owner's request (verbatim, Vietnamese ok):**
- **Goal:** what the owner will see or be able to do when this is done.
- **Risk class:** A / B / C (PROCESS.md §4) · **Owner review needed before release:** yes / no
- **Claim — may change:** `path`, `path`
- **Must not change:** everything else; in particular …
- **Inputs / references:** BASEMENT §…, review page …, data …
- **Acceptance checks:**
  - [ ] `python scripts/preflight.py` → `[OK]`
  - [ ] screens 360×640 · 390×844 · 768×1024 · 1366×800 (light + dark if colours change), no sideways scroll
  - [ ] …task-specific check…
- **Out of scope / do not decide alone:** …

## Report (worker)
- **Agent / branch:** <name> · `task/<id>` · last commit `<sha>`
- **Changed files:** `path` — why
- **How it was checked:** commands + results; screenshots in `output/review/<id>/`
- **Not done / known issues:**
- **Rule changes proposed** (lead decides; do not edit BASEMENT/PROCESS yourself):

## Lead review
- **Result:** accepted in vX.Y.Z / sent back (notes) · date
