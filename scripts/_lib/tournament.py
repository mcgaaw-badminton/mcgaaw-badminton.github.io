"""Shared tournament logic: validate config/schedule.json and resolve 'Thắng/Thua Tx' labels from results.
Used by build_site.py and build_sheets.py so the website and the match sheets always agree."""
import re

LABEL = re.compile(r"^(Thắng|Thua) (T\d+)$")


def _int(v, where, errors):
    """Accept ints and digit strings ("98"); anything else is an error. Returns int or None."""
    if isinstance(v, bool):
        errors.append(f"{where} = {v!r}: phải là số")
        return None
    if isinstance(v, int):
        n = v
    elif isinstance(v, str) and v.strip().isdigit():
        n = int(v.strip())
    else:
        errors.append(f"{where} = {v!r}: phải là số nguyên")
        return None
    if n < 0:
        errors.append(f"{where} = {n}: không được âm")
        return None
    return n


def _check_result(code, r, n_pairs, errors):
    """Validate one result in place. With "pairs" (score of every pair, in pair order) the totals are derived;
    totals typed as well must agree. Without "pairs", a/b/pa/pb are required (no player stats for that match)."""
    if "pairs" in r:
        ps = r["pairs"]
        if not isinstance(ps, list) or len(ps) != n_pairs:
            errors.append(f"{code}.result.pairs: cần đúng {n_pairs} cặp, mỗi cặp dạng [điểm đội trái, điểm đội phải]")
            return
        clean = []
        for i, pr in enumerate(ps, 1):
            if not isinstance(pr, (list, tuple)) or len(pr) != 2:
                errors.append(f"{code}.result.pairs[{i}] = {pr!r}: phải là [điểm trái, điểm phải]")
                return
            x = _int(pr[0], f"{code}.result.pairs[{i}][1]", errors)
            y = _int(pr[1], f"{code}.result.pairs[{i}][2]", errors)
            if x is None or y is None:
                return
            if x == y:
                errors.append(f"{code}.result.pairs[{i}] = {x}-{y}: một cặp không thể hòa")
                return
            clean.append([x, y])
        derived = {"a": sum(p[0] for p in clean), "b": sum(p[1] for p in clean),
                   "pa": sum(p[0] > p[1] for p in clean), "pb": sum(p[1] > p[0] for p in clean)}
        for f, v in derived.items():
            if f in r and _int(r[f], f"{code}.result.{f}", errors) not in (None, v):
                errors.append(f"{code}.result.{f} = {r[f]} nhưng cộng từ pairs ra {v}")
        r.update(derived)
        r["pairs"] = clean
    else:
        for f in ("a", "b", "pa", "pb"):
            if f not in r:
                errors.append(f"{code}.result.{f}: thiếu (hoặc nhập \"pairs\" để tự tính)")
            else:
                r[f] = _int(r[f], f"{code}.result.{f}", errors)
    if all(isinstance(r.get(f), int) for f in ("pa", "pb")) and r["pa"] + r["pb"] != n_pairs:
        errors.append(f"{code}.result: pa + pb = {r['pa'] + r['pb']}, phải bằng {n_pairs} cặp")
    if all(isinstance(r.get(f), int) for f in ("a", "b", "pa", "pb")) and r["a"] == r["b"] and r["pa"] == r["pb"]:
        errors.append(f"{code}.result: hòa cả tổng điểm lẫn số cặp thắng, chưa phân định được")


def validate_teams(teams_cfg):
    """Rosters, pairs and sub seeds must be consistent."""
    errors = []
    teams = teams_cfg["teams"]
    n_seed = len(next(iter(teams.values())))
    for t, members in teams.items():
        if len(members) != n_seed:
            errors.append(f"teams.{t}: có {len(members)} VĐV, các đội khác có {n_seed}")
    for i, (x, y) in enumerate(teams_cfg["pairs"], 1):
        if not (1 <= x <= n_seed and 1 <= y <= n_seed) or x == y:
            errors.append(f"pairs[{i}] = {[x, y]}: seed không hợp lệ")
    names = {n for m in teams.values() for n in m}
    for n in teams_cfg.get("past_champions", []):
        if n not in names:
            errors.append(f"past_champions: \"{n}\" không có trong danh sách đội")
    subs = teams_cfg.get("sub_seeds")
    if subs is not None:
        for t in teams:
            if len(subs.get(t, [])) != n_seed:
                errors.append(f"sub_seeds.{t}: cần {n_seed} số")
        if not errors:
            for s in range(n_seed):
                col = sorted(subs[t][s] for t in teams)
                if col != list(range(1, len(teams) + 1)):
                    errors.append(f"sub_seeds: main seed {s + 1} có sub seed {col}, phải là 1..{len(teams)} mỗi số một lần")
    return errors


def validate(sched, teams_cfg):
    """Return a list of readable errors; empty list = schedule is consistent."""
    errors = validate_teams(teams_cfg)
    team_ids = set(teams_cfg["teams"])
    n_pairs = len(teams_cfg["pairs"])
    seen = []
    for idx, m in enumerate(sched["matches"]):
        code = m.get("code", f"#{idx + 1}")
        for k in ("a", "b"):
            v = str(m.get(k, ""))
            mo = LABEL.match(v)
            if v in team_ids:
                continue
            if not mo:
                errors.append(f"{code}.{k} = {v!r}: phải là số đội ({', '.join(sorted(team_ids))}) hoặc 'Thắng T<n>' / 'Thua T<n>'")
            elif mo.group(2) not in seen:
                errors.append(f"{code}.{k} = {v!r}: {mo.group(2)} không phải trận đứng trước {code}")
        r = m.get("result")
        if r is not None:
            if not isinstance(r, dict):
                errors.append(f"{code}.result: phải có dạng {{\"pairs\": [[21, 18], ...]}} hoặc {{\"a\": 105, \"b\": 98, \"pa\": 3, \"pb\": 2}}")
            else:
                _check_result(code, r, n_pairs, errors)
        seen.append(code)
    return errors


def resolve_matches(sched, teams_cfg, branches):
    """Matches in order with sides resolved to team ids where results allow; adds winner, winTo, loseTo, branch."""
    team_ids = set(teams_cfg["teams"])
    branch = {c: b for b, codes in branches.items() for c in codes}

    def winner(r):
        if not r:
            return None
        if r["a"] != r["b"]:
            return "a" if r["a"] > r["b"] else "b"
        if r["pa"] != r["pb"]:
            return "a" if r["pa"] > r["pb"] else "b"
        return None

    out, by = [], {}
    for m in sched["matches"]:
        sides = {}
        for k in ("a", "b"):
            v = str(m[k])
            team, mo = None, LABEL.match(v)
            if mo and mo.group(2) in by:
                src = by[mo.group(2)]
                if src["winner"]:
                    pick = src["winner"] if mo.group(1) == "Thắng" else ("b" if src["winner"] == "a" else "a")
                    team = src[pick]["team"]
            elif v in team_ids:
                team = v
            sides[k] = {"label": v, "team": team}
        res = m.get("result")
        if res:
            res = {"a": res["a"], "b": res["b"], "pa": res["pa"], "pb": res["pb"], "pairs": res.get("pairs")}
        dd, mm, yy = m["date"].split("/")
        o = {"code": m["code"], "round": m["round"], "day": m["day"], "date": m["date"], "iso": f"{yy}-{mm}-{dd}",
             "branch": branch.get(m["code"], "win"), "a": sides["a"], "b": sides["b"], "result": res,
             "winner": winner(res) if sides["a"]["team"] and sides["b"]["team"] else None}
        out.append(o)
        by[o["code"]] = o
    for o in out:
        o["winTo"] = next((x["code"] for x in out for k in "ab" if x[k]["label"] == f"Thắng {o['code']}"), None)
        o["loseTo"] = next((x["code"] for x in out for k in "ab" if x[k]["label"] == f"Thua {o['code']}"), None)
    return out


def result_without_teams(matches):
    """Codes that have a result while a side is still unknown (result entered too early)."""
    return [m["code"] for m in matches if m["result"] and not (m["a"]["team"] and m["b"]["team"])]


# ---------------------------------------------------------------- standings & stats (website "BXH")
def _female(name):
    return "Thị" in name.split()


def _heat(prior, n, won, diff):
    """Player heat in degrees: 20° (cold) .. 45° (on fire). Prior from seeds counts as 2 pairs, then real pairs take over."""
    if n:
        perf = .6 * (won / n) + .4 * min(1, max(0, .5 + diff / n / 20))
        h = (perf * n + prior * 2) / (n + 2)
    else:
        h = prior
    return round(20 + h * 25, 1)


def stats(teams_cfg, matches, placements):
    """Team table, match highlights and player table from resolved matches (played = result + both teams known)."""
    teams = teams_cfg["teams"]
    pairs = teams_cfg["pairs"]
    subs = teams_cfg.get("sub_seeds") or {t: [1] * len(m) for t, m in teams.items()}
    n_teams = len(teams)
    played = [m for m in matches if m["result"] and m["winner"]]

    # players
    P = {}
    n_all = sum(len(v) for v in teams.values())
    for t, members in teams.items():
        for i, name in enumerate(members):
            rank = i * n_teams + subs[t][i]  # 1 = strongest overall by seed
            P[f"{t}-{i + 1}"] = {"id": f"{t}-{i + 1}", "name": name, "team": t, "seed": i + 1, "female": _female(name),
                                 "prior": 1 - (rank - 1) / max(1, n_all - 1),
                                 "n": 0, "won": 0, "pf": 0, "pa": 0, "log": []}
    for m in played:
        ps = m["result"].get("pairs")
        if not ps:
            continue
        for k, (x, y) in enumerate(pairs):
            sa, sb = ps[k]
            for side, mine, theirs in (("a", sa, sb), ("b", sb, sa)):
                for seed in (x, y):
                    p = P[f"{m[side]['team']}-{seed}"]
                    p["n"] += 1; p["won"] += mine > theirs; p["pf"] += mine; p["pa"] += theirs
                    p["log"].append((m["code"], mine > theirs, mine - theirs))
    players = []
    for p in P.values():
        diff = p["pf"] - p["pa"]
        heat = _heat(p["prior"], p["n"], p["won"], diff)
        last = [e for e in p["log"] if e[0] == (p["log"][-1][0] if p["log"] else None)]
        before = [e for e in p["log"] if e not in last]
        prev = _heat(p["prior"], len(before), sum(e[1] for e in before), sum(e[2] for e in before)) if last else heat
        players.append({"id": p["id"], "name": p["name"], "team": p["team"], "seed": p["seed"], "female": p["female"],
                        "played": p["n"], "won": p["won"], "lost": p["n"] - p["won"], "pf": p["pf"], "pa": p["pa"], "diff": diff,
                        "rate": round(100 * p["won"] / p["n"]) if p["n"] else None,
                        "heat": heat, "trend": round(heat - prev, 1),
                        "form": [1 if e[1] else 0 for e in p["log"][-4:]]})

    # teams
    T = {t: {"team": t, "played": 0, "w": 0, "l": 0, "pw": 0, "pl": 0, "pf": 0, "pa": 0, "form": [], "place": None} for t in teams}
    for m in played:
        r = m["result"]
        for side, o in (("a", "b"), ("b", "a")):
            row = T[m[side]["team"]]
            row["played"] += 1
            win = m["winner"] == side
            row["w" if win else "l"] += 1
            row["pw"] += r["p" + side]; row["pl"] += r["p" + o]
            row["pf"] += r[side]; row["pa"] += r[o]
            row["form"].append({"code": m["code"], "win": win})
        loser = m["b" if m["winner"] == "a" else "a"]["team"]
        if m["code"] in placements:
            T[loser]["place"] = placements[m["code"]]
            if placements[m["code"]] == 2:
                T[m[m["winner"]]["team"]]["place"] = 1
    for row in T.values():
        row["status"] = ("champ" if row["place"] == 1 else "runner" if row["place"] == 2 else
                         "out" if row["place"] else "lose" if row["l"] else "win")
        row["form"] = row["form"][-5:]

    def key(r):
        if r["place"] in (1, 2):
            return (0, r["place"], 0, 0, 0, 0, int(r["team"]))
        if r["place"]:
            return (2, r["place"], 0, 0, 0, 0, int(r["team"]))
        return (1, 0, -r["w"], r["l"], -(r["pw"] - r["pl"]), -(r["pf"] - r["pa"]), int(r["team"]))
    table = sorted(T.values(), key=key)
    for i, r in enumerate(table, 1):
        r["pos"] = i

    # match highlights
    hl = {}
    if played:
        big = max(played, key=lambda m: abs(m["result"]["a"] - m["result"]["b"]))
        close = min(played, key=lambda m: (abs(m["result"]["a"] - m["result"]["b"]), abs(m["result"]["pa"] - m["result"]["pb"])))
        hl["biggest"] = {"code": big["code"], "margin": abs(big["result"]["a"] - big["result"]["b"])}
        hl["closest"] = {"code": close["code"], "margin": abs(close["result"]["a"] - close["result"]["b"])}
        best = None
        for m in played:
            for k, sc in enumerate(m["result"].get("pairs") or []):
                tot = sc[0] + sc[1]
                if best is None or tot > best["total"]:
                    best = {"code": m["code"], "pair": k, "total": tot, "score": sc}
        if best:
            hl["longestPair"] = best
    return {"teams": table, "players": players, "highlights": hl, "played": len(played)}
