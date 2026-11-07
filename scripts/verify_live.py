"""Wait until the live site serves the version in config/site.json (PROCESS.md §3 step 8).

    python scripts/verify_live.py              # wait up to 6 minutes
    python scripts/verify_live.py --minutes 10
    python scripts/verify_live.py --dry-run    # show what it would check

Prints the live version.json and ends with [OK] or [FAIL], then [OUTPUT] output/verify_live.txt.
"""
import argparse
import json
import random
import sys
import time
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.paths import OUTPUT, SITE_JSON  # noqa: E402

SITE = "https://mcgaaw-badminton.github.io"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--minutes", type=float, default=6)
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    want = json.loads(SITE_JSON.read_text(encoding="utf-8"))["version"]
    lines = []
    if a.dry_run:
        lines.append(f"[DRY-RUN] would poll {SITE}/version.json until version == {want}")
    else:
        end, live = time.time() + a.minutes * 60, None
        while time.time() < end:
            try:
                with urllib.request.urlopen(f"{SITE}/version.json?x={random.randint(0, 1 << 30)}", timeout=20) as r:
                    live = json.loads(r.read().decode("utf-8"))
                if live.get("version") == want:
                    break
            except Exception as e:  # noqa: BLE001
                live = {"error": str(e)}
            time.sleep(10)
        lines.append("live: " + json.dumps(live, ensure_ascii=False))
        lines.append("[OK] live = " + want if live and live.get("version") == want else f"[FAIL] live is not {want} after {a.minutes} min: check the Actions tab")
    for l in lines:
        print(l)
    OUTPUT.mkdir(exist_ok=True)
    p = OUTPUT / "verify_live.txt"
    p.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"[OUTPUT] {p}")
    sys.exit(0 if a.dry_run or lines[-1].startswith("[OK]") else 1)


if __name__ == "__main__":
    main()
