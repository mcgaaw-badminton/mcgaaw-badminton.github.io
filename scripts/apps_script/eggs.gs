/* MCGAAW Badminton Cup — rotten-egg counter (Google Sheet + Apps Script web app).
   GET  -> {"<team>-<seed>": eggs, ...}
   POST (text/plain JSON {"3-1": 4, ...}) -> adds 1..200 per player under a lock, returns the new totals. */
const SHEET_ID = '1ZCP48Eg-2kJ7nFiIXaM3zs3qEJOx4fX7cwtOf35e1mI';
const PLAYERS = [["1-1", "Đội 1", "Nguyễn Viết Tri"], ["1-2", "Đội 1", "Nguyễn Duy Hiệu"], ["1-3", "Đội 1", "Nguyễn Thanh Thiên Minh"], ["1-4", "Đội 1", "Nguyễn Thanh Tiễn"], ["1-5", "Đội 1", "Nguyễn Thị Hồng Vấn"], ["2-1", "Đội 2", "Đoàn Anh Kiệt"], ["2-2", "Đội 2", "Trần Võ Toàn Phát"], ["2-3", "Đội 2", "Lữ Thị Trang"], ["2-4", "Đội 2", "Nguyễn Ngọc Bảo Kha"], ["2-5", "Đội 2", "Nguyễn Thị Diệp Sương"], ["3-1", "Đội 3", "Nguyễn Chí Toàn"], ["3-2", "Đội 3", "Nguyễn Đức Nhuận"], ["3-3", "Đội 3", "Huỳnh Hữu Tín"], ["3-4", "Đội 3", "Trần Thiện Sáng"], ["3-5", "Đội 3", "Tô Vy Quân"], ["4-1", "Đội 4", "Phạm Công Quân"], ["4-2", "Đội 4", "Phạm Quốc Nhật"], ["4-3", "Đội 4", "Nguyễn Văn Anh Tiến"], ["4-4", "Đội 4", "Nguyễn Văn Hùng"], ["4-5", "Đội 4", "Đỗ Sơn Tây"], ["5-1", "Đội 5", "Trương Lam"], ["5-2", "Đội 5", "Nguyễn Thái Thịnh"], ["5-3", "Đội 5", "Lê Đình Nhật Khang"], ["5-4", "Đội 5", "Lê Hữu Thái"], ["5-5", "Đội 5", "Huỳnh Thị Hồng Chi"], ["6-1", "Đội 6", "Lê Nguyễn Trung Vĩnh"], ["6-2", "Đội 6", "Huỳnh Lê Anh Vũ"], ["6-3", "Đội 6", "Huỳnh Võ Minh Tân"], ["6-4", "Đội 6", "Lê Quốc Tuấn"], ["6-5", "Đội 6", "Nguyễn Thị Như Thùy"]];

function sheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName('eggs');
  if (!sh) {
    sh = ss.insertSheet('eggs', 0);
    sh.getRange(1, 1, 1, 4).setValues([['id', 'Đội', 'VĐV', 'Trứng thối']]).setFontWeight('bold');
    sh.getRange(2, 1, PLAYERS.length, 4).setValues(PLAYERS.map(p => [p[0], p[1], p[2], 0]));
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 4);
  }
  return sh;
}
function totals_(rows) { const o = {}; rows.forEach(r => { o[r[0]] = Number(r[3]) || 0; }); return o; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function doGet() {
  const cache = CacheService.getScriptCache(), hit = cache.get('eggs');
  if (hit) return json_(JSON.parse(hit));
  const sh = sheet_(), o = totals_(sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues());
  cache.put('eggs', JSON.stringify(o), 5);
  return json_(o);
}

function doPost(e) {
  let add = {};
  try { add = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: 'bad json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheet_(), rg = sh.getRange(2, 1, sh.getLastRow() - 1, 4), rows = rg.getValues();
    rows.forEach(r => { const n = Math.floor(Number(add[r[0]])); if (n > 0 && n <= 200) r[3] = (Number(r[3]) || 0) + n; });
    sh.getRange(2, 4, rows.length, 1).setValues(rows.map(r => [r[3]]));
    const o = totals_(rows);
    CacheService.getScriptCache().put('eggs', JSON.stringify(o), 5);
    return json_(o);
  } finally { lock.releaseLock(); }
}

function setup() { sheet_(); SpreadsheetApp.openById(SHEET_ID).rename('MCGAAW Cup — Trứng thối'); }
