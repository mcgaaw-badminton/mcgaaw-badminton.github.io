"""Build printable match sheets (A4 landscape PDF) from config/teams.json + config/schedule.json.

Usage (from the workspace root):
    python scripts/build_sheets.py --days 1 2            # sheets for day 1 and 2
    python scripts/build_sheets.py --matches T5 T6       # chosen matches
    python scripts/build_sheets.py --days 1 2 --dry-run  # list what would be built, write nothing

Output: output/Phieu_thi_dau_<tag>.pdf (HTML kept in output/_build/ for checking).
Needs: Python 3.9+, Node 18+ and `npm install` once inside scripts/ (playwright-core + a Chrome/Edge on the machine).
"""
import argparse
import html
import json
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import paths  # noqa: E402
from _lib.tournament import validate, resolve_matches  # noqa: E402

e = html.escape
SHUTTLE = ('<svg viewBox="0 0 24 24" fill="none" stroke="{c}" stroke-width="{w}" stroke-linecap="round" '
           'stroke-linejoin="round"><path d="M8.5 16.5 5 3h14l-3.5 13.5"/>'
           '<path d="M10 3l.8 13.5M14 3l-.8 13.5M6.2 7.5h11.6M7.3 12h9.4"/>'
           '<path d="M8.5 16.5h7v1.5a3.5 3.5 0 0 1-7 0z"/></svg>')


def load():
    """Rosters, pairs and matches; 'Thắng/Thua Tx' sides are replaced by the team id once results decide them."""
    teams = json.loads(paths.TEAMS_JSON.read_text(encoding="utf-8"))
    sched = json.loads(paths.SCHEDULE_JSON.read_text(encoding="utf-8"))
    site = json.loads(paths.SITE_JSON.read_text(encoding="utf-8"))
    errors = validate(sched, teams)
    if errors:
        print(f"[ERROR] config/schedule.json có {len(errors)} lỗi:")
        for err in errors:
            print("  - " + err)
        sys.exit(1)
    resolved = {r["code"]: r for r in resolve_matches(sched, teams, site["branches"])}
    matches = []
    for m in sched["matches"]:
        r = resolved[m["code"]]
        matches.append(dict(m, a=r["a"]["team"] or r["a"]["label"], b=r["b"]["team"] or r["b"]["label"]))
    return teams["teams"], [tuple(p) for p in teams["pairs"]], matches


def side(value, teams):
    """Team id -> ("Đội N", members); a label like 'Thắng T1' -> (label, None) = blank lines on the sheet."""
    if value in teams:
        return f"Đội {value}", teams[value]
    return value, None


def name(members, seed):
    return e(members[seed - 1]) if members else '<span class="blank"></span>'


def roster(label, members, cls):
    rows = "".join(f'<div class="r"><div class="seed {cls}">{i}</div><div class="nm">{name(members, i)}</div></div>'
                   for i in range(1, 6))
    return f'<div class="roster"><div class="rh {cls}">{e(label)}</div>{rows}</div>'


def page(m, teams, pairs):
    la, a = side(m["a"], teams)
    lb, b = side(m["b"], teams)
    note = ""
    if a is None or b is None:
        note = f'<div class="note">Điền tên đội và VĐV khi đã có kết quả các trận trước ({e(la)} · {e(lb)}).</div>'
    rows = ""
    for i, (x, y) in enumerate(pairs, 1):
        rows += (f'<tr><td class="pc"><b>Cặp {i}</b><span>{x} – {y}</span></td>'
                 f'<td class="pl">{name(a, x)}<br>{name(a, y)}</td><td class="sc"></td><td class="sc"></td>'
                 f'<td class="pl">{name(b, x)}<br>{name(b, y)}</td><td class="win"></td></tr>')
    return f'''
<section class="page">
 <div class="wm">{SHUTTLE.format(c="#1D2BD9", w=0.6)}</div>
 <header>
  <div class="hl">
   <div class="ic">{SHUTTLE.format(c="#FFFFFF", w=1.5)}</div>
   <div>
    <div class="eb">GIẢI CẦU LÔNG ĐỒNG ĐỘI · NGÀY {m["day"]} · THỨ 4 · {e(m["date"])}</div>
    <h1>{e(m["code"])} · {e(m["round"])}</h1>
    <div class="sub">{e(la)} <span class="vs">vs</span> {e(lb)}</div>
   </div>
  </div>
  <img class="logo" src="{paths.LOGO.as_uri()}" alt="MCGAAW">
 </header>
 {note}
 <div class="body">
  <div class="left">
   {roster(la, a, "a")}
   {roster(lb, b, "b")}
   <div class="rule">
    <div class="rt">ĐỘI THẮNG TRẬN</div>
    <div>1. Tổng điểm 5 cặp cao hơn.</div>
    <div>2. Hòa tổng điểm → đội thắng nhiều cặp hơn.</div>
   </div>
  </div>
  <div class="right">
   <table>
    <thead><tr><th>Cặp (seed)</th><th>{e(la)}</th><th>Điểm</th><th>Điểm</th><th>{e(lb)}</th><th>Thắng</th></tr></thead>
    <tbody>{rows}</tbody>
    <tfoot><tr><td colspan="2" class="tl">TỔNG ĐIỂM</td><td class="sc"></td><td class="sc"></td>
     <td colspan="2" rowspan="2" class="tl">ĐỘI THẮNG TRẬN<br><span class="blank" style="width:70%"></span></td></tr>
     <tr><td colspan="2" class="tl">SỐ CẶP THẮNG</td><td class="sc"></td><td class="sc"></td></tr></tfoot>
   </table>
   <div class="sign">
    <div class="sg"><div class="line"></div>Đại diện {e(la)}</div>
    <div class="sg"><div class="line"></div>Đại diện {e(lb)}</div>
    <div class="sg res"><div class="line"></div>Trọng tài / BTC</div>
   </div>
  </div>
 </div>
 <footer><div class="fl">SMASH · DROP · CLEAR</div>
  <div class="fr"><span class="fi">{SHUTTLE.format(c="#FFFFFF", w=1.6)}</span>MCGAAW BADMINTON</div></footer>
</section>'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", nargs="*", type=int, default=[])
    ap.add_argument("--matches", nargs="*", default=[])
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    teams, pairs, matches = load()
    chosen = [m for m in matches if m["day"] in args.days or m["code"] in args.matches]
    if not chosen:
        sys.exit("[ERROR] no match selected - use --days and/or --matches")

    tag = "Ngay" + "-".join(str(d) for d in sorted(set(args.days))) if args.days and not args.matches \
        else "_".join(m["code"] for m in chosen)
    pdf = paths.OUTPUT / f"Phieu_thi_dau_{tag}.pdf"
    page_html = paths.BUILD / f"sheets_{tag}.html"

    for m in chosen:
        print(f"[SHEET] {m['code']} day {m['day']} {m['date']}: {side(m['a'], teams)[0]} vs {side(m['b'], teams)[0]}")
    if args.dry_run:
        print(f"[DRY-RUN] would write {page_html} and {pdf}")
        print(f"[OUTPUT] {pdf}")
        return

    paths.BUILD.mkdir(parents=True, exist_ok=True)
    css = (paths.ASSETS / "sheet.css").as_uri()
    doc = (f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Phiếu thi đấu {e(tag)}</title>'
           f'<link rel="stylesheet" href="{css}"></head><body>'
           + "".join(page(m, teams, pairs) for m in chosen) + "</body></html>")
    page_html.write_text(doc, encoding="utf-8")
    subprocess.run(["node", str(paths.SCRIPTS / "render_pdf.mjs"), str(page_html), str(pdf)], check=True)
    print(f"[OUTPUT] {pdf}")


if __name__ == "__main__":
    main()
