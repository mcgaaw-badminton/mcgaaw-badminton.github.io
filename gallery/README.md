# gallery — photo albums
One sub-folder per album, e.g. `01-khai-mac/`, `02-ngay-2/` (the number sets the order and is hidden; dashes become spaces).
Optional `captions.json` in an album: `{"_title": "Tên album có dấu", "IMG_0012.jpg": "Cặp 1–2 của Đội 3"}` (`_title` overrides the folder name).
Then run `python scripts/build_site.py`. With Pillow installed, photos are resized and thumbnails made.
