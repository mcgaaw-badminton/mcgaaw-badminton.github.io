"""Build the tournament website from config/ + slides/ + gallery/ + downloads/.

Usage (from the workspace root):
    python scripts/build_site.py              # -> output/site/ (open output/site/index.html, or upload the folder)
    python scripts/build_site.py --preview    # also output/site_preview.html (single file, no photos) for the online preview
    python scripts/build_site.py --dry-run    # show what would be built, write nothing

Photos: put slide photos in slides/, gallery photos in gallery/<album>/ (one sub-folder per album), then rebuild.
Pillow (pip install pillow) is optional: with it, photos are resized and thumbnails made; without it they are copied as-is.
"""
import argparse
import base64
import datetime as dt
import json
import re
import hashlib
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from _lib import paths  # noqa: E402
from _lib.tournament import validate, resolve_matches, result_without_teams, stats  # noqa: E402

try:
    from PIL import Image, ImageOps
except ImportError:  # optional
    Image = None

IMG_EXT = {".jpg", ".jpeg", ".png", ".webp"}
FULL_MAX, THUMB_MAX = 2400, 900
FONT_SUBSETS = [
    ("vietnamese", "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,"
                   "U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB"),
    ("latin", "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,"
              "U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD"),
]
FONT_FILES = [("400", "normal"), ("700", "normal"), ("800", "normal"), ("800", "italic")]
GOOGLE_FONTS = "https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:ital,wght@0,400;0,600;0,700;0,800;1,800&display=swap"


def read_json(p):
    return json.loads(p.read_text(encoding="utf-8"))


def images_in(folder):
    if not folder.exists():
        return []
    return sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in IMG_EXT)


def put_image(src, dst_full, dst_thumb, dry):
    """Copy (or resize) one photo; return (w, h) when known."""
    if dry:
        return None, None
    dst_full.parent.mkdir(parents=True, exist_ok=True)
    if Image is None:
        shutil.copy2(src, dst_full)
        return None, None
    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im).convert("RGB")
        full = im.copy()
        full.thumbnail((FULL_MAX, FULL_MAX))
        full.save(dst_full, "JPEG", quality=86, optimize=True, progressive=True)
        if dst_thumb is not None:
            dst_thumb.parent.mkdir(parents=True, exist_ok=True)
            th = im.copy()
            th.thumbnail((THUMB_MAX, THUMB_MAX * 2))
            th.save(dst_thumb, "JPEG", quality=80, optimize=True, progressive=True)
            return th.width, th.height
        return full.width, full.height


def pretty_album(name):
    return re.sub(r"[-_]+", " ", re.sub(r"^\d+[-_ ]*", "", name)).strip() or name


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--preview", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    a = ap.parse_args()
    dry = a.dry_run

    teams_cfg, sched, site = read_json(paths.TEAMS_JSON), read_json(paths.SCHEDULE_JSON), read_json(paths.SITE_JSON)
    errors = validate(sched, teams_cfg)
    matches = [] if errors else resolve_matches(sched, teams_cfg, site["branches"])
    errors += [f"{c}.result: đã nhập kết quả nhưng chưa biết đủ 2 đội (nhập kết quả trận trước nó trước)"
               for c in result_without_teams(matches)]
    if errors:
        print(f"[ERROR] config/schedule.json có {len(errors)} lỗi, không build (website giữ bản cũ):")
        for e in errors:
            print("  - " + e)
        sys.exit(1)
    out = paths.SITE_OUT
    if not dry and out.exists():
        shutil.rmtree(out)  # generated folder, rebuilt every time

    teams = [{"id": k, "name": f"Đội {k}", "members": v} for k, v in teams_cfg["teams"].items()]

    # slides
    named = {s.get("image") for s in site["slides"] if s.get("image")}
    slides = []
    for s in site["slides"]:
        src = None
        if s.get("image"):
            f = paths.SLIDES_IN / s["image"]
            if f.exists():
                put_image(f, out / "slides" / (f.stem + ".jpg"), None, dry)
                src = f"slides/{f.stem}.jpg"
            else:
                print(f"[WARN] slide image not found: {f}")
        slides.append({"src": src, "eyebrow": s.get("eyebrow", ""), "title": s.get("title", ""),
                       "sub": s.get("sub", ""), "cta": s.get("cta")})
    for f in images_in(paths.SLIDES_IN):
        if f.name not in named:
            put_image(f, out / "slides" / (f.stem + ".jpg"), None, dry)
            slides.append({"src": f"slides/{f.stem}.jpg", "eyebrow": "", "title": "", "sub": "", "cta": None})

    # gallery: gallery/<album>/*.jpg ; loose files -> album "Khác"
    gallery = []
    folders = [d for d in sorted(paths.GALLERY_IN.iterdir()) if d.is_dir() and not d.name.startswith(("_", "."))] \
        if paths.GALLERY_IN.exists() else []
    groups = [(d.name, pretty_album(d.name), d) for d in folders] + [("khac", "Khác", paths.GALLERY_IN)]
    n_photos = 0
    for key, title, d in groups:
        caps = read_json(d / "captions.json") if (d / "captions.json").exists() else {}
        title = caps.get("_title", title)  # optional album title with Vietnamese marks
        items = []
        for f in images_in(d):
            rel = f"{key}/{f.stem}.jpg"
            w, h = put_image(f, out / "gallery" / rel, out / "gallery" / "_thumbs" / rel, dry)
            thumb = f"gallery/_thumbs/{rel}" if Image is not None else None
            items.append({"src": f"gallery/{rel}", "thumb": thumb, "w": w, "h": h, "caption": caps.get(f.name, "")})
        n_photos += len(items)
        if items:
            gallery.append({"album": key, "title": title, "items": items})

    # documents: downloads/* only (copy a match-sheet PDF there to publish it)
    docs = []
    doc_files = [p for p in sorted(paths.DOWNLOADS_IN.glob("*")) if p.is_file() and p.name != "README.md"] \
        if paths.DOWNLOADS_IN.exists() else []
    for f in doc_files:
        if not dry:
            (out / "docs").mkdir(parents=True, exist_ok=True)
            shutil.copy2(f, out / "docs" / f.name)
        docs.append({"label": re.sub(r"[_]+", " ", f.stem), "href": f"docs/{f.name}"})

    dates = [m["date"] for m in matches]
    commit = (os.environ.get("GITHUB_SHA") or git_head())[:7] or "local"
    build_id = f"{BUILT:%Y%m%d%H%M%S}-{commit}"
    data = {
        "meta": {"title": site["title"], "matchTime": site.get("match_time", ""), "venue": site.get("venue", ""),
                 "updated": BUILT.strftime("%d/%m/%Y %H:%M"), "firstDate": dates[0][:5], "lastDate": dates[-1]},
        "rules": sched["rules"], "pairs": teams_cfg["pairs"], "teams": teams, "champions": teams_cfg.get("past_champions", []), "matches": matches,
        "bracket": site["bracket"], "slides": slides, "gallery": gallery, "docs": docs,
        "stats": stats(teams_cfg, matches, site.get("placements", {})),
    }
    data["meta"]["build"] = {"id": build_id, "version": site.get("version", "1.0.0"), "commit": commit,
                             "builtAt": BUILT.isoformat(timespec="seconds"),
                             "dataHash": hashlib.sha1(json.dumps([matches, teams], ensure_ascii=False).encode()).hexdigest()[:8]}
    print(f"[SITE] {len(matches)} matches ({data['stats']['played']} played) · {len(slides)} slides · {n_photos} photos in {len(gallery)} albums · {len(docs)} documents"
          + ("" if Image else " · Pillow not installed: photos copied without resizing"))
    if dry:
        print(f"[DRY-RUN] would write {out}")
        print(f"[OUTPUT] {out / 'index.html'}")
        return

    body = (paths.WEB / "body.html").read_text(encoding="utf-8")
    for key, f in (("{{SHUTTLE}}", "shuttle.svg"), ("{{RACKET}}", "racket.svg")):
        svg = (paths.ASSETS / f).read_text(encoding="utf-8")
        body = body.replace(key, svg[svg.index(">") + 1: svg.rindex("</svg>")])
    css = (paths.WEB / "site.css").read_text(encoding="utf-8")
    js = (paths.WEB / "site.js").read_text(encoding="utf-8")
    data_js = "window.SITE = " + json.dumps(data, ensure_ascii=False) + ";\n"

    (out / "assets" / "fonts").mkdir(parents=True, exist_ok=True)
    faces = []
    for sub, rng in FONT_SUBSETS:
        for w, st in FONT_FILES:
            fn = f"be-vietnam-pro-{sub}-{w}-{st}.woff2"
            shutil.copy2(paths.FONTS / fn, out / "assets" / "fonts" / fn)
            faces.append(f"@font-face{{font-family:'Be Vietnam Pro';font-style:{st};font-weight:{w};font-display:swap;"
                         f"src:url(fonts/{fn}) format('woff2');unicode-range:{rng}}}")
    (out / "assets" / "fonts.css").write_text("\n".join(faces) + "\n", encoding="utf-8")
    shutil.copy2(paths.LOGO, out / "assets" / "logo.png")
    (out / "assets" / "site.css").write_text(css, encoding="utf-8")
    (out / "assets" / "site.js").write_text(js, encoding="utf-8")
    (out / "data.js").write_text(data_js, encoding="utf-8")
    (out / "version.json").write_text(json.dumps(data["meta"]["build"], ensure_ascii=False) + "\n", encoding="utf-8")
    (out / ".nojekyll").write_text("", encoding="utf-8")
    v = build_id
    page = ('<!doctype html>\n<html lang="vi">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            '<meta http-equiv="Cache-Control" content="no-cache">\n'
            f'<title>{site["title"]}</title>\n<meta name="description" content="Lịch thi đấu, sơ đồ, các đội và thư viện ảnh.">\n'
            '<link rel="icon" href="assets/logo.png">\n<link rel="stylesheet" href="assets/fonts.css">\n'
            f'<link rel="stylesheet" href="assets/site.css?v={v}">\n</head>\n<body>\n'
            + body.replace("{{LOGO}}", "assets/logo.png")
            + '\n<script src="data.js?v=' + v + '"></script>\n<script src="assets/site.js?v=' + v + '"></script>\n</body>\n</html>\n')
    (out / "index.html").write_text(page, encoding="utf-8")

    if a.preview:
        logo = "data:image/png;base64," + base64.b64encode(paths.LOGO.read_bytes()).decode()
        pdata = dict(data, gallery=[], docs=[{"label": d["label"], "href": None} for d in docs],
                     slides=[dict(s, src=None) for s in slides if s["title"]])
        prev = (f'<title>{site["title"]}</title>\n<meta name="claude:viewport-fit-sides" content="cover">\n'
                f'<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="stylesheet" href="{GOOGLE_FONTS}">\n'
                f"<style>\n{css}</style>\n" + body.replace("{{LOGO}}", logo)
                + "\n<script>window.SITE = " + json.dumps(pdata, ensure_ascii=False) + ";</script>\n<script>\n" + js + "</script>\n")
        paths.SITE_PREVIEW.write_text(prev, encoding="utf-8")
        print(f"[PREVIEW] {paths.SITE_PREVIEW}")
    print(f"[OUTPUT] {out / 'index.html'}")


def git_head():
    try:
        return subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=paths.ROOT, text=True, stderr=subprocess.DEVNULL).strip()
    except Exception:
        return ""


try:
    from zoneinfo import ZoneInfo
    BUILT = dt.datetime.now(ZoneInfo("Asia/Ho_Chi_Minh")).replace(microsecond=0)
except Exception:  # Windows without tzdata: fixed UTC+7
    BUILT = dt.datetime.now(dt.timezone(dt.timedelta(hours=7))).replace(microsecond=0)

if __name__ == "__main__":
    main()
