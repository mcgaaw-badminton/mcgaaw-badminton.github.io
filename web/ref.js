/* Referee scoring page (trong-tai.html). Phone first.
   Every tap is saved on the phone at once (localStorage), then sent to the Google Sheet in the background
   (Apps Script web app in config/site.json eggs.api_url, sheet 'referee'); a failed send retries until it goes through.
   Rules: rally scoring to 31, first to 31 wins the pair; doubles service courts follow BWF rules. */
(function () {
  'use strict';
  var S = window.SITE, $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var API = (S.meta && S.meta.eggs && S.meta.eggs.api) || '';
  var TARGET = 31, PAIRS = S.pairs;
  var teamById = {}; S.teams.forEach(function (t) { teamById[t.id] = t; });
  var other = function (t) { return t === 'a' ? 'b' : 'a'; };
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }

  /* ---------- match list ---------- */
  var playable = S.matches.filter(function (m) { return m.a.team && m.b.team; });
  function progress(code) {
    var st = ls('gcl-ref-' + code); if (!st) return 0;
    return st.pairs.filter(function (p) { return p.done; }).length;
  }
  function renderList() {
    $('mlist').innerHTML = playable.length ? playable.map(function (m) {
      var n = progress(m.code);
      return '<a class="mrow" href="#' + esc(m.code) + '"><span class="code">' + esc(m.code) + '</span><span class="who"><b>' + esc(teamById[m.a.team].name) + ' vs ' + esc(teamById[m.b.team].name) + '</b><small>' + esc(S.rules.weekday) + ' ' + esc(m.date) + ' · ' + esc(m.round) + '</small></span>' +
        '<span class="st' + (n === 5 ? ' done' : n ? ' on' : '') + '">' + (n === 5 ? 'Xong' : n ? n + '/5 cặp' : 'Chưa ghi') + '</span></a>';
    }).join('') : '<p class="muted">Chưa có trận nào biết đủ hai đội.</p>';
  }

  /* ---------- state ---------- */
  var M = null, ST = null;  // current match, its saved state
  function blankPair() { return { setup: { serve: 'a', aR: 0, bR: 0 }, log: [], updated: 0, done: false }; }
  function loadState(code) {
    var st = ls('gcl-ref-' + code);
    if (!st || !st.pairs || st.pairs.length !== PAIRS.length) st = { pairs: PAIRS.map(blankPair), cur: 0, view: { aTop: true, mirror: false } };
    return st;
  }
  function players(t, i) {  // names of team t ('a'|'b') in pair i, seed order
    var team = teamById[M[t].team], p = PAIRS[i];
    return [team.members[p[0] - 1], team.members[p[1] - 1]];
  }
  function first(n) { return String(n).trim().split(/\s+/).pop(); }  // Vietnamese given name = last word
  function shortNames(i) { return players('a', i).concat(players('b', i)).map(first); }
  function replay(pr) {
    var pos = { a: { R: pr.setup.aR, L: 1 - pr.setup.aR }, b: { R: pr.setup.bR, L: 1 - pr.setup.bR } };
    var sc = { a: 0, b: 0 }, srv = pr.setup.serve, end = null, endAt = -1;
    pr.log.forEach(function (e, k) {
      if (end) return;
      if (e.w === srv) { sc[srv]++; var r = pos[srv].R; pos[srv].R = pos[srv].L; pos[srv].L = r; }
      else { sc[e.w]++; srv = e.w; }
      if (sc[e.w] >= TARGET) { end = e.w; endAt = k; }
    });
    var court = sc[srv] % 2 ? 'L' : 'R';
    return { pos: pos, sc: sc, srv: srv, court: court, server: pos[srv][court], receiver: pos[other(srv)][court], end: end, endAt: endAt };
  }
  function scoreAt(pr, k) {  // score after rally k
    var r = replay({ setup: pr.setup, log: pr.log.slice(0, k + 1) }); return r.sc;
  }

  /* ---------- saving: phone first, sheet in the background ---------- */
  var dirty = {}, timer = null, sending = false, lastSent = 0;
  function setSync(kind, txt) { var s = $('sync'); s.className = 'sync ' + kind; $('syncTxt').textContent = txt; }
  function save(i) {
    var pr = ST.pairs[i]; pr.updated = Date.now();
    var r = replay(pr); pr.done = !!r.end;
    ls('gcl-ref-' + M.code, ST);
    if (!API) { setSync('local', 'Đã lưu trên máy'); return; }
    dirty[i] = true; setSync('wait', 'Đang gửi');
    clearTimeout(timer); timer = setTimeout(flush, 500);
  }
  function hhmm(d) { return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
  function flush() {
    if (sending) { clearTimeout(timer); timer = setTimeout(flush, 400); return; }
    var ids = Object.keys(dirty); if (!ids.length) return;
    var i = +ids[0], pr = ST.pairs[i], r = replay(pr), code = M.code;
    delete dirty[i]; sending = true;
    var body = { _ref: 1, match: code, pair: i + 1, updated: pr.updated, a: r.sc.a, b: r.sc.b, done: !!r.end, seeds: PAIRS[i].join('-'),
      teamA: teamById[M.a.team].name, teamB: teamById[M.b.team].name, state: { setup: pr.setup, log: pr.log, names: players('a', i).concat(players('b', i)) } };
    fetch(API, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (d) { if (!d || d.ok !== true) throw new Error('bad'); sending = false; lastSent = Date.now(); if (!Object.keys(dirty).length) setSync('ok', 'Đã lưu ' + hhmm(new Date())); else flush(); })
      .catch(function () { sending = false; if (M && M.code === code) dirty[i] = true; setSync('err', 'Mất mạng · đã giữ trên máy'); clearTimeout(timer); timer = setTimeout(flush, 4000); });
  }
  window.addEventListener('online', function () { if (Object.keys(dirty).length) flush(); });
  function pullServer(code) {
    if (!API) return;
    setSync('wait', 'Đang tải');
    fetch(API + '?ref=' + encodeURIComponent(code)).then(function (r) { return r.json(); }).then(function (d) {
      if (!M || M.code !== code) return;
      if (!d || !d.pairs) { setSync('err', 'Bảng tính chưa bật · giữ trên máy'); return; }
      var changed = false;
      Object.keys(d.pairs).forEach(function (k) {
        var i = +k - 1, sp = d.pairs[k], lp = ST.pairs[i];
        if (!lp || !sp.state || !(sp.updated > lp.updated)) return;
        lp.setup = sp.state.setup; lp.log = sp.state.log || []; lp.updated = sp.updated; lp.done = !!replay(lp).end; changed = true;
      });
      if (changed) { ST.cur = firstOpen(); ls('gcl-ref-' + code, ST); render(); }
      setSync('ok', changed ? 'Đã tải điểm đã lưu' : 'Đã đồng bộ');
    }).catch(function () { setSync('err', 'Mất mạng · dùng dữ liệu trên máy'); });
  }
  function firstOpen() { for (var i = 0; i < ST.pairs.length; i++) if (!ST.pairs[i].done) return i; return ST.pairs.length - 1; }

  /* ---------- court drawing ---------- */
  var tokens = {};
  function slot(t, court, front) {  // screen position (%) of team t standing in its R/L service court
    var top = (ST.view.aTop ? 'a' : 'b') === t;
    var x = top ? (court === 'R' ? 25 : 75) : (court === 'R' ? 75 : 25);
    if (ST.view.mirror) x = 100 - x;
    var y = top ? (front ? 33 : 17) : (front ? 67 : 83);
    return { x: x, y: y, quad: (top ? 't' : 'b') + (x < 50 ? 'l' : 'r') };
  }
  function renderCourt() {
    var i = ST.cur, pr = ST.pairs[i], r = replay(pr), names = shortNames(i), court = $('court');
    var last = pr.log.length ? pr.log[Math.min(pr.log.length - 1, r.endAt >= 0 ? r.endAt : pr.log.length - 1)] : null;
    court.querySelectorAll('.svc').forEach(function (q) { q.classList.remove('serve', 'recv'); });
    var srvSlot = null, recSlot = null;
    ['a', 'b'].forEach(function (t, ti) {
      [0, 1].forEach(function (k) {
        var key = t + k, el = tokens[key];
        if (!el) {
          el = document.createElement('button'); el.type = 'button'; el.className = 'tok team-' + t; el.dataset.team = t; el.dataset.idx = k;
          el.innerHTML = '<i></i><span></span>'; court.appendChild(el); tokens[key] = el;
        }
        var cK = r.pos[t].R === k ? 'R' : 'L';
        var isSrv = !r.end && t === r.srv && r.server === k, isRec = !r.end && t !== r.srv && r.receiver === k;
        var sp = slot(t, cK, isSrv || isRec);
        el.style.left = sp.x + '%'; el.style.top = sp.y + '%';
        var full = players(t, i)[k];
        el.querySelector('i').textContent = names[ti * 2 + k].charAt(0).toUpperCase();
        el.querySelector('span').textContent = names[ti * 2 + k];
        el.setAttribute('aria-label', full + ', ' + teamById[M[t].team].name + (isSrv ? ', đang giao cầu' : isRec ? ', nhận giao cầu' : '') + '. Chạm để ghi điểm cho ' + teamById[M[t].team].name);
        el.classList.toggle('srv', isSrv); el.classList.toggle('rec', isRec);
        el.classList.toggle('last', !!(last && last.w === t && last.p === k));
        el.disabled = !!r.end;
        if (isSrv) srvSlot = sp; if (isRec) recSlot = sp;
      });
    });
    if (srvSlot) court.querySelector('.svc.' + srvSlot.quad).classList.add('serve');
    if (recSlot) court.querySelector('.svc.' + recSlot.quad).classList.add('recv');
    var line = $('arrowLine');
    if (srvSlot && recSlot && !r.end) {
      line.setAttribute('x1', srvSlot.x); line.setAttribute('y1', srvSlot.y + (srvSlot.y > 50 ? -6 : 6));
      line.setAttribute('x2', recSlot.x); line.setAttribute('y2', recSlot.y + (recSlot.y > 50 ? -6 : 6));
      $('arrow').classList.remove('off');
      var sh = $('shuttle'); sh.style.left = srvSlot.x + (srvSlot.x > 50 ? -9 : 9) + '%'; sh.style.top = srvSlot.y + (srvSlot.y > 50 ? -7 : 7) + '%'; sh.hidden = false;
    } else { $('arrow').classList.add('off'); $('shuttle').hidden = true; }
  }

  /* ---------- render ---------- */
  function teamName(t) { return teamById[M[t].team].name; }
  function render() {
    if (!M) return;
    var i = ST.cur, pr = ST.pairs[i], r = replay(pr), topT = ST.view.aTop ? 'a' : 'b', botT = other(topT);
    $('matchTitle').textContent = M.code + ' · ' + teamName('a') + ' vs ' + teamName('b');
    $('pairs').innerHTML = ST.pairs.map(function (p, k) {
      var rr = replay(p), lbl = p.log.length ? rr.sc.a + '–' + rr.sc.b : '—';
      return '<button type="button" class="pch' + (k === i ? ' on' : '') + (p.done ? ' done' : '') + '" data-k="' + k + '" aria-pressed="' + (k === i) + '"><b>' + PAIRS[k].join('–') + '</b><small>' + lbl + '</small></button>';
    }).join('');
    [['sideTop', topT], ['sideBot', botT]].forEach(function (x) {
      var el = $(x[0]), t = x[1], names = players(t, i);
      el.dataset.team = t; el.className = 'side ' + (x[0] === 'sideTop' ? 'is-top' : 'is-bot') + ' team-' + t + (r.srv === t && !r.end ? ' serving' : '') + (r.end === t ? ' won' : '');
      el.setAttribute('aria-label', 'Ghi 1 điểm cho ' + teamName(t) + ', đang ' + r.sc[t] + ' điểm');
      var srvName = r.srv === t && !r.end ? first(names[r.server]) : '';
      el.querySelector('.tn').innerHTML = '<b>' + esc(teamName(t)) + (srvName ? '<em>giao: ' + esc(srvName) + '</em>' : '') + '</b><small>' + esc(names.map(first).join(' · ')) + '</small>';
      el.querySelector('.sc').textContent = r.sc[t];
      el.disabled = !!r.end;
    });
    $('target').textContent = r.end ? 'Xong' : 'Chạm ' + TARGET;
    // the call a referee says out loud: server's score first
    $('call').textContent = r.end ? teamName(r.end) + ' thắng ' + r.sc[r.end] + '–' + r.sc[other(r.end)]
      : !pr.log.length ? first(players(r.srv, i)[r.server]) + ' giao trước · 0–0'
      : first(players(r.srv, i)[r.server]) + ' giao · ' + r.sc[r.srv] + '–' + r.sc[other(r.srv)];
    // setup before the first rally
    var fresh = !pr.log.length;
    $('setup').hidden = !fresh;
    if (fresh) {
      $('setupRow').innerHTML = '<div class="seg2" role="group" aria-label="Đội giao cầu trước"><span>Giao trước</span>' +
        ['a', 'b'].map(function (t) { return '<button type="button" data-serve="' + t + '" aria-pressed="' + (pr.setup.serve === t) + '">' + esc(teamName(t)) + '</button>'; }).join('') + '</div>' +
        '<div class="flips">' + ['a', 'b'].map(function (t) { var k = pr.setup[t + 'R']; return '<button type="button" class="tool team-' + t + '" data-flip="' + t + '">' + esc(teamName(t)) + ': <b>' + esc(shortNames(i)[(t === 'a' ? 0 : 2) + k]) + '</b> ô phải ⇄</button>'; }).join('') + '</div>';
    }
    // log, newest first
    var ex = r.endAt >= 0 ? r.endAt : Infinity;
    $('log').innerHTML = pr.log.map(function (e, k) {
      var sc = k <= ex ? scoreAt(pr, k) : null, nm = e.p != null ? shortNames(i)[(e.w === 'a' ? 0 : 2) + e.p] : '';
      return '<li><button type="button" class="lg team-' + e.w + (k > ex ? ' extra' : '') + '" data-k="' + k + '" aria-label="Điểm ' + (k + 1) + ' cho ' + esc(teamName(e.w)) + ', chạm để sửa"><b>' + (sc ? sc.a + '–' + sc.b : 'thừa') + '</b><span>' + esc(nm || teamName(e.w)) + '</span></button></li>';
    }).reverse().join('') || '<li class="muted empty">Chưa có điểm nào. Chạm vào người hoặc nút +1 để ghi điểm.</li>';
    $('undo').disabled = !pr.log.length;
    renderCourt();
  }

  /* ---------- actions ---------- */
  var lastTap = 0, toastT;
  function point(t, p) {
    var i = ST.cur, pr = ST.pairs[i], now = Date.now();
    if (replay(pr).end || now - lastTap < 350) return;  // a double tap must not give two points
    lastTap = now;
    pr.log.push({ w: t, p: p == null ? null : +p });
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
    save(i); render();
    var r = replay(pr);
    if (r.end) { $('toast').hidden = true; return pairDone(i, r); }
    var who = p == null ? '' : ' · ' + first(players(t, i)[+p]);
    $('toastTxt').textContent = '+1 ' + teamName(t) + who + '  ' + r.sc.a + '–' + r.sc.b;
    $('toast').className = 'toast team-' + t; $('toast').hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { $('toast').hidden = true; }, 2200);
  }
  $('toastUndo').addEventListener('click', function () { $('toast').hidden = true; var pr = ST.pairs[ST.cur]; if (!pr.log.length) return; pr.log.pop(); save(ST.cur); render(); });
  function pairDone(i, r) {
    var allDone = ST.pairs.every(function (p) { return p.done; });
    if (allDone) return summary();
    var next = firstOpen();
    sheet('Cặp ' + PAIRS[i].join('–') + ': ' + teamName(r.end) + ' thắng ' + r.sc[r.end] + '–' + r.sc[other(r.end)],
      '<p>Điểm đã lưu. Muốn sửa thì chọn "Sửa điểm cặp này".</p>',
      [['Sang cặp ' + PAIRS[next].join('–'), function () { ST.cur = next; ls('gcl-ref-' + M.code, ST); closeSheet(); render(); }, 'pri'], ['Sửa điểm cặp này', closeSheet]]);
  }
  function summary() {
    var tot = { a: 0, b: 0 }, won = { a: 0, b: 0 }, rows = ST.pairs.map(function (p, k) {
      var r = replay(p); tot.a += r.sc.a; tot.b += r.sc.b; if (r.end) won[r.end]++;
      return '<tr><td>' + PAIRS[k].join('–') + '</td><td class="' + (r.end === 'a' ? 'w' : '') + '">' + r.sc.a + '</td><td class="' + (r.end === 'b' ? 'w' : '') + '">' + r.sc.b + '</td></tr>';
    });
    var win = tot.a !== tot.b ? (tot.a > tot.b ? 'a' : 'b') : won.a !== won.b ? (won.a > won.b ? 'a' : 'b') : null;
    var json = '"result": {"pairs": [' + ST.pairs.map(function (p) { var r = replay(p); return '[' + r.sc.a + ', ' + r.sc.b + ']'; }).join(', ') + ']}';
    sheet(win ? teamName(win) + ' thắng trận ' + M.code : 'Trận ' + M.code + ' hòa',
      '<table class="sum"><thead><tr><th>Cặp</th><th>' + esc(teamName('a')) + '</th><th>' + esc(teamName('b')) + '</th></tr></thead><tbody>' + rows.join('') +
      '<tr class="tot"><td>Tổng</td><td>' + tot.a + '</td><td>' + tot.b + '</td></tr><tr><td>Cặp thắng</td><td>' + won.a + '</td><td>' + won.b + '</td></tr></tbody></table>' +
      (tot.a === tot.b ? '<p class="muted">Bằng tổng điểm nên xét số cặp thắng.</p>' : '') +
      '<p class="muted">Kết quả đã lưu trong bảng tính. Dòng để dán vào config/schedule.json:</p><pre class="code" id="resJson">' + esc(json) + '</pre>',
      [['Chép dòng kết quả', function (b) {
        var done = function () { b.textContent = 'Đã chép'; };
        try { navigator.clipboard.writeText(json).then(done, function () { selectPre(); }); } catch (e) { selectPre(); }
      }, 'pri'], ['Xem lại các cặp', closeSheet]]);
  }
  function selectPre() { var r = document.createRange(); r.selectNodeContents($('resJson')); var s = getSelection(); s.removeAllRanges(); s.addRange(r); }
  function editRally(k) {
    var i = ST.cur, pr = ST.pairs[i], e = pr.log[k], sc = scoreAt(pr, k), o = other(e.w);
    sheet('Điểm #' + (k + 1) + ' (' + sc.a + '–' + sc.b + ')', '<p>Đang ghi cho <b>' + esc(teamName(e.w)) + '</b>. Đổi hoặc xóa thì các điểm sau tự tính lại, vị trí đứng cũng tính lại theo luật.</p>', [
      ['Ghi cho ' + teamName(o), function () { pr.log[k] = { w: o, p: null }; save(i); closeSheet(); render(); }, 'pri'],
      ['Xóa điểm này', function () { pr.log.splice(k, 1); save(i); closeSheet(); render(); }, 'danger'],
      ['Đóng', closeSheet]
    ]);
  }
  function sheet(title, body, acts) {
    $('sheetTitle').textContent = title; $('sheetBody').innerHTML = body;
    var box = $('sheetAct'); box.innerHTML = '';
    acts.forEach(function (a) { var b = document.createElement('button'); b.type = 'button'; b.className = 'sbtn ' + (a[2] || ''); b.textContent = a[0]; b.onclick = function () { a[1](b); }; box.appendChild(b); });
    $('sheet').hidden = false; box.firstChild.focus();
  }
  function closeSheet() { $('sheet').hidden = true; }
  $('sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });

  $('court').addEventListener('click', function (e) { var b = e.target.closest('.tok'); if (b && !b.disabled) point(b.dataset.team, b.dataset.idx); });
  ['sideTop', 'sideBot'].forEach(function (id) { $(id).addEventListener('click', function () { point(this.dataset.team, null); }); });
  $('undo').addEventListener('click', function () { var pr = ST.pairs[ST.cur]; if (!pr.log.length) return; pr.log.pop(); save(ST.cur); render(); });
  $('log').addEventListener('click', function (e) { var b = e.target.closest('.lg'); if (b) editRally(+b.dataset.k); });
  $('pairs').addEventListener('click', function (e) { var b = e.target.closest('.pch'); if (!b) return; ST.cur = +b.dataset.k; ls('gcl-ref-' + M.code, ST); render(); });
  $('setupRow').addEventListener('click', function (e) {
    var pr = ST.pairs[ST.cur], b = e.target.closest('button'); if (!b) return;
    if (b.dataset.serve) pr.setup.serve = b.dataset.serve;
    if (b.dataset.flip) pr.setup[b.dataset.flip + 'R'] = 1 - pr.setup[b.dataset.flip + 'R'];
    save(ST.cur); render();
  });
  $('swapEnds').addEventListener('click', function () { ST.view.aTop = !ST.view.aTop; ls('gcl-ref-' + M.code, ST); render(); });
  $('mirror').addEventListener('click', function () { ST.view.mirror = !ST.view.mirror; ls('gcl-ref-' + M.code, ST); render(); });
  $('matchBtn').addEventListener('click', function () { location.hash = ''; });

  /* ---------- routing: #T1 opens a match ---------- */
  var wake = null;
  function route() {
    var code = location.hash.replace('#', ''), m = playable.filter(function (x) { return x.code === code; })[0];
    closeSheet();
    if (!m) {
      M = null; $('game').hidden = true; $('pick').hidden = false; $('matchTitle').textContent = 'Chọn trận'; renderList();
      setSync(API ? 'idle' : 'local', API ? 'Lưu trên máy + bảng tính' : 'Chỉ lưu trên máy');
      return;
    }
    M = m; ST = loadState(m.code); tokens = {}; $('court').querySelectorAll('.tok').forEach(function (t) { t.remove(); });
    $('pick').hidden = true; $('game').hidden = false;
    render(); pullServer(m.code);
    try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {}
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', function () { if (!document.hidden && M) { if (Object.keys(dirty).length) flush(); else pullServer(M.code); } });
  route();
})();
