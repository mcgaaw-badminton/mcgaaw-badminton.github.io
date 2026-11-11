/* MCGAAW Badminton Cup — rotten-egg counter (Google Sheet + Apps Script web app).
   GET  -> {"<team>-<seed>": eggs, ...}
   POST (text/plain JSON {"3-1": 4, ...}) -> adds 1..200 per player under a lock, returns the new totals.
   Referee scores (trong-tai.html): GET ?ref=T1 -> {"pairs": {"1": {"updated": ms, "state": {...}}, ...}}
   POST {"_ref": 1, "final": true, "match": "T1", "report": "...", "pairs": [[31, 20], ...5], "players": {"1-1": [atk, sup], ...}} -> appends to 'referee_final'
   POST {"_ref": 1, "match": "T1", "pair": 1, "updated": ms, "a": 31, "b": 27, "done": true, "seeds": "1-2", "teamA": "Đội 1", "teamB": "Đội 2", "state": {...}}
   -> upserts one row of the 'referee' sheet (a newer 'updated' wins). */
const SHEET_ID = '1ZCP48Eg-2kJ7nFiIXaM3zs3qEJOx4fX7cwtOf35e1mI';
const PLAYERS = [["1-1", "Đội 1", "Nguyễn Viết Tri"], ["1-2", "Đội 1", "Nguyễn Duy Hiệu"], ["1-3", "Đội 1", "Nguyễn Thanh Thiên Minh"], ["1-4", "Đội 1", "Nguyễn Thanh Tiễn"], ["1-5", "Đội 1", "Nguyễn Thị Hồng Vấn"], ["2-1", "Đội 2", "Đoàn Anh Kiệt"], ["2-2", "Đội 2", "Trần Võ Toàn Phát"], ["2-3", "Đội 2", "Lữ Thị Trang"], ["2-4", "Đội 2", "Nguyễn Ngọc Bảo Kha"], ["2-5", "Đội 2", "Nguyễn Thị Diệp Sương"], ["3-1", "Đội 3", "Nguyễn Chí Toàn"], ["3-2", "Đội 3", "Nguyễn Đức Nhuận"], ["3-3", "Đội 3", "Huỳnh Hữu Tín"], ["3-4", "Đội 3", "Trần Thiện Sáng"], ["3-5", "Đội 3", "Tô Vy Quân"], ["4-1", "Đội 4", "Phạm Công Quân"], ["4-2", "Đội 4", "Phạm Quốc Nhật"], ["4-3", "Đội 4", "Nguyễn Văn Anh Tiến"], ["4-4", "Đội 4", "Nguyễn Văn Hùng"], ["4-5", "Đội 4", "Đỗ Sơn Tây"], ["5-1", "Đội 5", "Trương Lam"], ["5-2", "Đội 5", "Nguyễn Thái Thịnh"], ["5-3", "Đội 5", "Lê Đình Nhật Khang"], ["5-4", "Đội 5", "Nguyễn Xuân Phi"], ["5-5", "Đội 5", "Huỳnh Thị Hồng Chi"], ["6-1", "Đội 6", "Lê Nguyễn Trung Vĩnh"], ["6-2", "Đội 6", "Huỳnh Lê Anh Vũ"], ["6-3", "Đội 6", "Huỳnh Võ Minh Tân"], ["6-4", "Đội 6", "Lê Quốc Tuấn"], ["6-5", "Đội 6", "Nguyễn Thị Như Thùy"]];

function sheet_() {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName('eggs');
  if (!sh) {
    sh = ss.insertSheet('eggs', 0);
    sh.getRange(1, 1, 1, 4).setValues([['id', 'Đội', 'VĐV', 'Trứng thối']]).setFontWeight('bold');
    sh.getRange(2, 1, PLAYERS.length, 1).setNumberFormat('@');  // ids like "1-1" must stay text, not dates
    sh.getRange(2, 1, PLAYERS.length, 4).setValues(PLAYERS.map(p => [p[0], p[1], p[2], 0]));
    sh.setFrozenRows(1);
    sh.autoResizeColumns(1, 4);
  }
  return sh;
}
function totals_(rows) { const o = {}; rows.forEach(r => { o[r[0]] = Number(r[3]) || 0; }); return o; }
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

/* ---------- protection ----------
   1. cache: referee reads (?ref=all 15 s, ?ref=T1 10 s) and egg totals (5 s) are served from CacheService; every write clears them.
   2. rate: all egg POSTs are counted per minute; above HARD_PER_MIN they are refused ("busy", the page retries later).
   3. Turnstile: when the Script Property TURNSTILE_SECRET is set, egg POSTs above SOFT_PER_MIN need a solved challenge
      (then a 30-min pass), and every referee "Chốt" needs one. Run authorize() once in the editor after setting it.
   4. PIN: when the Script Property REF_PIN is set, every referee write (pair saves, drafts, Chốt) must carry it. */
const SOFT_PER_MIN = 600, HARD_PER_MIN = 1500;
function prop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function bump_() {
  const c = CacheService.getScriptCache(), k = 'rate:' + Math.floor(Date.now() / 60000), n = Number(c.get(k) || 0) + 1;
  c.put(k, String(n), 120);
  return n;
}
function turnstileOk_(token) {
  const secret = prop_('TURNSTILE_SECRET');
  if (!secret) return true;
  if (!token) return false;
  try {
    const r = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'post', payload: { secret: secret, response: String(token) }, muteHttpExceptions: true });
    return JSON.parse(r.getContentText()).success === true;
  } catch (err) { return false; }
}
function passOk_(p) { return !!p && CacheService.getScriptCache().get('pass:' + p) === '1'; }
function newPass_() { const p = Utilities.getUuid(); CacheService.getScriptCache().put('pass:' + p, '1', 1800); return p; }
function authorize() { UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'post', payload: {}, muteHttpExceptions: true }); }  // run once: grants the external-request permission
function text_(s) { return ContentService.createTextOutput(s).setMimeType(ContentService.MimeType.JSON); }
function dropRefCache_(match) { CacheService.getScriptCache().removeAll(['ref:all', 'ref:' + match]); }
function triggerDeploy_() {
  const token = prop_('GH_TOKEN');
  if (!token) return;
  try {
    UrlFetchApp.fetch('https://api.github.com/repos/mcgaaw-badminton/mcgaaw-badminton.github.io/actions/workflows/deploy.yml/dispatches', {
      method: 'post',
      contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'mcgaaw-badminton-apps-script' },
      payload: JSON.stringify({ ref: 'main' }),
      muteHttpExceptions: true
    });
  } catch (err) {}
}

function doGet(e) {
  if (e && e.parameter && e.parameter.ref) {
    const ref = String(e.parameter.ref), c = CacheService.getScriptCache(), key = 'ref:' + ref, hit = c.get(key);
    if (hit) return text_(hit);
    const out = JSON.stringify(refGet_(ref));
    if (out.length < 95000) c.put(key, out, ref === 'all' ? 15 : 10);
    return text_(out);
  }
  const cache = CacheService.getScriptCache(), hit = cache.get('eggs');
  if (hit) return json_(JSON.parse(hit));
  const sh = sheet_(), o = totals_(sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues());
  cache.put('eggs', JSON.stringify(o), 5);
  return json_(o);
}

function doPost(e) {
  let add = {};
  try { add = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: 'bad json' }); }
  if (add && add._ref) return json_(refPut_(add));
  const rate = bump_();
  if (rate > HARD_PER_MIN) return json_({ error: 'busy' });
  let pass = '';
  if (rate > SOFT_PER_MIN && prop_('TURNSTILE_SECRET') && !passOk_(add._pass)) {
    if (!turnstileOk_(add._ts)) return json_({ error: 'captcha' });
    pass = newPass_();
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = sheet_(), rg = sh.getRange(2, 1, sh.getLastRow() - 1, 4), rows = rg.getValues();
    rows.forEach(r => { const n = Math.floor(Number(add[r[0]])); if (n > 0 && n <= 200) r[3] = (Number(r[3]) || 0) + n; });
    sh.getRange(2, 4, rows.length, 1).setValues(rows.map(r => [r[3]]));
    const o = totals_(rows);
    CacheService.getScriptCache().put('eggs', JSON.stringify(o), 5);
    if (pass) o._pass = pass;
    return json_(o);
  } finally { lock.releaseLock(); }
}

function setup() {
  const ss = SpreadsheetApp.openById(SHEET_ID), old = ss.getSheetByName('eggs');
  if (old && String(old.getRange(2, 1).getValue()) !== '1-1') ss.deleteSheet(old);  // rebuild a sheet whose ids were turned into dates
  sheet_();
  ss.rename('MCGAAW Cup — Trứng thối');
  CacheService.getScriptCache().remove('eggs');
}

/* ---------- referee scores ----------
   'referee'        official scores, one row per match + pair (newer 'updated' wins): live scores for the site and other phones.
   'referee_draft'  demo-mode pairs, one row per finished pair with its report code; never used by the standings.
   'referee_log'    every official save appended (never overwritten): the history of each pair.
   'referee_final'  one row per "Chốt" press (match result + per player attack/support); the standings use the LAST row of each match. */
const REF_HEAD = ['Trận', 'Cặp', 'Seed', 'Đội A', 'Đội B', 'Điểm A', 'Điểm B', 'Xong', 'Cập nhật (ms)', 'Lưu trữ', 'Mã báo cáo', 'Thời gian (ms)'];
const LOG_HEAD = ['Lưu lúc', 'Trận', 'Cặp', 'A', 'B', 'Xong', 'Pha', 'Mã báo cáo', 'Cập nhật (ms)'];
const FINAL_HEAD = ['Chốt lúc', 'Trận', 'Mã chốt', 'Đội A', 'Đội B', 'Tổng A', 'Tổng B', 'Cặp thắng A', 'Cặp thắng B', 'Tỉ số từng cặp', 'VĐV (tấn công, hỗ trợ)'];
const DRAFT_HEAD = ['Mã báo cáo', 'Lưu lúc', 'Trận', 'Cặp', 'Seed', 'Đội A', 'Đội B', 'Điểm A', 'Điểm B', 'Xong', 'Thời gian (ms)', 'Lưu trữ'];
function namedSheet_(name, head) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1000, head.length).setNumberFormat('@');  // keep "1-2", "T1" etc. as text
    head.forEach((h, k) => { if (/^(Điểm|Cập nhật|Thời gian)/.test(h)) sh.getRange(2, k + 1, 999, 1).setNumberFormat('0'); });  // number columns, by header
  }
  return sh;
}
function refRows_() {
  const sh = namedSheet_('referee', REF_HEAD);
  return sh.getLastRow() < 2 ? [] : sh.getRange(2, 1, sh.getLastRow() - 1, REF_HEAD.length).getValues();
}
function refGet_(match) {
  const out = { pairs: {} };
  if (match === 'all') {  // compact summary of every official pair, for the site build
    const all = {};
    refRows_().forEach(r => {
      const m = String(r[0]); if (!m) return;
      (all[m] = all[m] || {})[String(r[1])] = { a: Number(r[5]) || 0, b: Number(r[6]) || 0, done: r[7] === 'x', updated: Number(r[8]) || 0, ms: Number(r[11]) || 0 };
    });
    const finals = {};  // last "Chốt" of each match wins
    const fs = namedSheet_('referee_final', FINAL_HEAD);
    if (fs.getLastRow() >= 2) fs.getRange(2, 1, fs.getLastRow() - 1, FINAL_HEAD.length).getValues().forEach(r => {
      let pairs = null, players = null; try { pairs = JSON.parse(r[9]); players = JSON.parse(r[10]); } catch (err) { return; }
      finals[String(r[1])] = { at: String(r[0]), report: String(r[2]), a: Number(r[5]) || 0, b: Number(r[6]) || 0, pairs: pairs, players: players };
    });
    return { matches: all, finals: finals };
  }
  refRows_().forEach(r => {
    if (String(r[0]) !== match) return;
    let st = null; try { st = JSON.parse(r[9]); } catch (err) {}
    out.pairs[String(r[1])] = { updated: Number(r[8]) || 0, state: st, report: String(r[10] || '') };
  });
  return out;
}
function refFinal_(b) {  // "Chốt": the match result the standings will use, appended so every submission stays on record
  const match = String(b.match || ''), report = String(b.report || '').slice(0, 40);
  if (!/^T\d{1,2}$/.test(match)) return { error: 'bad key' };
  if (!turnstileOk_(b.ts)) return { error: 'captcha' };
  const pairs = b.pairs, players = b.players || {};
  if (!Array.isArray(pairs) || pairs.length !== 5 || pairs.some(p => !Array.isArray(p) || p.length !== 2 || p.some(x => !(Number(x) >= 0)))) return { error: 'bad pairs' };
  let a = 0, bb = 0, pa = 0, pb = 0;
  pairs.forEach(p => { a += Number(p[0]); bb += Number(p[1]); if (Number(p[0]) > Number(p[1])) pa++; else pb++; });
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    const sh = namedSheet_('referee_final', FINAL_HEAD);
    sh.getRange(sh.getLastRow() + 1, 1, 1, FINAL_HEAD.length).setValues([[new Date().toISOString(), match, report, String(b.teamA || ''), String(b.teamB || ''), a, bb, pa, pb, JSON.stringify(pairs), JSON.stringify(players).slice(0, 45000)]]);
  } finally { lock.releaseLock(); }
  dropRefCache_(match);
  triggerDeploy_();
  return { ok: true, final: true, match: match, report: report, a: a, b: bb };
}
function refPut_(b) {
  const pin = prop_('REF_PIN');
  if (pin && String(b.pin || '') !== pin) return { error: 'pin' };
  if (b.final) return refFinal_(b);
  const match = String(b.match || ''), pair = Number(b.pair), updated = Number(b.updated) || 0;
  if (!/^T\d{1,2}$/.test(match) || !(pair >= 1 && pair <= 5)) return { error: 'bad key' };
  const st = b.state || {}, state = JSON.stringify(st);
  if (state.length > 45000) return { error: 'too big' };
  const a = Number(b.a) || 0, bb = Number(b.b) || 0, n = (st.log || []).length, report = String(b.report || '').slice(0, 40);
  const echo = { ok: true, a: a, b: bb, n: n, report: report };
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    if (b.draft) {
      const sh = namedSheet_('referee_draft', DRAFT_HEAD);
      sh.getRange(sh.getLastRow() + 1, 1, 1, DRAFT_HEAD.length).setValues([[report, new Date().toISOString(), match, String(pair), String(b.seeds || ''), String(b.teamA || ''), String(b.teamB || ''), a, bb, b.done ? 'x' : '', Number(st.ms) || 0, state]]);
      return echo;
    }
    const sh = namedSheet_('referee', REF_HEAD), cnt = Math.max(0, sh.getLastRow() - 1);
    const keys = cnt ? sh.getRange(2, 1, cnt, 2).getValues() : [];
    let row = -1;
    for (let i = 0; i < keys.length; i++) if (String(keys[i][0]) === match && Number(keys[i][1]) === pair) { row = i + 2; break; }
    if (row > 0 && (Number(sh.getRange(row, 9).getValue()) || 0) > updated) { echo.stale = true; return echo; }
    if (row < 0) row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, REF_HEAD.length).setValues([[match, String(pair), String(b.seeds || ''), String(b.teamA || ''), String(b.teamB || ''), a, bb, b.done ? 'x' : '', updated, state, report, Number(st.ms) || 0]]);
    const lg = namedSheet_('referee_log', LOG_HEAD);  // history: every official save, newest at the bottom
    lg.getRange(lg.getLastRow() + 1, 1, 1, LOG_HEAD.length).setValues([[new Date().toISOString(), match, String(pair), a, bb, b.done ? 'x' : '', n, report, updated]]);
    dropRefCache_(match);
    return echo;
  } finally { lock.releaseLock(); }
}
