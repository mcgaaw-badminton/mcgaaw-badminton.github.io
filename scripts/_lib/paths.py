"""Single source of paths for this workspace. Scripts import from here; never compute parent.parent themselves."""
from pathlib import Path


def _find_root(start: Path) -> Path:
    for p in [start, *start.parents]:
        if (p / ".workspace-root").exists():
            return p
    raise SystemExit("[ERROR] .workspace-root not found above " + str(start))


ROOT = _find_root(Path(__file__).resolve())
CONFIG = ROOT / "config"
ASSETS = ROOT / "assets"
FONTS = ASSETS / "fonts"
OUTPUT = ROOT / "output"
BUILD = OUTPUT / "_build"
SCRIPTS = ROOT / "scripts"

WEB = ROOT / "web"                 # website source (body.html · site.css · site.js)
SLIDES_IN = ROOT / "slides"        # input: hero slide photos
GALLERY_IN = ROOT / "gallery"      # input: one sub-folder per album
DOWNLOADS_IN = ROOT / "downloads"  # input: files offered on the site (posters…)
SITE_OUT = OUTPUT / "site"         # generated website (deleted and rebuilt each run)
SITE_PREVIEW = OUTPUT / "site_preview.html"

SITE_JSON = CONFIG / "site.json"
TEAMS_JSON = CONFIG / "teams.json"
SCHEDULE_JSON = CONFIG / "schedule.json"
LOGO = ASSETS / "logo_mcgaaw.png"
