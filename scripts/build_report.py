"""Match-day report (A4 landscape PDF, same template as the match sheets) from the referees' rally logs.

Usage (from the workspace root):
    python scripts/build_report.py                      # latest match day that has referee data
    python scripts/build_report.py --matches T1 T2      # chosen matches
    python scripts/build_report.py --offline            # use the cached JSON in output/report/<date>/
    python scripts/build_report.py --dry-run            # print what would be built, write nothing

Pages: 1 overview of the day (results, pair-by-pair bars, highlights, heat top 5) · 1 page per match
(pair table, score flow of every pair, attack/support per player, serve stats).
Output: output/Bao_cao_<dd-mm-yyyy>.pdf (HTML in output/_build/, raw data in output/report/<yyyy-mm-dd>/).
"""
import argparse
import html
import json
import subprocess
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import paths  # noqa: E402
from _lib.tournament import validate, resolve_matches, stats  # noqa: E402
from build_sheets import SHUTTLE  # noqa: E402

e = html.escape
TARGET, SWAP_AT = 31, 16
CA, CB = "#1D2BD9", "#B5440F"  # side colours of the match sheets (team A blue, team B orange)


def read(p):
    return json.loads(Path(p).read_text(encoding="utf-8"))


def given(n):
    return n.strip().split()[-1]


def replay(state):
    """Rally by rally: score, lead, serving side, breaks, runs, change of ends, attack/support (BWF doubles, rally to 31)."""
    su, log = state.get("setup") or {}, state.get("log") or []
    srv = su.get("serve")
    sc, lead, srv_won, brk, run, best, swap = {"a": 0, "b": 0}, [0], {"a": 0, "b": 0}, {"a": 0, "b": 0}, [None, 0], {"a": 0, "b": 0}, None
    atk, sup = {}, {}
    for k, ev in enumerate(log):
        if max(sc.values()) >= TARGET:
            break
        w, p = ev.get("w"), ev.get("p")
        if w not in sc:
            continue
        if w == srv:
            srv_won[w] += 1
        else:
            brk[w] += 1
            srv = w
        sc[w] += 1
        run = [w, run[1] + 1] if run[0] == w else [w, 1]
        best[w] = max(best[w], run[1])
        lead.append(sc["a"] - sc["b"])
        if swap is None and sc[w] == SWAP_AT:
            swap = len(lead) - 1
        if p in (0, 1):
            atk[(w, p)] = atk.get((w, p), 0) + 1
            sup[(w, 1 - p)] = sup.get((w, 1 - p), 0) + 1
    return {"sc": sc, "lead": lead, "srv": srv_won, "brk": brk, "run": best, "swap": swap, "atk": atk, "sup": sup,
            "n": len(lead) - 1, "ms": int(state.get("ms") or 0), "absent": bool(state.get("absent"))}


def mmss(ms):
    s = ms // 1000
    return f"{s // 60}:{s % 60:02d}"


def flow_svg(r, w=300, h=74):
    """Lead line (A above, B below) across the rallies of one pair; dashed mark at the change of ends."""
    n, lead = max(1, r["n"]), r["lead"]
    top = max(8, max(abs(x) for x in lead))
    X = lambda i: 4 + i / n * (w - 8)  # noqa: E731
    Y = lambda v: h / 2 - v / top * (h / 2 - 6)  # noqa: E731
    pts = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(lead))
    area_a = f"M{X(0):.1f},{h/2} " + " ".join(f"L{X(i):.1f},{min(Y(v), h/2):.1f}" for i, v in enumerate(lead)) + f" L{X(len(lead)-1):.1f},{h/2} Z"
    area_b = f"M{X(0):.1f},{h/2} " + " ".join(f"L{X(i):.1f},{max(Y(v), h/2):.1f}" for i, v in enumerate(lead)) + f" L{X(len(lead)-1):.1f},{h/2} Z"
    sw = (f'<line x1="{X(r["swap"]):.1f}" y1="3" x2="{X(r["swap"]):.1f}" y2="{h-3}" stroke="#7D84A3" stroke-width="1" stroke-dasharray="3 3"/>'
          f'<text x="{X(r["swap"])+3:.1f}" y="11" font-size="8" fill="#7D84A3">đổi sân</text>') if r["swap"] else ""
    return (f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}"><line x1="4" y1="{h/2}" x2="{w-4}" y2="{h/2}" stroke="#CDD1E6"/>'
            f'<path d="{area_a}" fill="{CA}" opacity=".14"/><path d="{area_b}" fill="{CB}" opacity=".16"/>{sw}'
            f'<polyline points="{pts}" fill="none" stroke="#0E1430" stroke-width="1.6" stroke-linejoin="round"/></svg>')


def load(args):
    teams_cfg, sched, site = read(paths.TEAMS_JSON), read(paths.SCHEDULE_JSON), read(paths.SITE_JSON)
    pairs = teams_cfg["pairs"]
    api = (site.get("eggs") or {}).get("api_url", "")
    raw_all = None
    if not args.offline and api:
        with urllib.request.urlopen(api + "?ref=all", timeout=25) as r:
            raw_all = json.loads(r.read().decode("utf-8"))
    codes = args.matches
    if not codes:  # latest day that has referee rows
        have = set((raw_all or {}).get("matches", {}))
        days = sorted({m["date"] for m in sched["matches"] if m["code"] in have}, key=lambda d: d.split("/")[::-1])
        if not days:
            sys.exit("[ERROR] no referee data - use --matches")
        codes = [m["code"] for m in sched["matches"] if m["date"] == days[-1] and m["code"] in have]
    date = next(m["date"] for m in sched["matches"] if m["code"] == codes[0])
    store = paths.OUTPUT / "report" / "-".join(date.split("/")[::-1])
    data = {}
    for c in codes:
        f = store / f"{c}.json"
        if args.offline:
            data[c] = read(f)
        else:
            with urllib.request.urlopen(api + "?ref=" + c, timeout=25) as r:
                data[c] = json.loads(r.read().decode("utf-8"))
    if raw_all is None:
        raw_all = read(store / "all.json")
    # standings after the day, as the site computes them: the last Chốt of each match without a typed result
    finals = raw_all.get("finals") or {}
    for m in sched["matches"]:
        f = finals.get(m["code"])
        if not m.get("result") and f and len(f.get("pairs") or []) == len(pairs):
            m["result"] = {"pairs": f["pairs"], "players": f.get("players") or {}}
    errs = validate(sched, teams_cfg)
    if errs:
        sys.exit("[ERROR] " + "; ".join(errs))
    st = stats(teams_cfg, resolve_matches(sched, teams_cfg, site["branches"]), site.get("placements", {}))
    return teams_cfg, sched, pairs, codes, date, store, data, raw_all, finals, st


def match_model(m, teams, pairs, rows, final):
    ta, tb = teams[m["a"]], teams[m["b"]]
    out = {"m": m, "A": ta, "B": tb, "pairs": [], "final": final}
    for k, (x, y) in enumerate(pairs):
        st = ((rows.get(str(k + 1)) or {}).get("state")) or {}
        r = replay(st)
        r["seeds"] = (x, y)
        r["names"] = {"a": [ta["members"][x - 1], ta["members"][y - 1]], "b": [tb["members"][x - 1], tb["members"][y - 1]]}
        r["played"] = r["n"] > 0 and max(r["sc"].values()) >= TARGET or (st.get("manualEnd") and r["n"] > 0)
        out["pairs"].append(r)
    pl = [p for p in out["pairs"] if p["played"]]
    out["ta"], out["tb"] = sum(p["sc"]["a"] for p in pl), sum(p["sc"]["b"] for p in pl)
    out["pa"], out["pb"] = sum(p["sc"]["a"] > p["sc"]["b"] for p in pl), sum(p["sc"]["b"] > p["sc"]["a"] for p in pl)
    out["ms"], out["n"], out["played"] = sum(p["ms"] for p in pl), sum(p["n"] for p in pl), len(pl)
    # attack / support per player over the match (seed index -> name)
    P = {}
    for p in pl:
        for side in "ab":
            for i in (0, 1):
                nm = p["names"][side][i]
                q = P.setdefault((side, nm), [0, 0])
                q[0] += p["atk"].get((side, i), 0)
                q[1] += p["sup"].get((side, i), 0)
    out["players"] = P
    return out


def header(eyebrow, title, sub):
    return (f'<div class="wm">{SHUTTLE.format(c="#1D2BD9", w=0.6)}</div><header><div class="hl"><div class="ic">{SHUTTLE.format(c="#FFFFFF", w=1.5)}</div>'
            f'<div><div class="eb">{eyebrow}</div><h1>{title}</h1><div class="sub">{sub}</div></div></div>'
            f'<img class="logo" src="{paths.LOGO.as_uri()}" alt="MCGAAW"></header>')


FOOTER = (f'<footer><div class="fl">SMASH · DROP · CLEAR</div><div class="fr"><span class="fi">{SHUTTLE.format(c="#FFFFFF", w=1.6)}</span>'
          'MCGAAW BADMINTON</div></footer>')


def status_line(mm):
    if mm["final"]:
        return f'<span class="ok">Đã chốt · mã #{e(mm["final"].get("report", ""))}</span>'
    absent = [i + 1 for i, p in enumerate(mm["pairs"]) if p["absent"]]
    left = 5 - mm["played"]
    return f'<span class="wait">Chưa chốt · đã đấu {mm["played"]}/5 cặp' + (f' · vắng cặp {", ".join(map(str, absent))} (đánh sau)' if absent else (f' · còn {left} cặp' if left else '')) + '</span>'


def overview(models, date, day, st):
    cards = ""
    for mm in models:
        a, b = mm["A"]["name"], mm["B"]["name"]
        wa = mm["final"] and (mm["ta"] > mm["tb"] or (mm["ta"] == mm["tb"] and mm["pa"] > mm["pb"]))
        wb = mm["final"] and not wa
        bars = ""
        for i, p in enumerate(mm["pairs"]):
            if not p["played"]:
                bars += f'<div class="pb"><span class="pn">Cặp {i+1}</span><div class="bx none">{"vắng · đánh sau" if p["absent"] else "chưa đấu"}</div></div>'
                continue
            sa, sb = p["sc"]["a"], p["sc"]["b"]
            bars += (f'<div class="pb"><span class="pn">Cặp {i+1}</span><div class="bx"><div class="ba"><i style="width:{sa/TARGET*100:.0f}%"></i><b>{sa}</b></div>'
                     f'<div class="bb"><b>{sb}</b><i style="width:{sb/TARGET*100:.0f}%"></i></div></div></div>')
        cards += (f'<div class="mc"><div class="mh"><span class="code">{e(mm["m"]["code"])}</span>{status_line(mm)}</div>'
                  f'<div class="big"><div class="tA{" win" if wa else ""}"><small>{e(a)}</small><b>{mm["ta"]}</b></div><i>–</i>'
                  f'<div class="tB{" win" if wb else ""}"><small>{e(b)}</small><b>{mm["tb"]}</b></div></div>'
                  f'<div class="meta">Cặp thắng {mm["pa"]}–{mm["pb"]} · {mm["n"]} pha bóng · {mmss(mm["ms"])} thi đấu</div>'
                  f'<div class="bars"><div class="bl"><span style="color:{CA}">{e(a)}</span><span style="color:{CB}">{e(b)}</span></div>{bars}</div></div>')
    # highlights across the day
    allp = [(mm, i, p) for mm in models for i, p in enumerate(mm["pairs"]) if p["played"]]
    close = min(allp, key=lambda t: abs(t[2]["sc"]["a"] - t[2]["sc"]["b"]))
    wide = max(allp, key=lambda t: abs(t[2]["sc"]["a"] - t[2]["sc"]["b"]))
    longest = max(allp, key=lambda t: t[2]["ms"])
    runs = max(((mm, i, p, s) for mm, i, p in allp for s in "ab"), key=lambda t: t[2]["run"][t[3]])
    atk = max(((mm, k, v) for mm in models for k, v in mm["players"].items()), key=lambda t: t[2][0])
    tn = lambda mm, s: mm["A"]["name"] if s == "a" else mm["B"]["name"]  # noqa: E731
    sc = lambda p: f'{p["sc"]["a"]}–{p["sc"]["b"]}'  # noqa: E731
    hl = [("Sát nút nhất", f'{close[0]["m"]["code"]} · cặp {close[1]+1}', sc(close[2])),
          ("Cách biệt lớn nhất", f'{wide[0]["m"]["code"]} · cặp {wide[1]+1}', sc(wide[2])),
          ("Cặp đánh lâu nhất", f'{longest[0]["m"]["code"]} · cặp {longest[1]+1}', mmss(longest[2]["ms"])),
          ("Chuỗi điểm dài nhất", f'{runs[0]["m"]["code"]} · cặp {runs[1]+1} · {e(tn(runs[0], runs[3]))}', f'{runs[2]["run"][runs[3]]} điểm'),
          ("Tấn công nhiều nhất", f'{e(atk[1][1])} · {e(tn(atk[0], atk[1][0]))}', f'{atk[2][0]} điểm')]
    hls = "".join(f'<div class="hi"><small>{t}</small><b>{v}</b><span>{d}</span></div>' for t, d, v in hl)
    top = sorted([p for p in st["players"] if p["played"]], key=lambda p: -p["heat"])[:5]  # only players with a closed match
    heat = "".join(f'<div class="ht"><span class="rk">{n+1}</span><span class="hn">{e(p["name"])}<small>{e(next(t["name"] for t in st["teams_cfg"] if t["id"] == p["team"]) if "teams_cfg" in st else "")}</small></span>'
                   f'<span class="th"><i style="width:{max(4, (p["heat"]-20)/25*100):.0f}%"></i></span><b>{p["heat"]:.1f}°<small class="{"up" if p["trend"] > 0 else "dn" if p["trend"] < 0 else ""}">{("▲ +" if p["trend"] > 0 else "▼ ") + str(abs(p["trend"])) if p["trend"] else "="}</small></b></div>' for n, p in enumerate(top)) or '<p class="nd">Chưa có trận nào được chốt.</p>'
    return (f'<section class="page rp">{header(f"BÁO CÁO NGÀY {day} · THỨ 4 · {e(date)}", "Tổng quan ngày thi đấu", f"{len(models)} lượt trận · dữ liệu từ trang trọng tài (tính từng pha bóng)")}'
            f'<div class="ov"><div class="cards">{cards}</div><div class="side"><div class="box"><div class="bt">ĐIỂM NHẤN TRONG NGÀY</div>{hls}</div>'
            f'<div class="box"><div class="bt">NHIỆT ĐỘ VĐV ĐÃ ĐẤU · TOP 5</div>{heat}<p class="fn">Theo trận đã chốt; mũi tên so với trước trận.</p></div></div></div>{FOOTER}</section>')


def match_page(mm, date, day):
    a, b = mm["A"]["name"], mm["B"]["name"]
    rows = ""
    for i, p in enumerate(mm["pairs"]):
        na, nb = " · ".join(given(n) for n in p["names"]["a"]), " · ".join(given(n) for n in p["names"]["b"])
        if not p["played"]:
            rows += (f'<tr class="off"><td class="pc"><b>Cặp {i+1}</b><span>{p["seeds"][0]}–{p["seeds"][1]}</span></td><td class="pl">{e(na)}</td>'
                     f'<td colspan="2" class="nd">{"vắng · đánh sau" if p["absent"] else "chưa đấu"}</td><td class="pl">{e(nb)}</td><td colspan="2"></td></tr>')
            continue
        sa, sb = p["sc"]["a"], p["sc"]["b"]
        rows += (f'<tr><td class="pc"><b>Cặp {i+1}</b><span>{p["seeds"][0]}–{p["seeds"][1]}</span></td><td class="pl{" w" if sa > sb else ""}">{e(na)}</td>'
                 f'<td class="sc{" wa" if sa > sb else ""}">{sa}</td><td class="sc{" wb" if sb > sa else ""}">{sb}</td><td class="pl{" w" if sb > sa else ""}">{e(nb)}</td>'
                 f'<td class="fl">{flow_svg(p)}</td><td class="tm">{mmss(p["ms"])}<small>{p["n"]} pha</small></td></tr>')
    pl = [p for p in mm["pairs"] if p["played"]]
    srv = {s: sum(p["srv"][s] for p in pl) for s in "ab"}
    brk = {s: sum(p["brk"][s] for p in pl) for s in "ab"}
    run = {s: max([p["run"][s] for p in pl] or [0]) for s in "ab"}
    P = sorted(mm["players"].items(), key=lambda t: (t[0][0], -(t[1][0] + t[1][1])))
    mx = max([v[0] + v[1] for v in mm["players"].values()] or [1])
    pbars = ""
    for (side, nm), (at, sp) in P:
        c = CA if side == "a" else CB
        pbars += (f'<div class="pr"><span class="pn2">{e(given(nm))}</span><span class="stk"><i style="width:{at/mx*100:.1f}%;background:{c}"></i>'
                  f'<i style="width:{sp/mx*100:.1f}%;background:{c};opacity:.35"></i></span><b>{at}<small> / {sp}</small></b></div>')
    tile = lambda lbl, s: f'<div class="sv"><small>{lbl}</small><b style="color:{CA}">{s["a"]}</b><i>–</i><b style="color:{CB}">{s["b"]}</b></div>'  # noqa: E731
    return (f'<section class="page rp">{header(f"BÁO CÁO NGÀY {day} · {e(mm['m']['round']).upper()} · {e(date)}", f"{e(mm['m']['code'])} · {e(a)} {mm['ta']}–{mm['tb']} {e(b)}", status_line(mm) + f" · cặp thắng {mm['pa']}–{mm['pb']} · {mm['n']} pha bóng · {mmss(mm['ms'])}")}'
            f'<div class="mp"><div class="lt"><table class="rt2"><thead><tr><th>Cặp</th><th style="background:{CA}">{e(a)}</th><th colspan="2">Điểm</th><th style="background:{CB}">{e(b)}</th>'
            f'<th>Diễn biến · ▲ {e(a)} dẫn · ▼ {e(b)} dẫn</th><th>Thời gian</th></tr></thead><tbody>{rows}</tbody></table></div>'
            f'<div class="rt"><div class="box"><div class="bt">TẤN CÔNG / HỖ TRỢ TỪNG VĐV</div><div class="lg"><span><i style="background:#0E1430"></i>Tấn công = tự ghi điểm</span><span><i style="background:#0E1430;opacity:.35"></i>Hỗ trợ = đồng đội ghi</span></div>{pbars}</div>'
            f'<div class="box"><div class="bt">GIAO CẦU & CHUỖI ĐIỂM</div><div class="svs">{tile("Thắng khi giao", srv)}{tile("Bẻ giao", brk)}{tile("Chuỗi dài nhất", run)}</div></div></div></div>{FOOTER}</section>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--matches", nargs="*", default=[])
    ap.add_argument("--offline", action="store_true", help="use cached JSON in output/report/<date>/")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    teams_cfg, sched, pairs, codes, date, store, data, raw_all, finals, st = load(args)
    teams = {t: {"name": f"Đội {t}", "members": mem} for t, mem in teams_cfg["teams"].items()}
    st["teams_cfg"] = [{"id": t, "name": v["name"]} for t, v in teams.items()]
    ms = {m["code"]: m for m in sched["matches"]}
    day = ms[codes[0]]["day"]
    models = [match_model(ms[c], teams, pairs, data[c].get("pairs") or {}, finals.get(c)) for c in codes]
    stem = "Bao_cao_" + date.replace("/", "-")
    pdf, page_html = paths.OUTPUT / f"{stem}.pdf", paths.BUILD / f"{stem}.html"
    for mm in models:
        print(f"[REPORT] {mm['m']['code']}: {mm['A']['name']} {mm['ta']}-{mm['tb']} {mm['B']['name']} · {mm['played']}/5 pairs · "
              + ("chốt" if mm["final"] else "chưa chốt"))
    if args.dry_run:
        print(f"[DRY-RUN] would write {store}/*.json, {page_html} and {pdf}")
        print(f"[OUTPUT] {pdf}")
        return
    store.mkdir(parents=True, exist_ok=True)
    for c in codes:
        (store / f"{c}.json").write_text(json.dumps(data[c], ensure_ascii=False), encoding="utf-8")
    (store / "all.json").write_text(json.dumps(raw_all, ensure_ascii=False), encoding="utf-8")
    paths.BUILD.mkdir(parents=True, exist_ok=True)
    css = [(paths.ASSETS / f).as_uri() for f in ("sheet.css", "report.css")]
    doc = (f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>Báo cáo {e(date)}</title>'
           + "".join(f'<link rel="stylesheet" href="{c}">' for c in css) + '</head><body>'
           + overview(models, date, day, st) + "".join(match_page(mm, date, day) for mm in models) + "</body></html>")
    page_html.write_text(doc, encoding="utf-8")
    subprocess.run(["node", str(paths.SCRIPTS / "render_pdf.mjs"), str(page_html), str(pdf)], check=True)
    print(f"[OUTPUT] {pdf}")


if __name__ == "__main__":
    main()
