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


def validate(sched, teams_cfg):
    """Return a list of readable errors; empty list = schedule is consistent."""
    errors = []
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
                errors.append(f"{code}.result: phải có dạng {{\"a\": 105, \"b\": 98, \"pa\": 3, \"pb\": 2}}")
            else:
                for f in ("a", "b", "pa", "pb"):
                    if f not in r:
                        errors.append(f"{code}.result.{f}: thiếu")
                    else:
                        r[f] = _int(r[f], f"{code}.result.{f}", errors)
                if all(isinstance(r.get(f), int) for f in ("pa", "pb")) and r["pa"] + r["pb"] != n_pairs:
                    errors.append(f"{code}.result: pa + pb = {r['pa'] + r['pb']}, phải bằng {n_pairs} cặp")
                if all(isinstance(r.get(f), int) for f in ("a", "b", "pa", "pb")) and r["a"] == r["b"] and r["pa"] == r["pb"]:
                    errors.append(f"{code}.result: hòa cả tổng điểm lẫn số cặp thắng, chưa phân định được")
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
            res = {"a": res["a"], "b": res["b"], "pa": res["pa"], "pb": res["pb"]}
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
