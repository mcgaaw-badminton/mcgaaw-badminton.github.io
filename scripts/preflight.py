"""Preflight: the checks every task runs before its report and the lead runs before a release (PROCESS.md §3, §6).

    python scripts/preflight.py               # all checks against origin/main
    python scripts/preflight.py --release     # lead, on main before pushing: also wants a version bump + HANDOFF.md
    python scripts/preflight.py --all-tests   # run the referee tests even if web/ref.* did not change
    python scripts/preflight.py --dry-run     # list the checks, run nothing

Ends with "[OK]" or "[FAIL] n problem(s)", then "[OUTPUT] output/preflight.txt" (full log).
Reads the live Apps Script only through build_site.py (read-only GET). Never writes to the Sheet.
"""
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib.paths import CONFIG, OUTPUT, ROOT, SCRIPTS, SITE_JSON, WEB  # noqa: E402

CONFLICT_ZONE = ["web/site.js", "web/site.css", "web/body.html", "web/ref.js", "web/ref.css", "scripts/build_site.py",
                 "scripts/_lib/tournament.py", "config/site.json", "config/schedule.json"]
SHIPPED = ("web/", "config/", "scripts/build_site.py", "scripts/_lib/", "assets/", "slides/", "gallery/", "downloads/")
SECRET_PATTERNS = [
    (re.compile(r"gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}"), "GitHub token"),
    (re.compile(r"0x4AAAAAAA[A-Za-z0-9_-]{20,}"), "Turnstile SECRET key (only the public site key may be in the repo)"),
    (re.compile(r"(?i)(REF_PIN|TURNSTILE_SECRET|GH_TOKEN)\s*[:=]\s*['\"][^'\"]{3,}"), "secret value next to its Script property name"),
]

log_lines, problems, notes = [], [], []


def out(s=""):
    print(s)
    log_lines.append(s)


def sh(cmd, check=False):
    r = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if check and r.returncode:
        raise RuntimeError(f"{' '.join(cmd)} → {r.returncode}: {r.stderr.strip()[:300]}")
    return r


def fail(msg):
    problems.append(msg)
    out("  ✗ " + msg)


def ok(msg):
    out("  ✓ " + msg)


def warn(msg):
    notes.append(msg)
    out("  ! " + msg)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--release", action="store_true", help="lead on main: require a version bump and HANDOFF.md in the change")
    ap.add_argument("--all-tests", action="store_true")
    ap.add_argument("--base", default="origin/main")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()

    steps = ["git state + changed files vs " + a.base, "config/*.json parse", "JavaScript syntax (web/*.js, assets/vendor/flower-heads.js)",
             "secret scan of the change", "version rule (" + ("release: bumped once" if a.release else "worker: not bumped") + ")",
             "HANDOFF.md / BASEMENT.md touched when behaviour ships", "build the site (scripts/build_site.py)",
             "referee tests (when web/ref.* changed or --all-tests)"]
    if a.dry_run:
        out("[DRY-RUN] preflight would run:")
        for i, s in enumerate(steps, 1):
            out(f"  {i}. {s}")
        write_log()
        return

    # 1. git
    out("1. git")
    sh(["git", "fetch", "-q", "origin"])
    branch = sh(["git", "rev-parse", "--abbrev-ref", "HEAD"]).stdout.strip()
    has_base = sh(["git", "rev-parse", "--verify", "-q", a.base]).returncode == 0
    changed = sorted(set(filter(None, (sh(["git", "diff", "--name-only", a.base]).stdout if has_base else "").splitlines()))
                     | set(filter(None, sh(["git", "ls-files", "--others", "--exclude-standard"]).stdout.splitlines())))
    dirty = [l for l in sh(["git", "status", "--porcelain"]).stdout.splitlines() if l.strip()]
    ok(f"branch {branch} · {len(changed)} file(s) differ from {a.base}" if has_base else f"branch {branch} · {a.base} not found")
    for f in changed:
        out("      " + f)
    if dirty:
        warn(f"{len(dirty)} uncommitted change(s): commit before the report/push")
    if a.release and branch != "main":
        fail("--release runs on main (the lead merges first)")
    if not a.release and branch == "main" and changed:
        warn("working on main: workers use a task/<id> branch (PROCESS.md §3)")
    hot = [f for f in changed if f in CONFLICT_ZONE]
    if hot:
        warn("conflict-zone files changed (one open task per file, PROCESS.md §7): " + ", ".join(hot))

    # 2. config
    out("2. config")
    for p in sorted(CONFIG.glob("*.json")):
        try:
            json.loads(p.read_text(encoding="utf-8"))
            ok(p.name)
        except Exception as e:  # noqa: BLE001
            fail(f"config/{p.name} is not valid JSON: {e}")

    # 3. JS syntax
    out("3. JavaScript syntax")
    js = sorted(WEB.glob("*.js")) + [ROOT / "assets/vendor/flower-heads.js"]
    node_ok = sh(["node", "--version"]).returncode == 0
    if not node_ok:
        warn("node not found: JS syntax not checked")
    for p in js:
        if node_ok and p.exists():
            r = sh(["node", "--check", str(p)])
            (ok if r.returncode == 0 else fail)(f"{p.relative_to(ROOT)}" + ("" if r.returncode == 0 else " → " + r.stderr.strip().splitlines()[-1][:200]))

    # 4. secrets (added lines only)
    out("4. secrets")
    diff = sh(["git", "diff", a.base]).stdout if has_base else ""
    for f in changed:
        if sh(["git", "ls-files", "--error-unmatch", f]).returncode and (ROOT / f).is_file() and (ROOT / f).stat().st_size < 2_000_000:
            try:
                diff += "\n".join("+" + l for l in (ROOT / f).read_text(encoding="utf-8").splitlines())
            except UnicodeDecodeError:
                pass
    added = "\n".join(l[1:] for l in diff.splitlines() if l.startswith("+") and not l.startswith("+++"))
    hits = [(name, m.group(0)[:12] + "…") for rx, name in SECRET_PATTERNS for m in rx.finditer(added)]
    if hits:
        for name, s in hits:
            fail(f"possible {name} in the change ({s}); move it to Script properties")
    else:
        ok("no token or secret patterns in the change")

    # 5. version
    out("5. version")
    ver = json.loads(SITE_JSON.read_text(encoding="utf-8")).get("version", "")
    base_ver = ""
    if has_base:
        r = sh(["git", "show", f"{a.base}:config/site.json"])
        if r.returncode == 0:
            base_ver = json.loads(r.stdout).get("version", "")
    ships = [f for f in changed if f.startswith(SHIPPED)]
    if a.release:
        if ships and ver == base_ver:
            fail(f"release ships {len(ships)} file(s) but version is still {ver}: bump it once (PROCESS.md §8)")
        elif ships and not newer(ver, base_ver):
            fail(f"version {ver} is not newer than {base_ver}")
        else:
            ok(f"version {base_ver} → {ver}" if ver != base_ver else f"version {ver} (nothing shipped)")
    else:
        if ver != base_ver and base_ver:
            fail(f"version changed {base_ver} → {ver}: only the lead bumps it at merge (PROCESS.md §7)")
        else:
            ok(f"version untouched ({ver})")

    # 6. records
    out("6. records")
    if a.release and ships and "HANDOFF.md" not in changed:
        fail("release without a HANDOFF.md update (PROCESS.md §6)")
    elif ships and "HANDOFF.md" not in changed:
        warn("HANDOFF.md not changed: the lead updates it at merge")
    else:
        ok("HANDOFF.md in the change" if "HANDOFF.md" in changed else "nothing shipped")
    if any(f.startswith(("web/", "scripts/")) for f in ships) and "BASEMENT.md" not in changed:
        warn("behaviour may have changed but BASEMENT.md did not: check whether a rule needs a line")

    # 7. build
    out("7. build")
    r = sh([sys.executable, str(SCRIPTS / "build_site.py")])
    lines = (r.stdout + r.stderr).strip().splitlines()
    for l in lines:
        if l.startswith(("[ERROR]", "[WARN]", "[REFEREE]", "[SITE]")):
            out("      " + l)
    if r.returncode or not any(l.startswith("[OUTPUT]") for l in lines):
        fail("build_site.py failed: " + (lines[-1] if lines else "no output"))
    else:
        ok("site built → output/site")

    # 8. referee tests
    out("8. referee tests")
    if a.all_tests or any(f.startswith("web/ref") for f in changed):
        for t in sorted((SCRIPTS / "tests").glob("referee_*.py")):
            r = sh([sys.executable, str(t)])
            last = [l for l in r.stdout.splitlines() if re.search(r"(^|\s)errors \[", l)]  # tests print "errors [...]" (some prefix the screen width)
            good = r.returncode == 0 and bool(last) and all(l.rstrip().endswith("errors []") for l in last)
            (ok if good else fail)(t.name + ("" if good else " → " + (last[-1] if last else (r.stderr.strip().splitlines() or ["no output"])[-1])[:200]))
    else:
        ok("skipped (web/ref.* unchanged)")

    out("")
    if notes:
        out(f"{len(notes)} note(s) to read above.")
    out("[OK]" if not problems else f"[FAIL] {len(problems)} problem(s)")
    write_log()
    sys.exit(1 if problems else 0)


def newer(a, b):
    try:
        return tuple(map(int, a.split("."))) > tuple(map(int, b.split(".")))
    except ValueError:
        return a != b


def write_log():
    OUTPUT.mkdir(exist_ok=True)
    p = OUTPUT / "preflight.txt"
    p.write_text("\n".join(log_lines) + "\n", encoding="utf-8")
    print(f"[OUTPUT] {p}")


if __name__ == "__main__":
    main()
