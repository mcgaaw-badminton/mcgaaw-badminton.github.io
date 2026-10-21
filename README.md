# MCGAAW Badminton Cup 2026

Website giải cầu lông đồng đội MCGAAW: lịch thi đấu, sơ đồ loại kép, các đội, thể lệ, thư viện ảnh.
Mỗi lần có commit lên nhánh `main`, GitHub Actions tự build và đăng lại website (khoảng 1–2 phút). Người xem chỉ cần F5; nếu đang mở trang, web tự hiện thông báo "Đã có cập nhật mới".

## Cập nhật kết quả trận (làm được ngay trên GitHub, kể cả điện thoại)
1. Mở `config/schedule.json` → bấm biểu tượng bút (Edit).
2. Ở trận vừa đấu, thêm dòng `"result"` sau `"b": ...`, ví dụ trận T1:
   ```json
   {"code": "T1", "round": "Vòng 1", "day": 1, "date": "04/11/2026", "a": "1", "b": "2", "result": {"a": 105, "b": 98, "pa": 3, "pb": 2}},
   ```
   `a`/`b` = tổng điểm 5 cặp của đội bên trái / phải · `pa`/`pb` = số cặp thắng.
3. Commit changes → chờ tab Actions báo xanh → F5 website. Nếu Actions báo đỏ, mở log: dòng `[ERROR]` chỉ đúng ô nhập sai (điểm không phải số, pa + pb ≠ 5, nhập kết quả khi chưa biết đủ 2 đội…); website giữ nguyên bản cũ cho tới khi sửa xong. Đội thắng/thua tự điền vào các trận sau, sơ đồ, trạng thái đội và tiến độ giải tự đổi.

## Phát hành giao diện mới
Sửa trong `web/` hoặc `config/site.json`, tăng `"version"` trong `config/site.json` (vd 1.0.0 → 1.1.0), commit. Chân trang hiện phiên bản, mã commit và giờ phát hành.

## Thêm ảnh
- Thư viện: `gallery/<số>-<Tên album>/*.jpg` (vd `gallery/01-Khai mạc/`), chú thích tuỳ chọn trong `captions.json`.
- Slider: `slides/*.jpg`. Tài liệu tải về: `downloads/*.pdf`.

## Chạy trên máy
`python scripts/build_site.py` → mở `output/site/index.html`. Quy tắc chi tiết: `BASEMENT.md`.
