"""Reports (A4 landscape PDF, same template as the match sheets) from the referees' rally logs. Two kinds:
  day  (default) — one match day: results, every pair's rally strip, attack/support, serve stats.
  goat           — the whole tournament so far: the leader of each stat (GOAT) + a table of all players.

Usage (from the workspace root):
    python scripts/build_report.py                      # day report: latest match day that has referee data
    python scripts/build_report.py goat                 # GOAT report over every finished pair so far
    python scripts/build_report.py goat --closed-only   # GOAT over closed ("Chốt") matches only
    python scripts/build_report.py --matches T1 T2      # chosen matches
    python scripts/build_report.py --offline            # use the cached JSON in output/report/<date>/
    python scripts/build_report.py --dry-run            # print what would be built, write nothing

Pages: 1 overview of the day (results, pair-by-pair bars, highlights, heat top 5) · 1 page per match
(pair table with a rally strip per pair, attack/support per player, serve stats, top runs).
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
    atk, sup, seq = {}, {}, []
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
        seq.append(w)
        run = [w, run[1] + 1] if run[0] == w else [w, 1]
        best[w] = max(best[w], run[1])
        lead.append(sc["a"] - sc["b"])
        if swap is None and sc[w] == SWAP_AT:
            swap = len(lead) - 1
        if p in (0, 1):
            atk[(w, p)] = atk.get((w, p), 0) + 1
            sup[(w, 1 - p)] = sup.get((w, 1 - p), 0) + 1
    return {"sc": sc, "lead": lead, "srv": srv_won, "brk": brk, "run": best, "swap": swap, "atk": atk, "sup": sup,
            "seq": seq, "n": len(lead) - 1, "ms": int(state.get("ms") or 0), "absent": bool(state.get("absent"))}


def mmss(ms):
    s = ms // 1000
    return f"{s // 60}:{s % 60:02d}"


def runs_of(seq):
    """Consecutive rallies won by the same side: [(side, start, length), ...]."""
    out = []
    for i, w in enumerate(seq):
        if out and out[-1][0] == w:
            out[-1][2] += 1
        else:
            out.append([w, i, 1])
    return out


def pair_facts(r):
    """Score when ends changed, biggest lead of each side, number of lead changes."""
    sa = sb = 0
    cum, maxl, changes, leader = [], {"a": 0, "b": 0}, 0, None
    for w in r["seq"]:
        sa, sb = (sa + 1, sb) if w == "a" else (sa, sb + 1)
        cum.append((sa, sb))
        d = sa - sb
        if d > 0:
            maxl["a"] = max(maxl["a"], d)
        if d < 0:
            maxl["b"] = max(maxl["b"], -d)
        now = "a" if d > 0 else "b" if d < 0 else leader
        if leader and now != leader:
            changes += 1
        leader = now
    swap = cum[r["swap"] - 1] if r["swap"] else None
    return {"cum": cum, "swap": swap, "maxl": maxl, "changes": changes}


def strip_svg(r, f, w=304, h=34):
    """One cell per rally, coloured by the side that won it. One label row above the cells (same style for all labels):
    the longest run of each side (outlined), and the change of ends (tick with the score)."""
    seq, n = r["seq"], max(1, len(r["seq"]))
    cw, y0, ch = (w - 4) / n, 14, 16
    X = lambda i: 2 + i * cw  # noqa: E731
    cells = "".join(f'<rect x="{X(i):.2f}" y="{y0}" width="{max(.6, cw - .9):.2f}" height="{ch}" rx="1.5" fill="{CA if s == "a" else CB}"/>' for i, s in enumerate(seq))
    labels, marks = [], ""
    rs = runs_of(seq)
    for side in "ab":
        mine = [x for x in rs if x[0] == side]
        best = max(mine, key=lambda x: x[2]) if mine else None
        if best and best[2] >= 3:
            x0, x1 = X(best[1]) - .7, X(best[1] + best[2]) - .1
            marks += f'<rect x="{x0:.2f}" y="{y0 - 1.5}" width="{x1 - x0:.2f}" height="{ch + 3}" rx="2.5" fill="none" stroke="#0E1430" stroke-width="1.4"/>'
            labels.append(((x0 + x1) / 2, str(best[2]), CA if side == "a" else CB))
    if r["swap"]:
        xs = X(r["swap"]) - .45
        marks += f'<line x1="{xs:.2f}" y1="{y0 - 3}" x2="{xs:.2f}" y2="{y0 + ch + 3}" stroke="#0E1430" stroke-width="1.6"/>'
        labels.append((xs, f"↔{f['swap'][0]}–{f['swap'][1]}", "#3B4266"))
    labels.sort()
    placed, right = [], -99.0
    for x, t, c in labels:  # one row, left to right; a label that would touch the previous one moves right
        hw = len(t) * 2.75 + 1
        x = max(x, right + 4 + hw, hw)
        placed.append([x, t, c, hw])
        right = x + hw
    if placed and right > w:  # pushed past the end: slide the whole row back, keeping the gaps
        shift = right - w
        for q in placed:
            q[0] -= shift
    txt = "".join(f'<text x="{x:.1f}" y="10" font-size="9" font-weight="800" text-anchor="middle" fill="{c}">{t}</text>' for x, t, c, _ in placed)
    return f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}">{cells}{marks}{txt}</svg>'


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
        if m.get("result"):
            m["_typed"] = True  # typed in config/schedule.json: the report treats it as closed
        if not m.get("result") and f and len(f.get("pairs") or []) == len(pairs):
            m["result"] = {"pairs": f["pairs"], "players": f.get("players") or {}}
    errs = validate(sched, teams_cfg)
    if errs:
        sys.exit("[ERROR] " + "; ".join(errs))
    st = stats(teams_cfg, resolve_matches(sched, teams_cfg, site["branches"]), site.get("placements", {}))
    return teams_cfg, sched, pairs, codes, date, store, data, raw_all, finals, st


def match_model(m, teams, pairs, rows, final):
    ta, tb = teams[m["a"]], teams[m["b"]]
    typed = (m.get("result") or {}).get("pairs") if not final and m.get("_typed") else None
    if typed:  # result typed in config/schedule.json (no Chốt on the sheet): counts as closed, null pairs = absent
        final = {"report": "BTC nhập", "typed": True}
    out = {"m": m, "A": ta, "B": tb, "pairs": [], "final": final}
    lineup = (m.get("result") or {}).get("lineup") or {}  # stand-ins typed in config (pair no. → side → seeds)
    for k, (x, y) in enumerate(pairs):
        st = ((rows.get(str(k + 1)) or {}).get("state")) or {}
        r = replay(st)
        r["seeds"] = (x, y)
        sa_, sb_ = (lineup.get(str(k + 1)) or {}).get("a") or (x, y), (lineup.get(str(k + 1)) or {}).get("b") or (x, y)
        r["side_seeds"] = {"a": tuple(sa_), "b": tuple(sb_)}
        r["names"] = {"a": [ta["members"][sa_[0] - 1], ta["members"][sa_[1] - 1]], "b": [tb["members"][sb_[0] - 1], tb["members"][sb_[1] - 1]]}
        r["played"] = r["n"] > 0 and max(r["sc"].values()) >= TARGET or (st.get("manualEnd") and r["n"] > 0)
        if typed and k < len(typed) and typed[k] is None:
            r["absent"] = True
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
        return f'<span class="ok">Đã chốt · {"ban tổ chức nhập" if mm["final"].get("typed") else "mã #" + e(mm["final"].get("report", ""))}</span>'
    absent = [i + 1 for i, p in enumerate(mm["pairs"]) if p["absent"]]
    left = 5 - mm["played"]
    return f'<span class="wait">Chưa chốt · đã đấu {mm["played"]}/5 cặp' + (f' · vắng cặp {", ".join(map(str, absent))} (đánh sau)' if absent else (f' · còn {left} cặp' if left else '')) + '</span>'


HL = []  # highlights of the last overview, reused for the site summary


def overview(models, date, day, st):
    cards = ""
    for mm in models:
        a, b = mm["A"]["name"], mm["B"]["name"]
        wa = mm["final"] and (mm["ta"] > mm["tb"] or (mm["ta"] == mm["tb"] and mm["pa"] > mm["pb"]))
        wb = mm["final"] and not wa
        bars = ""
        for i, p in enumerate(mm["pairs"]):
            if not p["played"]:
                bars += f'<div class="pb"><span class="pn">Cặp {i+1}</span><div class="bx none">{("vắng · không đấu" if mm["final"] else "vắng · đánh sau") if p["absent"] else "chưa đấu"}</div></div>'
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
    HL[:] = hl
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
                     f'<td colspan="2" class="nd">{("vắng · không đấu" if mm["final"] else "vắng · đánh sau") if p["absent"] else "chưa đấu"}</td><td class="pl">{e(nb)}</td><td colspan="2"></td></tr>')
            continue
        sa, sb = p["sc"]["a"], p["sc"]["b"]
        pf = pair_facts(p)
        rows += (f'<tr><td class="pc"><b>Cặp {i+1}</b><span>{p["seeds"][0]}–{p["seeds"][1]}</span></td><td class="pl{" w" if sa > sb else ""}">{e(na)}</td>'
                 f'<td class="sc{" wa" if sa > sb else ""}">{sa}</td><td class="sc{" wb" if sb > sa else ""}">{sb}</td><td class="pl{" w" if sb > sa else ""}">{e(nb)}</td>'
                 f'<td class="fw">{strip_svg(p, pf)}<div class="facts"><span>Dẫn xa nhất <b style="color:{CA}">+{pf["maxl"]["a"]}</b> / <b style="color:{CB}">+{pf["maxl"]["b"]}</b></span><span>Đổi người dẫn <b>{pf["changes"]}</b> lần</span></div></td><td class="tm">{mmss(p["ms"])}<small>{p["n"]} pha</small></td></tr>')
    # top runs of the match, with the score before -> after
    top = []
    for i, p in enumerate(mm["pairs"]):
        if not p["played"]:
            continue
        sa = sb = 0
        cum = [(0, 0)]
        for w in p["seq"]:
            sa, sb = (sa + 1, sb) if w == "a" else (sa, sb + 1)
            cum.append((sa, sb))
        for side, st0, ln in runs_of(p["seq"]):
            if ln >= 4:
                top.append((ln, i, side, cum[st0], cum[st0 + ln]))
    top.sort(key=lambda t: (-t[0], t[1]))
    runs_html = "".join(f'<div class="ru"><span class="rl" style="background:{CA if sd == "a" else CB}">{ln}</span><span>{e(a if sd == "a" else b)} · cặp {i+1}</span>'
                        f'<small>{f[0]}–{f[1]} → {t[0]}–{t[1]}</small></div>' for ln, i, sd, f, t in top[:6]) or '<p class="nd">Không có chuỗi từ 4 điểm.</p>'
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
            f'<th>Chuỗi điểm · khung = dài nhất · ↔ đổi sân</th><th>Thời gian</th></tr></thead><tbody>{rows}</tbody></table>'
            f'<div class="box"><div class="bt">TOP CHUỖI ĐIỂM (TỪ 4 ĐIỂM LIÊN TIẾP)</div><div class="rus">{runs_html}</div></div></div>'
            f'<div class="rt"><div class="box"><div class="bt">TẤN CÔNG / HỖ TRỢ TỪNG VĐV</div><div class="lg"><span><i style="background:#0E1430"></i>Tấn công = tự ghi điểm</span><span><i style="background:#0E1430;opacity:.35"></i>Hỗ trợ = đồng đội ghi</span></div>{pbars}</div>'
            f'<div class="box"><div class="bt">GIAO CẦU & CHUỖI ĐIỂM</div><div class="svs">{tile("Thắng khi giao", srv)}{tile("Bẻ giao", brk)}{tile("Chuỗi dài nhất", run)}</div></div></div></div>{FOOTER}</section>')


def goat_main(args):
    """GOAT report: every finished pair on the referee sheet (or closed matches only), per player totals."""
    teams_cfg, sched, site = read(paths.TEAMS_JSON), read(paths.SCHEDULE_JSON), read(paths.SITE_JSON)
    pairs, api = teams_cfg["pairs"], (site.get("eggs") or {}).get("api_url", "")
    store = paths.OUTPUT / "report" / "goat"

    def get(q, f):
        if args.offline:
            return read(store / f)
        with urllib.request.urlopen(api + "?ref=" + q, timeout=25) as r:
            return json.loads(r.read().decode("utf-8"))
    raw_all = get("all", "all.json")
    finals = raw_all.get("finals") or {}
    codes = [m["code"] for m in sched["matches"] if m["code"] in (raw_all.get("matches") or {}) and (finals.get(m["code"]) or not args.closed_only)]
    if not codes:
        sys.exit("[ERROR] no referee data yet")
    data = {c: get(c, f"{c}.json") for c in codes}
    for m in sched["matches"]:  # standings (heat) exactly as on the site: last Chốt of each match
        f = finals.get(m["code"])
        if m.get("result"):
            m["_typed"] = True  # typed in config/schedule.json: the report treats it as closed
        if not m.get("result") and f and len(f.get("pairs") or []) == len(pairs):
            m["result"] = {"pairs": f["pairs"], "players": f.get("players") or {}}
    errs = validate(sched, teams_cfg)
    if errs:
        sys.exit("[ERROR] " + "; ".join(errs))
    st = stats(teams_cfg, resolve_matches(sched, teams_cfg, site["branches"]), site.get("placements", {}))
    heat = {p["id"]: p["heat"] for p in st["players"]}
    teams = {t: {"name": f"Đội {t}", "members": mem} for t, mem in teams_cfg["teams"].items()}
    # sides as team ids ("Thắng T1" → the team that won T1), the same resolution the site uses
    ms = {m["code"]: dict(m, a=r["a"]["team"] or m["a"], b=r["b"]["team"] or m["b"]) for m, r in zip(sched["matches"], resolve_matches(sched, teams_cfg, site["branches"]))}
    P = {f"{t}-{i + 1}": {"id": f"{t}-{i + 1}", "name": n, "team": t, "seed": i + 1, "matches": set(), "pairs": 0, "won": 0, "pf": 0, "pa": 0,
                          "atk": 0, "sup": 0, "run": 0, "log": []} for t, mem in teams_cfg["teams"].items() for i, n in enumerate(mem)}
    for c in codes:
        mm = match_model(ms[c], teams, pairs, data[c].get("pairs") or {}, finals.get(c))
        for p in mm["pairs"]:
            if not p["played"]:
                continue
            for side, o in (("a", "b"), ("b", "a")):
                for i in (0, 1):
                    q = P[f"{ms[c][side]}-{p['side_seeds'][side][i]}"]
                    q["matches"].add(c); q["pairs"] += 1; q["won"] += p["sc"][side] > p["sc"][o]
                    q["log"].append({"c": c, "k": mm["pairs"].index(p) + 1, "mate": given(p["names"][side][1 - i]), "opp": " · ".join(given(x) for x in p["names"][o]),
                                     "s": [p["sc"][side], p["sc"][o]], "atk": p["atk"].get((side, i), 0), "sup": p["sup"].get((side, i), 0), "run": p["run"][side],
                                     "closed": bool(finals.get(c))})
                    q["pf"] += p["sc"][side]; q["pa"] += p["sc"][o]
                    q["atk"] += p["atk"].get((side, i), 0); q["sup"] += p["sup"].get((side, i), 0)
                    q["run"] = max(q["run"], p["run"][side])
    for q in P.values():
        q["n"], q["diff"], q["heat"] = len(q["matches"]), q["pf"] - q["pa"], heat.get(q["id"], 0)
        q["rate"] = round(100 * q["won"] / q["pairs"]) if q["pairs"] else None
        q["eff"] = round(100 * q["atk"] / q["pf"]) if q["pf"] else None
    played = [q for q in P.values() if q["pairs"]]
    asof = max((ms[c]["date"] for c in codes), key=lambda d: d.split("/")[::-1])
    # totals divided by pairs played (owner, 2026-11-11): absent pairs must not decide a title; at least 2 pairs
    per = lambda q, k: q[k] / q["pairs"] if q["pairs"] else 0
    cats = [("Hiệu số mỗi cặp", "diff", lambda q: (per(q, "diff"), q["diff"]), lambda q: f'{per(q, "diff"):+.1f}/cặp', 2),
            ("Tấn công mỗi cặp", "atk", lambda q: (per(q, "atk"), q["atk"]), lambda q: f'{per(q, "atk"):.1f}/cặp', 2),
            ("Hỗ trợ mỗi cặp", "sup", lambda q: (per(q, "sup"), q["sup"]), lambda q: f'{per(q, "sup"):.1f}/cặp', 2),
            ("Hiệu suất ghi điểm", "eff", lambda q: q["eff"] or 0, lambda q: f'{q["eff"]}%', 2),
            ("Tỉ lệ thắng cặp", "rate", lambda q: (q["rate"] or 0, q["diff"]), lambda q: f'{q["rate"]}%', 2),
            ("Thủng lưới ít nhất", "pa", lambda q: -q["pa"] / q["pairs"], lambda q: f'{q["pa"] / q["pairs"]:.1f}/cặp', 2),
            ("Chuỗi điểm dài nhất", "run", lambda q: q["run"], lambda q: f'{q["run"]} điểm', 1),
            ("Nóng nhất (nhiệt độ)", "heat", lambda q: q["heat"], lambda q: f'{q["heat"]:.1f}°', 1)]
    tag = lambda q: f'Đội {q["team"]} · seed {q["seed"]} · {q["n"]} trận · {q["pairs"]} cặp'  # noqa: E731
    cards, gsum = "", []
    for title, key, val, fmt, minp in cats:
        pool = sorted([q for q in played if q["pairs"] >= minp], key=lambda q: (val(q), q["pairs"]), reverse=True)
        if not pool:
            continue
        top, rest = pool[0], pool[1:3]
        tie = [q for q in pool[1:] if val(q) == val(top)]
        gsum.append({"title": title, "value": fmt(top), "id": top["id"], "name": top["name"], "tag": tag(top), "tie": [q["name"] for q in tie],
                     "tie_ids": [q["id"] for q in tie], "rest": [[q["name"], fmt(q), q["id"]] for q in rest], "min": minp})
        cards += (f'<div class="gc"><div class="gt">{e(title)}</div><div class="g1"><span class="crown">GOAT</span><b>{fmt(top)}</b></div>'
                  f'<div class="gn">{e(top["name"])}</div><div class="gs">{e(tag(top))}</div>'
                  + (f'<div class="gtie">Đồng hạng: {e(", ".join(given(q["name"]) for q in tie))}</div>' if tie else '')
                  + "".join(f'<div class="g2"><span>{k + 2}</span><em>{e(q["name"])}</em><b>{fmt(q)}</b></div>' for k, q in enumerate(rest))
                  + (f'<div class="gmin">Tối thiểu {minp} cặp</div>' if minp > 1 else '') + '</div>')
    rows = ""
    for k, q in enumerate(sorted(P.values(), key=lambda q: (q["pairs"] > 0, per(q, "diff"), per(q, "atk")), reverse=True)):
        if not q["pairs"]:
            rows += (f'<tr class="off"><td>{k + 1}</td><td class="nm2">{e(q["name"])}</td><td>Đội {q["team"]}</td><td>{q["seed"]}</td>'
                     f'<td colspan="10">chưa ra sân</td><td>{q["heat"]:.1f}°</td></tr>')
            continue
        rows += (f'<tr><td>{k + 1}</td><td class="nm2">{e(q["name"])}</td><td>Đội {q["team"]}</td><td>{q["seed"]}</td><td>{q["n"]}</td><td>{q["pairs"]}</td>'
                 f'<td>{q["won"]}–{q["pairs"] - q["won"]}</td><td>{q["pf"]}</td><td>{q["pa"]}</td><td class="b">{q["diff"]:+d}</td><td class="b">{q["atk"]}</td><td>{q["sup"]}</td>'
                 f'<td>{"" if q["eff"] is None else str(q["eff"]) + "%"}</td><td>{q["run"] or ""}</td><td>{q["heat"]:.1f}°</td></tr>')
    scope = "mọi cặp đã đấu xong (gồm cả trận chưa chốt)" if not args.closed_only else "các trận đã chốt"
    sub = f'{len(codes)} lượt trận ({", ".join(codes)}) · {sum(q["pairs"] for q in P.values()) // 4} cặp · {len(played)}/30 VĐV đã ra sân · tính {scope}'
    p1 = (f'<section class="page rp">{header(f"BÁO CÁO GOAT · TOÀN GIẢI · TÍNH ĐẾN {e(asof)}", "GOAT các chỉ số", e(sub))}'
          f'<div class="goat">{cards}</div><p class="gnote">Hiệu số = điểm đội ghi − điểm đội thua khi VĐV ra sân · Tấn công = tự ghi điểm · Hỗ trợ = đồng đội ghi · '
          f'Hiệu suất = tấn công / điểm đội ghi · Nhiệt độ theo BXH (trận đã chốt).</p>{FOOTER}</section>')
    p2 = (f'<section class="page rp">{header(f"BÁO CÁO GOAT · TOÀN GIẢI · TÍNH ĐẾN {e(asof)}", "Bảng chỉ số 30 VĐV", "Xếp theo hiệu số mỗi cặp (tổng chia số cặp đã đấu) · VĐV chưa ra sân ở cuối")}'
          f'<table class="gtab"><thead><tr><th>#</th><th>VĐV</th><th>Đội</th><th>Seed</th><th>Trận</th><th>Cặp</th><th>T–B</th><th>Ghi</th><th>Thua</th><th>Hiệu số</th>'
          f'<th>Tấn công</th><th>Hỗ trợ</th><th>Hiệu suất</th><th>Chuỗi</th><th>Nhiệt độ</th></tr></thead><tbody>{rows}</tbody></table>{FOOTER}</section>')
    stem = "Bao_cao_GOAT_" + asof.replace("/", "-")
    pdf, page_html = paths.OUTPUT / f"{stem}.pdf", paths.BUILD / f"{stem}.html"
    print(f"[GOAT] {len(codes)} matches · {len(played)} players with pairs · " + " · ".join(
        f"{t}: {max(played, key=lambda q: (v(q), q['pairs']))['name']}" for t, _, v, _, _ in cats[:3]))
    if args.dry_run:
        print(f"[DRY-RUN] would write {store}/*.json, {page_html} and {pdf}")
        print(f"[OUTPUT] {pdf}")
        return
    store.mkdir(parents=True, exist_ok=True)
    (store / "all.json").write_text(json.dumps(raw_all, ensure_ascii=False), encoding="utf-8")
    for c in codes:
        (store / f"{c}.json").write_text(json.dumps(data[c], ensure_ascii=False), encoding="utf-8")
    paths.BUILD.mkdir(parents=True, exist_ok=True)
    css = [(paths.ASSETS / f).as_uri() for f in ("sheet.css", "report.css")]
    page_html.write_text(f'<!doctype html><html lang="vi"><head><meta charset="utf-8"><title>GOAT {e(asof)}</title>'
                         + "".join(f'<link rel="stylesheet" href="{c}">' for c in css) + '</head><body>' + p1 + p2 + '</body></html>', encoding="utf-8")
    subprocess.run(["node", str(paths.SCRIPTS / "render_pdf.mjs"), str(page_html), str(pdf)], check=True)
    if args.publish:
        import shutil
        shutil.copy2(pdf, paths.DOWNLOADS_IN / pdf.name)
        prof = {q["id"]: {k: q[k] for k in ("n", "pairs", "won", "pf", "pa", "diff", "atk", "sup", "eff", "rate", "run", "log")} for q in P.values()}
        summ = {"asof": asof, "file": pdf.name, "label": f"Báo cáo GOAT · tính đến {asof}", "scope": sub, "cats": gsum, "players": prof}
        (store / "summary.json").write_text(json.dumps(summ, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"[PUBLISH] {paths.DOWNLOADS_IN / pdf.name} · summary {store / 'summary.json'} (copy it into config/reports.json \"goat\")")
    print(f"[OUTPUT] {pdf}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("kind", nargs="?", choices=["day", "goat"], default="day", help="day = one match day (default) · goat = whole tournament")
    ap.add_argument("--closed-only", action="store_true", help="goat: only closed (Chốt) matches")
    ap.add_argument("--matches", nargs="*", default=[])
    ap.add_argument("--offline", action="store_true", help="use cached JSON in output/report/<date>/")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--publish", action="store_true", help="copy the PDF to downloads/ and write the site summary (output/report/<date>/summary.json)")
    args = ap.parse_args()
    if args.kind == "goat":
        return goat_main(args)
    teams_cfg, sched, pairs, codes, date, store, data, raw_all, finals, st = load(args)
    site = read(paths.SITE_JSON)
    teams = {t: {"name": f"Đội {t}", "members": mem} for t, mem in teams_cfg["teams"].items()}
    st["teams_cfg"] = [{"id": t, "name": v["name"]} for t, v in teams.items()]
    # sides as team ids ("Thắng T1" → the team that won T1), the same resolution the site uses
    ms = {m["code"]: dict(m, a=r["a"]["team"] or m["a"], b=r["b"]["team"] or m["b"]) for m, r in zip(sched["matches"], resolve_matches(sched, teams_cfg, site["branches"]))}
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
    if args.publish:
        import shutil
        shutil.copy2(pdf, paths.DOWNLOADS_IN / pdf.name)
        summ = summary(models, date, day, pdf.name)
        (store / "summary.json").write_text(json.dumps(summ, ensure_ascii=False, indent=1), encoding="utf-8")
        print(f"[PUBLISH] {paths.DOWNLOADS_IN / pdf.name} · summary {store / 'summary.json'} (copy it into config/reports.json)")
    print(f"[OUTPUT] {pdf}")


def summary(models, date, day, file):
    """Hero-slide summary for config/reports.json: results line, 4 numbers, link to the PDF."""
    def res(mm):
        a, b = mm["A"]["name"], mm["B"]["name"]
        if mm["final"]:
            w, l, tw, tl, pw, pl = (a, b, mm["ta"], mm["tb"], mm["pa"], mm["pb"]) if mm["ta"] > mm["tb"] or (mm["ta"] == mm["tb"] and mm["pa"] > mm["pb"]) \
                else (b, a, mm["tb"], mm["ta"], mm["pb"], mm["pa"])
            return f"{w} thắng {l} {tw}–{tl}", {"v": f"{tw}–{tl}", "k": f"{mm['m']['code']} · {w} thắng {pw}–{pl} cặp"}
        lead = a if mm["ta"] >= mm["tb"] else b
        left = 5 - mm["played"]
        return (f"{lead} dẫn {max(mm['ta'], mm['tb'])}–{min(mm['ta'], mm['tb'])}, còn {left} cặp đánh sau",
                {"v": f"{max(mm['ta'], mm['tb'])}–{min(mm['ta'], mm['tb'])}", "k": f"{mm['m']['code']} · {lead} dẫn, chờ {left} cặp"})
    lines, tiles = zip(*(res(mm) for mm in models))
    pick = {t: (d, v) for t, d, v in HL}
    tiles = list(tiles)[:2] + [{"v": pick["Chuỗi điểm dài nhất"][1], "k": "Chuỗi dài nhất · " + pick["Chuỗi điểm dài nhất"][0].split(" · ")[-1]},
                               {"v": pick["Sát nút nhất"][1], "k": "Sát nút nhất · " + pick["Sát nút nhất"][0]}]
    finals = [mm for mm in models if mm["final"]]
    return {"date": date, "day": day, "file": file, "label": f"Báo cáo ngày {day} · {date}",
            "eyebrow": f"Báo cáo ngày {day} · Thứ 4 · {date}",
            "title": (res(finals[0])[0].split(" thắng ")[0] + " thắng " + (f"trắng {finals[0]['pb'] if finals[0]['tb'] > finals[0]['ta'] else finals[0]['pa']}–0" if 0 in (finals[0]['pa'], finals[0]['pb']) else res(finals[0])[1]["v"])) if finals else f"Ngày {day}: {len(models)} lượt trận",
            "sub": " · ".join(f"{mm['m']['code']}: {line}" for mm, line in zip(models, lines)) + ".",
            "stats": tiles}


if __name__ == "__main__":
    main()
