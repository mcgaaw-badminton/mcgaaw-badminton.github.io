/* Referee scoring page (trong-tai.html). Phone first; one task per screen, every screen has a way back.
   Flow: match list → the 5 pairs → positions (must be set) → scoring (clock runs) → pair finished (saved + checked on the sheet).
   Every tap is saved on the phone at once (localStorage), then sent to the Google Sheet (Apps Script, sheet 'referee');
   finishing a pair sends it immediately and reads it back to confirm it is really there.
   Rules: rally scoring, the first side to 31 wins the pair (no setting). Doubles service (BWF): the serving side serves from its
   right court on an even score, left on odd; when the serving side wins the rally the server switches courts with the partner;
   when the receiving side wins it serves next and nobody moves. Match: more total points; equal total → more pairs won. */
(function () {
  'use strict';
  var S = window.SITE, $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var API = (S.meta && S.meta.eggs && S.meta.eggs.api) || '';
  var TARGET = 31, PAIRS = S.pairs;
  var teamById = {}; S.teams.forEach(function (t) { teamById[t.id] = t; });
  var other = function (t) { return t === 'a' ? 'b' : 'a'; };
  var first = function (n) { return String(n).trim().split(/\s+/).pop(); };  // given name = last word
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function fmt(ms) { var s = Math.floor(ms / 1000), m = Math.floor(s / 60); return (m < 10 ? '0' : '') + m + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); }
  function clockTime(t) { return new Date(t).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }

  var playable = S.matches.filter(function (m) { return m.a.team && m.b.team; });
  /* by the schedule: today's matches are open; earlier ones stay open (a busy team may play later in the week);
     later ones are locked in official mode (demo can open anything) */
  function dayKey(d) { var p = d.split('/'); return p[2] + p[1] + p[0]; }
  function todayKey() { var n = new Date(); return '' + n.getFullYear() + ('0' + (n.getMonth() + 1)).slice(-2) + ('0' + n.getDate()).slice(-2); }
  function when(m) { var k = dayKey(m.date), t = todayKey(); return k === t ? 'today' : k < t ? 'past' : 'future'; }
  function locked(m) { return MODE === 'live' && when(m) === 'future'; }
  var M = null, ST = null, I = 0, VIEW = 'list', VISIT = null;
  /* two modes, same screens: 'live' (Chính thức) sends every tap to the sheet the standings read;
     'demo' sends nothing while playing, but a finished pair still goes to a separate draft sheet with a report code (in case a real pair was scored in demo) */
  var MODE = (function () { try { return localStorage.getItem('gcl-ref-mode') === 'demo' ? 'demo' : 'live'; } catch (e) { return 'live'; } })();
  function keyOf(code) { return (MODE === 'demo' ? 'gcl-refdemo-' : 'gcl-ref-') + code; }
  function setMode(m) {
    MODE = m; try { localStorage.setItem('gcl-ref-mode', m); } catch (e) {}
    document.documentElement.classList.toggle('demo', m === 'demo');
  }
  setMode(MODE);

  /* ---------- state ---------- */
  function blankPair() { return { setup: { left: null, far: { a: null, b: null }, serve: null, ok: false }, log: [], timer: { ms: 0, since: null }, manualEnd: false, done: false, updated: 0, sent: 0, check: null }; }
  function migrate(p) {  // v1 pairs (aR/bR + aTop) -> v2
    if (!p.setup || p.setup.left !== undefined) return p;
    var n = blankPair(); n.log = p.log || []; n.updated = p.updated || 0;
    if (n.log.length) { n.setup = { left: 'a', far: { a: 1 - p.setup.aR, b: p.setup.bR }, serve: p.setup.serve, ok: true }; }
    return n;
  }
  function loadState(code) {
    var st = ls(keyOf(code));
    if (!st || !st.pairs || st.pairs.length !== PAIRS.length) st = { v: 2, pairs: PAIRS.map(blankPair) };
    st.pairs = st.pairs.map(function (p) { p = migrate(p); var b = blankPair(); Object.keys(b).forEach(function (k) { if (p[k] === undefined) p[k] = b[k]; }); return p; });
    st.v = 2; st.mode = MODE; return st;
  }
  function store() { ls(keyOf(M.code), ST); }
  function players(t, i) { var team = teamById[M[t].team], p = PAIRS[i]; return [team.members[p[0] - 1], team.members[p[1] - 1]]; }
  function teamName(t) { return teamById[M[t].team].name; }
  function rIdx(setup, t) { var f = setup.far[t]; return setup.left === t ? 1 - f : f; }  // which player stands in team t's RIGHT court at 0–0
  function fillFar(su) { if (su.left) ['a', 'b'].forEach(function (t) { if (su.far[t] == null) su.far[t] = 0; }); }  // until changed: first-listed player stands far
  function complete(su) { return !!(su.left && su.serve && su.far.a != null && su.far.b != null); }
  function replay(pr, upto) {
    if (!complete(pr.setup)) return { pos: null, sc: { a: 0, b: 0 }, srv: null, court: 'R', server: null, receiver: null, end: null, endAt: -1 };
    var su = pr.setup, pos = { a: { R: rIdx(su, 'a') }, b: { R: rIdx(su, 'b') } };
    pos.a.L = 1 - pos.a.R; pos.b.L = 1 - pos.b.R;
    var sc = { a: 0, b: 0 }, srv = su.serve, end = null, endAt = -1, log = upto == null ? pr.log : pr.log.slice(0, upto + 1);
    log.forEach(function (e, k) {
      if (end) return;
      if (e.w === srv) { sc[srv]++; var r = pos[srv].R; pos[srv].R = pos[srv].L; pos[srv].L = r; }
      else { sc[e.w]++; srv = e.w; }
      if (sc[e.w] >= TARGET) { end = e.w; endAt = k; }
    });
    var court = sc[srv] % 2 ? 'L' : 'R';
    return { pos: pos, sc: sc, srv: srv, court: court, server: pos[srv][court], receiver: pos[other(srv)][court], end: end, endAt: endAt };
  }
  function prog(pr) { if (pr.done) return 100; var r = replay(pr); return Math.min(100, Math.max(r.sc.a, r.sc.b) / TARGET * 100); }
  function bar(pc, cls) { return '<span class="prog' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><i style="width:' + pc.toFixed(1) + '%"></i></span>'; }
  function winnerOf(pr) { var r = replay(pr); if (r.end) return r.end; if (pr.manualEnd && r.sc.a !== r.sc.b) return r.sc.a > r.sc.b ? 'a' : 'b'; return null; }

  /* ---------- clock: runs only on the scoring screens of an unfinished pair ---------- */
  function tMs(pr) { return pr.timer.ms + (pr.timer.since ? Date.now() - pr.timer.since : 0); }
  function tRun(pr, on) {
    if (on && !pr.timer.since) pr.timer.since = Date.now();
    if (!on && pr.timer.since) { pr.timer.ms += Date.now() - pr.timer.since; pr.timer.since = null; }
  }
  function syncClock() {
    if (!ST) return;
    ST.pairs.forEach(function (pr, k) { tRun(pr, k === I && (VIEW === 'play' || VIEW === 'log') && !pr.done && pr.setup.ok); });
    store(); tick();
  }
  function tick() {
    var c = $('clock');
    if (!ST || !(VIEW === 'play' || VIEW === 'log' || VIEW === 'end')) { c.hidden = true; return; }
    var pr = ST.pairs[I]; c.hidden = false; c.textContent = fmt(tMs(pr)); c.classList.toggle('run', !!pr.timer.since);
  }
  setInterval(tick, 500);

  /* ---------- saving: phone first, then the sheet; finishing a pair is read back from the sheet ---------- */
  var queue = {}, timer = null, sending = false;
  function needsSend(p) { return p.updated > p.sent && !!(p.log.length || p.sent); }  // positions alone are not sent: a phone opened by mistake never touches the sheet
  function unsent() { return ST ? ST.pairs.filter(needsSend).length : 0; }
  function showSync(kind, txt) { var s = $('sync'); s.className = 'sync ' + kind; $('syncTxt').textContent = txt; }
  function syncLabel() {
    if (!API) return showSync('local', 'Chỉ lưu trên máy');
    if (MODE === 'demo') return showSync('local', 'Demo · không gửi');
    if (!ST) return showSync('idle', '');
    var n = unsent();
    if (sending || (n && Object.keys(queue).length && !timer)) return showSync('wait', 'Đang gửi…');
    if (n) return showSync('err', 'Chưa gửi ' + n + ' cặp · chạm để gửi');
    var last = Math.max.apply(null, ST.pairs.map(function (p) { return p.sent; }));
    showSync('ok', last ? 'Đã lưu ' + clockTime(last).slice(0, 5) : 'Đã đồng bộ');
  }
  function touch(i) {
    var pr = ST.pairs[i]; pr.updated = Date.now(); pr.check = null;
    var r = replay(pr); pr.done = !!r.end || (pr.manualEnd && !!winnerOf(pr));
    store();
    if (API && MODE === 'live' && needsSend(pr)) { queue[i] = true; showSync('wait', 'Đang gửi…'); clearTimeout(timer); timer = setTimeout(flush, 400); }
  }
  function reportId(i) { var pr = ST.pairs[i]; if (!pr.report) { pr.report = M.code + '-' + (i + 1) + '-' + Date.now().toString(36).toUpperCase().slice(-5); store(); } return pr.report; }
  function payload(i) {
    var pr = ST.pairs[i], r = replay(pr);
    return { _ref: 1, draft: MODE === 'demo', report: reportId(i), match: M.code, pair: i + 1, updated: pr.updated, a: r.sc.a, b: r.sc.b, done: pr.done, seeds: PAIRS[i].join('-'),
      teamA: teamName('a'), teamB: teamName('b'),
      state: { setup: pr.setup, log: pr.log, ms: tMs(pr), manualEnd: pr.manualEnd, names: players('a', i).concat(players('b', i)) } };
  }
  function post(i) {
    var body = payload(i), ver = body.updated, code = M.code;
    return fetch(API, { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
      .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
      .then(function (d) {
        if (!d || d.ok !== true) throw new Error('not saved');
        if (d.a !== undefined && (d.a !== body.a || d.b !== body.b || d.n !== body.state.log.length)) throw new Error('echo mismatch');
        if (M && M.code === code) { ST.pairs[i].sent = Math.max(ST.pairs[i].sent, ver); store(); } return ver; });
  }
  function flush() {
    timer = null;
    if (!API || !M || MODE === 'demo') return;
    if (sending) { timer = setTimeout(flush, 300); return; }
    var ids = Object.keys(queue); if (!ids.length) return syncLabel();
    var i = +ids[0]; delete queue[i]; sending = true; syncLabel();
    post(i).then(function () { sending = false; renderSide(); flush(); syncLabel(); })
      .catch(function () { sending = false; queue[i] = true; timer = setTimeout(flush, 4000); syncLabel(); });
  }
  function retryAll() { if (!ST || MODE === 'demo') return; ST.pairs.forEach(function (p, k) { if (needsSend(p)) queue[k] = true; }); clearTimeout(timer); flush(); }
  $('sync').addEventListener('click', retryAll);
  window.addEventListener('online', retryAll);
  /* send this pair now, then read it back from the sheet and compare */
  function submitAndCheck(i) {
    var pr = ST.pairs[i];
    if (!API) { pr.check = { state: 'local' }; renderEnd(); return; }
    pr.check = { state: 'sending' }; renderEnd();
    delete queue[i];
    var code = M.code;
    (function attempt() { return sending ? new Promise(function (ok) { setTimeout(ok, 300); }).then(attempt) : Promise.resolve(); })()
      .then(function () { sending = true; return post(i); })
      .then(function (ver) {
        sending = false;
        if (MODE === 'demo') { var rr = replay(ST.pairs[i]); ST.pairs[i].check = { state: 'ok', at: Date.now(), a: rr.sc.a, b: rr.sc.b, draft: true }; store(); return; }
        return fetch(API + '?ref=' + encodeURIComponent(code)).then(function (r) { return r.json(); }).then(function (d) {
          var row = d && d.pairs && d.pairs[String(i + 1)], st = row && row.state, r = replay(ST.pairs[i]);
          var same = row && row.updated >= ver && st && st.log && st.log.length === ST.pairs[i].log.length;
          if (!same) throw new Error('mismatch');
          ST.pairs[i].check = { state: 'ok', at: Date.now(), a: r.sc.a, b: r.sc.b }; store();
        });
      })
      .catch(function () { sending = false; ST.pairs[i].check = { state: 'err' }; store(); if (MODE === 'live') { queue[i] = true; clearTimeout(timer); timer = setTimeout(flush, 4000); } })
      .then(function () { if (M && M.code === code) { renderEnd(); renderSide(); syncLabel(); } });
  }
  function pullServer(code) {
    if (!API || MODE === 'demo') return;
    fetch(API + '?ref=' + encodeURIComponent(code)).then(function (r) { return r.json(); }).then(function (d) {
      if (!M || M.code !== code || !d || !d.pairs) return;
      var changed = false;
      Object.keys(d.pairs).forEach(function (k) {
        var i = +k - 1, sp = d.pairs[k], lp = ST.pairs[i];
        var sl = (sp.state && sp.state.log) || [];
        if (!lp || !sp.state || !(sp.updated > lp.updated || (!lp.log.length && sl.length && sp.updated > lp.sent))) return;
        var n = migrate({ setup: sp.state.setup, log: sp.state.log || [], updated: sp.updated });
        lp.setup = n.setup; lp.log = n.log; lp.updated = lp.sent = sp.updated; lp.manualEnd = !!sp.state.manualEnd;
        lp.timer = { ms: sp.state.ms || 0, since: null }; lp.done = !!replay(lp).end || (lp.manualEnd && !!winnerOf(lp)); if (sp.report) lp.report = sp.report; changed = true;
      });
      if (changed) { store(); route(); }  // newer scores from another phone: redraw the current screen
      syncLabel();
    }).catch(syncLabel);
  }

  /* ---------- court drawing (landscape court: net down the middle, LEFT half blue, RIGHT half orange) ---------- */
  function courtShell(el) {
    if (el.dataset.ready) return;
    el.dataset.ready = '1';
    el.innerHTML = '<div class="half hl"></div><div class="half hr"></div>' +
      '<div class="box lt"></div><div class="box lb"></div><div class="box rt"></div><div class="box rb"></div>' +
      '<div class="net"></div>' +
      '<svg class="arrow" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="0" x2="0" y2="0"/></svg><span class="shuttle" aria-hidden="true" hidden></span>';
  }
  function spot(su, t, court, front) {
    var left = su.left === t, top = left ? court === 'L' : court === 'R';
    return { x: left ? (front ? 37 : 17) : (front ? 63 : 83), y: top ? 27 : 73, q: (left ? 'l' : 'r') + (top ? 't' : 'b') };
  }
  function drawCourt(el, i, mode) {
    courtShell(el);
    var pr = ST.pairs[i], su = pr.setup, live = mode === 'play' && su.ok, r = complete(su) ? replay(pr) : null;
    var lastE = live && pr.log.length ? pr.log[r.endAt >= 0 ? r.endAt : pr.log.length - 1] : null;
    el.querySelectorAll('.box').forEach(function (b) { b.classList.remove('serve', 'recv'); });
    var sS = null, sR = null;
    ['a', 'b'].forEach(function (t) {
      [0, 1].forEach(function (k) {
        var tok = el.querySelector('.tok[data-k="' + t + k + '"]');
        if (!tok) { tok = document.createElement('button'); tok.type = 'button'; tok.className = 'tok'; tok.dataset.k = t + k; tok.dataset.team = t; tok.dataset.idx = k; tok.innerHTML = '<i></i><span></span>'; el.appendChild(tok); }
        var nm = first(players(t, i)[k]), x, y, cls = '';
        if (!su.left) { x = t === 'a' ? 30 + k * 12 : 58 + k * 12; y = 50; cls = ' unset'; }
        else if (su.far[t] == null) { var lft = su.left === t; x = lft ? 22 + k * 16 : 62 + k * 16; y = 50; cls = ' unset'; }
        else {
          var court = (r ? r.pos[t].R : rIdx(su, t)) === k ? 'R' : 'L';
          var isS = !!(r && !r.end && t === r.srv && r.server === k), isR = !!(r && !r.end && t !== r.srv && r.receiver === k);
          var sp = spot(su, t, court, isS || isR); x = sp.x; y = sp.y;
          if (isS) { cls += ' srv'; sS = sp; } if (isR) { cls += ' rec'; sR = sp; }
          if (lastE && lastE.w === t && lastE.p === k) cls += ' last';
        }
        cls += su.left ? (su.left === t ? ' s-l' : ' s-r') : ' s-n';
        tok.className = 'tok' + cls; tok.style.left = x + '%'; tok.style.top = y + '%';
        tok.querySelector('i').textContent = nm.charAt(0).toUpperCase(); tok.querySelector('span').textContent = nm;
        if (!live) tok.setAttribute('aria-label', players(t, i)[k] + (su.left ? ' — chạm để đổi trước/sau với đồng đội' : ''));
        if (live) { tok.disabled = !!(r && r.end) || pr.manualEnd; tok.setAttribute('aria-label', players(t, i)[k] + ' — chạm để ghi điểm cho ' + teamName(t)); }
      });
    });
    if (sS) el.querySelector('.box.' + sS.q).classList.add('serve');
    if (sR) el.querySelector('.box.' + sR.q).classList.add('recv');
    var line = el.querySelector('.arrow line'), sh = el.querySelector('.shuttle');
    if (sS && sR) {
      line.setAttribute('x1', sS.x); line.setAttribute('y1', sS.y); line.setAttribute('x2', sR.x); line.setAttribute('y2', sR.y);
      el.querySelector('.arrow').classList.remove('off');
      sh.hidden = false; sh.style.left = (sS.x + (sS.x < 50 ? 7 : -7)) + '%'; sh.style.top = (sS.y + (sS.y < 50 ? -13 : 13)) + '%';
    } else { el.querySelector('.arrow').classList.add('off'); sh.hidden = true; }
  }

  /* ---------- screens ---------- */
  var SCR = { list: 'scrList', pairs: 'scrPairs', setup: 'scrSetup', play: 'scrPlay', end: 'scrEnd', log: 'scrLog', sum: 'scrSum' };
  function show(view, title, backLbl, backTo) {
    VIEW = view;
    Object.keys(SCR).forEach(function (k) { $(SCR[k]).hidden = k !== view; });
    $('title').textContent = title;
    $('back').hidden = !backTo; $('home').hidden = !!backTo; $('backTxt').textContent = backLbl || '';
    $('back').dataset.to = backTo || '';
    window.scrollTo(0, 0); syncClock(); syncLabel();
  }
  $('back').addEventListener('click', function () { go(this.dataset.to); });
  function go(h) { h = String(h).replace(/^#/, ''); if (location.hash.replace('#', '') === h) route(); else location.hash = h; }
  function pairLabel(i) { return 'Cặp ' + (i + 1) + ' · ' + PAIRS[i].join('–'); }
  function status(pr) {
    var r = replay(pr), w = winnerOf(pr), sent = !API ? '' : !needsSend(pr) && pr.sent ? '<em class="ok">✓ đã gửi</em>' : needsSend(pr) ? '<em class="no">chưa gửi</em>' : '';
    if (pr.done && w) return '<b class="st done">Xong ' + r.sc.a + '–' + r.sc.b + '</b><small>' + fmt(tMs(pr)) + ' ' + sent + '</small>';
    if (pr.log.length) return '<b class="st on">Đang đấu ' + r.sc.a + '–' + r.sc.b + '</b><small>' + fmt(tMs(pr)) + ' ' + sent + '</small>';
    return '<b class="st">' + (pr.setup.ok ? 'Đã xếp vị trí' : 'Chưa đấu') + '</b>';
  }
  function renderList() {
    $('modePick').innerHTML = [['live', 'Chính thức', 'Tính vào bảng xếp hạng'], ['demo', 'Demo', 'Tập thử, không tính']].map(function (o) {
      return '<button type="button" data-mode="' + o[0] + '" aria-pressed="' + (MODE === o[0]) + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>';
    }).join('');
    var groups = [['today', 'Hôm nay'], ['past', 'Ngày trước (đánh bù trong tuần)'], ['future', 'Ngày sau']];
    $('mlist').innerHTML = groups.map(function (g) {
      var ms = playable.filter(function (m) { return when(m) === g[0]; }); if (!ms.length) return '';
      return '<h2 class="grp">' + g[1] + '</h2>' + ms.map(function (m) {
        var st = ls(keyOf(m.code)), ps = st && st.pairs && st.pairs.length === PAIRS.length ? st.pairs.map(function (p) { return migrate(Object.assign(blankPair(), p)); }) : [], lk = locked(m);
        var n = ps.filter(function (p) { return p.done; }).length, pc = ps.length ? ps.reduce(function (t, p) { return t + prog(p); }, 0) / PAIRS.length : 0;
        var inner = '<span class="code">' + esc(m.code) + '</span><span class="who"><b>' + esc(teamById[m.a.team].name) + ' vs ' + esc(teamById[m.b.team].name) + '</b><small>' + esc(S.rules.weekday) + ' ' + esc(m.date) + '</small></span>' +
          '<span class="right"><b class="st' + (n === 5 ? ' done' : n ? ' on' : '') + '">' + (lk ? 'Mở ngày ' + esc(m.date.slice(0, 5)) : n === 5 ? 'Xong' : n ? n + '/5 cặp' : 'Chưa ghi') + '</b></span>';
        return lk ? '<div class="row locked" aria-disabled="true">' + inner + '<span></span></div>'
          : '<a class="row" href="#' + esc(m.code) + '">' + inner + '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' + (pc ? bar(pc, n === 5 ? 'done' : '') : '') + '</a>';
      }).join('');
    }).join('') || '<p class="muted">Chưa có trận nào biết đủ hai đội.</p>';
  }
  function renderPairs() {
    $('pairsTitle').textContent = M.code + ' · ' + teamName('a') + ' vs ' + teamName('b');
    $('plist').innerHTML = ST.pairs.map(function (pr, k) {
      var A = players('a', k).map(first).join(' · '), B = players('b', k).map(first).join(' · ');
      return '<a class="row" href="#' + M.code + '/' + (k + 1) + '/' + (pr.done ? 'ket' : pr.setup.ok ? 'diem' : 'vitri') + '"><span class="code">' + PAIRS[k].join('–') + '</span><span class="who"><b>' + esc(A) + '</b><small>vs ' + esc(B) + '</small></span>' +
        '<span class="right">' + status(pr) + '</span><svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>' + (pr.log.length || pr.done ? bar(prog(pr), pr.done ? 'done' : '') : '') + '</a>';
    }).join('');
  }
  function choiceBtns(name, opts, val) {
    return opts.map(function (o) { return '<button type="button" data-' + name + '="' + o[0] + '" aria-pressed="' + (val === o[0]) + '" class="' + (o[2] || '') + '">' + o[1] + '</button>'; }).join('');
  }
  function renderSetup() {
    var pr = ST.pairs[I], su = pr.setup;
    fillFar(su);
    drawCourt($('setupCourt'), I, 'setup');
    $('pickLeft').innerHTML = choiceBtns('left', [['a', esc(teamName('a'))], ['b', esc(teamName('b'))]], su.left);
    $('step3').classList.toggle('off', !su.left);
    $('pickServe').innerHTML = choiceBtns('serve', [['a', esc(teamName('a')), su.left ? (su.left === 'a' ? 's-l' : 's-r') : ''], ['b', esc(teamName('b')), su.left ? (su.left === 'b' ? 's-l' : 's-r') : '']], su.serve);
    var ready = complete(su);
    $('setupWarn').hidden = !pr.log.length;
    $('resetBtn').hidden = !(pr.log.length || pr.done);  // positions alone: leaving without saving clears them
    $('startBtn').disabled = !ready;
    $('startBtn').textContent = pr.log.length ? 'Lưu vị trí, tính điểm tiếp' : 'Bắt đầu tính điểm';
  }
  function renderPlay() {
    var pr = ST.pairs[I], su = pr.setup, r = replay(pr), L = su.left, R = other(L);
    drawCourt($('playCourt'), I, 'play');
    $('call').innerHTML = r.end ? esc(teamName(r.end)) + ' thắng ' + r.sc[r.end] + '–' + r.sc[other(r.end)]
      : '<b>' + esc(first(players(r.srv, I)[r.server])) + '</b> giao · <b>' + r.sc[r.srv] + '–' + r.sc[other(r.srv)] + '</b>';
    [['hitL', L], ['hitR', R]].forEach(function (x) {
      var b = $(x[0]), t = x[1];
      b.dataset.team = t; b.disabled = !!r.end;
      b.innerHTML = '<span class="nm">' + esc(teamName(t)) + (r.srv === t && !r.end ? ' <em>giao</em>' : '') + '</span><b class="sc">' + r.sc[t] + '</b><small>' + esc(players(t, I).map(first).join(' · ')) + '</small><span class="p1">+1</span>' +
        '<span class="tprog"><span class="prog" aria-hidden="true"><i style="width:' + Math.min(100, r.sc[t] / TARGET * 100).toFixed(1) + '%"></i></span><small>' + (r.sc[t] >= TARGET ? 'đủ ' + TARGET : 'còn ' + (TARGET - r.sc[t])) + '</small></span>';
      b.setAttribute('aria-label', 'Ghi 1 điểm cho ' + teamName(t) + ', đang ' + r.sc[t]);
    });
    $('endedNote').hidden = !r.end;
    $('undo').disabled = !pr.log.length;
    $('resetPlay').disabled = !pr.log.length && !su.left;
    $('endBtn').disabled = !!r.end || pr.manualEnd;
    $('hitL').disabled = $('hitR').disabled = !!r.end || pr.manualEnd;
  }
  function renderSide() { if (VIEW === 'pairs') renderPairs(); if (VIEW === 'end') renderEnd(); if (VIEW === 'sum') renderSum(); }
  function renderEnd() {
    if (VIEW !== 'end') return;
    var pr = ST.pairs[I], r = replay(pr), w = winnerOf(pr);
    $('result').innerHTML = '<p class="eyebrow">' + pairLabel(I) + (pr.manualEnd && !r.end ? ' · kết thúc trước 31' : '') + '</p>' +
      '<h1>' + esc(teamName(w)) + ' thắng</h1>' +
      '<div class="final"><span class="' + (w === 'a' ? 'w' : '') + '"><small>' + esc(teamName('a')) + '</small><b>' + r.sc.a + '</b></span><i>–</i><span class="' + (w === 'b' ? 'w' : '') + '"><small>' + esc(teamName('b')) + '</small><b>' + r.sc.b + '</b></span></div>' +
      '<p class="muted">Thời gian thi đấu ' + fmt(tMs(pr)) + ' · ' + pr.log.length + ' pha bóng</p>';
    var c = pr.check || {}, box = $('submit');
    box.className = 'submit ' + (c.state || 'sending');
    box.innerHTML = c.state === 'ok' && c.draft ? '<b>✓ Đã lưu bản nháp · mã #' + esc(pr.report) + '</b><span>Chế độ Demo: kết quả không vào bảng xếp hạng. Nếu đây là trận thật, báo ban tổ chức mã này để chuyển sang chính thức.</span>'
      : c.state === 'ok' ? '<b>✓ Đã lưu lên bảng tính · mã #' + esc(pr.report) + '</b><span>Đã đọc lại và khớp (' + c.a + '–' + c.b + ') lúc ' + clockTime(c.at) + '.</span>'
      : c.state === 'err' ? '<b>Chưa gửi được</b><span>Mất mạng hoặc bảng tính chưa bật phần trọng tài. Điểm vẫn giữ trên máy và tự gửi lại.</span><button type="button" class="link" id="resend">Gửi lại ngay</button>'
      : c.state === 'local' ? '<b>Đã lưu trên máy</b><span>Web chưa nối bảng tính nên kết quả chỉ nằm trên điện thoại này.</span>'
      : '<b>' + (MODE === 'demo' ? 'Đang lưu bản nháp…' : 'Đang gửi lên bảng tính…') + '</b><span>Đợi dấu ✓ rồi hãy sang cặp sau.</span>';
    var rs = $('resend'); if (rs) rs.onclick = function () { submitAndCheck(I); };
    if (c.state === 'err' && MODE === 'demo') box.querySelector('span').textContent = 'Chưa lưu được bản nháp (mất mạng hoặc bảng tính chưa bật). Kết quả vẫn giữ trên máy.';
    var next = ST.pairs.findIndex ? ST.pairs.findIndex(function (p, k) { return k > I && !p.done; }) : -1;
    if (next < 0) next = ST.pairs.findIndex(function (p) { return !p.done; });
    $('nextBtn').textContent = next < 0 ? 'Tổng kết trận' : 'Sang ' + pairLabel(next);
    $('nextBtn').onclick = function () { go(next < 0 ? M.code + '/tong' : M.code + '/' + (next + 1) + '/' + (ST.pairs[next].setup.ok ? 'diem' : 'vitri')); };
  }
  function renderLog() {
    var pr = ST.pairs[I], ex = replay(pr).endAt;
    $('log').innerHTML = pr.log.map(function (e, k) {
      var sc = ex >= 0 && k > ex ? null : replay(pr, k).sc, side = pr.setup.left === e.w ? 's-l' : 's-r';
      return '<li><button type="button" class="lg ' + side + (sc ? '' : ' extra') + '" data-k="' + k + '"><small>#' + (k + 1) + '</small><b>' + (sc ? sc.a + '–' + sc.b : 'thừa') + '</b><span>' + esc(teamName(e.w)) + (e.p != null ? ' · ' + esc(first(players(e.w, I)[e.p])) : '') + '</span></button></li>';
    }).reverse().join('') || '<li class="muted">Chưa có điểm nào.</li>';
  }
  function renderSum() {
    var tot = { a: 0, b: 0 }, won = { a: 0, b: 0 }, ms = 0, all = true, sentAll = true;
    var rows = ST.pairs.map(function (p, k) {
      var r = replay(p), w = winnerOf(p); tot.a += r.sc.a; tot.b += r.sc.b; ms += tMs(p); if (w) won[w]++; if (!p.done) all = false; if (API && needsSend(p)) sentAll = false;
      return '<tr><td>' + PAIRS[k].join('–') + '</td><td class="' + (w === 'a' ? 'w' : '') + '">' + r.sc.a + '</td><td class="' + (w === 'b' ? 'w' : '') + '">' + r.sc.b + '</td><td>' + fmt(tMs(p)) + '</td></tr>';
    });
    var win = tot.a !== tot.b ? (tot.a > tot.b ? 'a' : 'b') : won.a !== won.b ? (won.a > won.b ? 'a' : 'b') : null;
    var json = '"result": {"pairs": [' + ST.pairs.map(function (p) { var r = replay(p); return '[' + r.sc.a + ', ' + r.sc.b + ']'; }).join(', ') + ']}';
    $('sum').innerHTML = '<p class="eyebrow">' + M.code + (all ? ' · đủ 5 cặp' : ' · chưa xong') + '</p><h1>' + (all ? (win ? esc(teamName(win)) + ' thắng trận' : 'Hòa') : 'Tạm tính') + '</h1>' +
      '<table class="sum"><thead><tr><th>Cặp</th><th>' + esc(teamName('a')) + '</th><th>' + esc(teamName('b')) + '</th><th>Giờ</th></tr></thead><tbody>' + rows.join('') +
      '<tr class="tot"><td>Tổng</td><td>' + tot.a + '</td><td>' + tot.b + '</td><td>' + fmt(ms) + '</td></tr><tr><td>Cặp thắng</td><td>' + won.a + '</td><td>' + won.b + '</td><td></td></tr></tbody></table>' +
      (tot.a === tot.b ? '<p class="muted">Bằng tổng điểm nên xét số cặp thắng.</p>' : '') +
      (API ? (sentAll ? '<p class="submit ok"><b>✓ Cả 5 cặp đã lên bảng tính</b></p>' : '<p class="submit err"><b>Còn cặp chưa gửi</b> <button type="button" class="link" id="sumResend">Gửi lại</button></p>') : '') +
      '<p class="muted">Dòng kết quả cho config/schedule.json:</p><pre class="code" id="resJson">' + esc(json) + '</pre><button type="button" class="big ghost" id="copyRes">Chép dòng kết quả</button>';
    $('copyRes').onclick = function () {
      var b = this;
      var sel = function () { var rg = document.createRange(); rg.selectNodeContents($('resJson')); var s = getSelection(); s.removeAllRanges(); s.addRange(rg); };
      try { navigator.clipboard.writeText(json).then(function () { b.textContent = 'Đã chép'; }, sel); } catch (e) { sel(); }
    };
    var rs = $('sumResend'); if (rs) rs.onclick = retryAll;
  }

  /* ---------- actions ---------- */
  var lastTap = 0, toastT;
  function point(t, p) {
    var pr = ST.pairs[I], now = Date.now();
    if (replay(pr).end || pr.manualEnd || now - lastTap < 350) return;  // a double tap must not give two points
    lastTap = now;
    pr.log.push({ w: t, p: p == null ? null : +p });
    if (navigator.vibrate) try { navigator.vibrate(15); } catch (e) {}
    touch(I); renderPlay();
    var r = replay(pr);
    if (r.end) { $('toast').hidden = true; tRun(pr, false); store(); submitAndCheck(I); go(M.code + '/' + (I + 1) + '/ket'); return; }
    $('toastTxt').textContent = '+1 ' + teamName(t) + (p == null ? '' : ' · ' + first(players(t, I)[+p])) + '   ' + r.sc.a + '–' + r.sc.b;
    $('toast').className = 'toast ' + (pr.setup.left === t ? 's-l' : 's-r'); $('toast').hidden = false;
    clearTimeout(toastT); toastT = setTimeout(function () { $('toast').hidden = true; }, 2200);
  }
  function undo() { var pr = ST.pairs[I]; if (!pr.log.length) return; pr.log.pop(); $('toast').hidden = true; touch(I); syncClock(); renderPlay(); }
  $('playCourt').addEventListener('click', function (e) { var b = e.target.closest('.tok'); if (b && !b.disabled) point(b.dataset.team, b.dataset.idx); });
  $('hitL').addEventListener('click', function () { point(this.dataset.team, null); });
  $('hitR').addEventListener('click', function () { point(this.dataset.team, null); });
  $('undo').addEventListener('click', undo);
  $('toastUndo').addEventListener('click', undo);
  $('toLog').addEventListener('click', function () { go(M.code + '/' + (I + 1) + '/cacdiem'); });
  $('seeResult').addEventListener('click', function () { go(M.code + '/' + (I + 1) + '/ket'); });
  $('endBtn').addEventListener('click', function () {
    var pr = ST.pairs[I], r = replay(pr);
    if (r.sc.a === r.sc.b) return sheet('Chưa kết thúc được', '<p>Hai đội đang bằng điểm ' + r.sc.a + '–' + r.sc.b + '. Cần một đội dẫn điểm mới kết thúc cặp trước 31.</p>', [['Tiếp tục tính điểm', closeSheet, 'pri']]);
    sheet('Kết thúc ' + pairLabel(I) + '?', '<p>Tỉ số <b>' + r.sc.a + '–' + r.sc.b + '</b>, ' + esc(teamName(r.sc.a > r.sc.b ? 'a' : 'b')) + ' thắng. Đồng hồ dừng và kết quả được gửi lên bảng tính. Bấm nhầm thì vẫn quay lại tính tiếp được.</p>', [
      ['Kết thúc và lưu', function () { closeSheet(); pr.manualEnd = true; touch(I); tRun(pr, false); store(); submitAndCheck(I); go(M.code + '/' + (I + 1) + '/ket'); }, 'pri'],
      ['Tiếp tục tính điểm', closeSheet]]);
  });
  $('resumeBtn').addEventListener('click', function () {
    var pr = ST.pairs[I];
    if (pr.manualEnd) { pr.manualEnd = false; touch(I); }
    go(M.code + '/' + (I + 1) + '/diem');
  });
  $('modePick').addEventListener('click', function (e) { var b = e.target.closest('button'); if (!b) return; setMode(b.dataset.mode); renderList(); syncLabel(); });
  $('toSum').addEventListener('click', function () { go(M.code + '/tong'); });
  $('log').addEventListener('click', function (e) {
    var b = e.target.closest('.lg'); if (!b) return;
    var k = +b.dataset.k, pr = ST.pairs[I], ev = pr.log[k], sc = replay(pr, k).sc, L = pr.setup.left || 'a';
    /* one tap picks who won the rally: team and player together; later scores and positions recompute */
    var cols = [L, other(L)].map(function (t) {
      return '<div class="wcol ' + (t === L ? 's-l' : 's-r') + '"><span>' + esc(teamName(t)) + '</span>' + players(t, I).map(function (n, p) {
        return '<button type="button" class="wp" data-w="' + t + '" data-p="' + p + '" aria-pressed="' + (ev.w === t && ev.p === p) + '">' + esc(first(n)) + '</button>';
      }).join('') + '</div>';
    }).join('');
    sheet('Điểm #' + (k + 1) + ' (' + sc.a + '–' + sc.b + ')', '<p>Đang ghi cho <b>' + esc(teamName(ev.w)) + (ev.p != null ? ' · ' + esc(first(players(ev.w, I)[ev.p])) : ' (chưa rõ người)') + '</b>. Chạm người ghi điểm đúng:</p><div class="who-pick">' + cols + '</div>', [
      ['Xóa điểm này', function () { pr.log.splice(k, 1); touch(I); syncClock(); closeSheet(); renderLog(); }, 'danger'],
      ['Đóng', closeSheet]]);
    $('sheetBody').querySelectorAll('.wp').forEach(function (w) {
      w.onclick = function () {
        var nw = w.dataset.w, np = +w.dataset.p;
        if (!(ev.w === nw && ev.p === np)) { pr.log[k] = { w: nw, p: np }; touch(I); syncClock(); renderLog(); }
        closeSheet();
      };
    });
  });
  $('scrSetup').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || b.id === 'startBtn' || b.id === 'resetBtn' || b.classList.contains('tok')) return;
    var pr = ST.pairs[I], su = pr.setup;
    if (b.dataset.left) su.left = b.dataset.left;
    if (b.dataset.serve) su.serve = b.dataset.serve;
    fillFar(su); su.ok = false; touch(I); renderSetup();
  });
  $('startBtn').addEventListener('click', function () {
    var pr = ST.pairs[I]; pr.setup.ok = true; touch(I);
    go(M.code + '/' + (I + 1) + (pr.done ? '/ket' : '/diem'));
  });
  /* reset: the pair goes back to "not played" (0–0, no positions, clock 0); the blank row is also sent so other phones and the site follow */
  function askReset() {
    var pr = ST.pairs[I], r = replay(pr);
    sheet('Đặt lại ' + pairLabel(I) + '?', '<p>Xóa hết ' + pr.log.length + ' điểm (đang ' + r.sc.a + '–' + r.sc.b + '), vị trí đứng và đồng hồ. Cặp này về trạng thái chưa đấu' + (MODE === 'live' ? ', bảng tính cũng về 0–0' : '') + '. Không hoàn tác được.</p>', [
      ['Đặt lại về 0', function () { closeSheet(); $('toast').hidden = true; var n = blankPair(); n.sent = pr.sent; ST.pairs[I] = n; touch(I); if (VISIT) { VISIT.sig = sig(n); VISIT.snap = JSON.parse(JSON.stringify(n)); } go(M.code + '/' + (I + 1) + '/vitri'); }, 'danger'],
      ['Không, giữ nguyên', closeSheet]]);
  }
  $('resetBtn').addEventListener('click', askReset);
  $('resetPlay').addEventListener('click', askReset);  // from the scoring screen: after reset, straight back to positions
  /* drag a player onto a court box: the half sets the team's side, top/bottom sets far/near; the partner takes the other box */
  var drag = null;
  function pct(e, rc) { return { x: Math.max(3, Math.min(97, (e.clientX - rc.left) / rc.width * 100)), y: Math.max(6, Math.min(94, (e.clientY - rc.top) / rc.height * 100)) }; }
  $('setupCourt').addEventListener('pointerdown', function (e) {
    var t = e.target.closest('.tok'); if (!t || (e.button && e.button !== 0)) return;
    e.preventDefault();
    drag = { tok: t, rc: this.getBoundingClientRect(), x0: e.clientX, y0: e.clientY, moved: false };
    try { t.setPointerCapture(e.pointerId); } catch (er) {}
  });
  $('setupCourt').addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x0) + Math.abs(e.clientY - drag.y0) < 6) return;
    drag.moved = true; drag.tok.classList.add('drag');
    var q = pct(e, drag.rc); drag.tok.style.left = q.x + '%'; drag.tok.style.top = q.y + '%';
    var box = (q.x < 50 ? 'l' : 'r') + (q.y < 50 ? 't' : 'b');
    this.querySelectorAll('.box').forEach(function (b) { b.classList.toggle('drop', b.classList.contains(box)); });
  });
  function endDrag(e, ok) {
    if (!drag) return;
    var d = drag; drag = null; d.tok.classList.remove('drag');
    $('setupCourt').querySelectorAll('.box').forEach(function (b) { b.classList.remove('drop'); });
    if (ok && d.moved) {
      var q = pct(e, d.rc), t = d.tok.dataset.team, k = +d.tok.dataset.idx, su = ST.pairs[I].setup;
      su.left = q.x < 50 ? t : other(t);
      su.far[t] = q.y < 50 ? k : 1 - k;
      fillFar(su); su.ok = false; touch(I);
    } else if (ok) swapTok(d.tok);
    renderSetup();
  }
  function swapTok(tok) {  // tap a player: swap far/near with the partner
    var su = ST.pairs[I].setup, t = tok.dataset.team; if (!su.left) return;
    fillFar(su); su.far[t] = 1 - su.far[t]; su.ok = false; touch(I);
  }
  $('setupCourt').addEventListener('click', function (e) { var t = e.target.closest('.tok'); if (t && e.detail === 0) { swapTok(t); renderSetup(); } });  // keyboard
  $('setupCourt').addEventListener('pointerup', function (e) { endDrag(e, true); });
  $('setupCourt').addEventListener('pointercancel', function (e) { endDrag(e, false); });
  function sheet(title, body, acts) {
    $('sheetTitle').textContent = title; $('sheetBody').innerHTML = body;
    var box = $('sheetAct'); box.innerHTML = '';
    acts.forEach(function (a) { var b = document.createElement('button'); b.type = 'button'; b.className = 'big ' + (a[2] || 'ghost'); b.textContent = a[0]; b.onclick = function () { a[1](b); }; box.appendChild(b); });
    $('sheet').hidden = false; box.firstChild.focus();
  }
  function closeSheet() { $('sheet').hidden = true; }
  $('sheet').addEventListener('click', function (e) { if (e.target.id === 'sheet') closeSheet(); });

  /* ---------- routing: #T1 · #T1/2/vitri · #T1/2/diem · #T1/2/cacdiem · #T1/2/ket · #T1/tong ---------- */
  var wake = null;
  function keepAwake() { try { if (navigator.wakeLock && !wake) navigator.wakeLock.request('screen').then(function (w) { wake = w; w.addEventListener('release', function () { wake = null; }); }).catch(function () {}); } catch (e) {} }
  /* leaving a pair that changed during this visit asks first: "Thoát, không lưu" puts the pair back as it was on entry
     (a phone opened by mistake, or a second person on the same pair, leaves it "Chưa đấu"). A finished pair never asks. */
  function sig(pr) { return JSON.stringify([pr.setup.left, pr.setup.far, pr.setup.serve, pr.setup.ok, pr.log, !!pr.manualEnd]); }
  function leaving(h) { var p = h.split('/'); return !(p[0] === VISIT.code && +p[1] - 1 === VISIT.i && MODE === VISIT.mode); }
  function dirty() { var pr = ST.pairs[VISIT.i]; return !pr.done && sig(pr) !== VISIT.sig; }
  function markVisit() { var pr = ST.pairs[I]; VISIT = { code: M.code, i: I, mode: MODE, sig: sig(pr), snap: JSON.parse(JSON.stringify(pr)), here: location.hash.replace('#', '') }; }
  function askLeave(target) {
    var i = VISIT.i, sn = VISIT.snap, blank = !sn.log.length && !sn.setup.ok;
    sheet('Thoát ' + pairLabel(i) + '?', '<p>' + (blank ? 'Không lưu: cặp vẫn <b>Chưa đấu</b>.' : 'Không lưu: cặp trở lại <b>' + replay(sn).sc.a + '–' + replay(sn).sc.b + '</b> như lúc vào.') + '</p>', [
      ['Thoát, không lưu', function () {
        closeSheet(); var pr = ST.pairs[i], n = JSON.parse(JSON.stringify(sn));
        n.timer.since = null; n.sent = pr.sent; n.check = null; ST.pairs[i] = n;
        if (pr.sent > sn.sent || needsSend(pr)) touch(i); else store();  // only what already reached the sheet is sent back
        VISIT.allow = true; go(target);
      }, 'danger'],
      ['Lưu và thoát', function () { closeSheet(); VISIT.allow = true; go(target); }, 'pri'],
      ['Ở lại', closeSheet]]);
  }
  function route() {
    var target = location.hash.replace('#', '');
    if (VISIT && !VISIT.allow && M && ST && M.code === VISIT.code && leaving(target) && dirty()) {
      try { history.pushState(null, '', '#' + VISIT.here); } catch (e) {}
      return askLeave(target);
    }
    closeSheet(); $('toast').hidden = true;
    var parts = location.hash.replace('#', '').split('/'), m = playable.filter(function (x) { return x.code === parts[0]; })[0];
    if (m && locked(m)) m = null;  // a later match cannot be opened in official mode, even from an old link
    if (!m) { if (ST) syncClock(); M = null; ST = null; VISIT = null; renderList(); return show('list', 'Trọng tài'); }
    if (M && ST && M.code === m.code && ST.mode !== MODE) M = null;  // mode switched: load the other copy
    if (!M || M.code !== m.code) { if (ST) { VIEW = 'list'; syncClock(); } M = m; ST = loadState(m.code); ['setupCourt', 'playCourt'].forEach(function (id) { $(id).innerHTML = ''; delete $(id).dataset.ready; }); pullServer(m.code); }
    if (parts[1] === 'tong') { VISIT = null; renderSum(); return show('sum', 'Tổng kết ' + M.code, 'Các cặp', M.code); }
    var i = +parts[1] - 1;
    if (!(i >= 0 && i < PAIRS.length)) { VISIT = null; renderPairs(); return show('pairs', M.code, 'Các trận', '#'); }
    if (I !== i) { $('playCourt').innerHTML = ''; delete $('playCourt').dataset.ready; $('setupCourt').innerHTML = ''; delete $('setupCourt').dataset.ready; }
    I = i; var pr = ST.pairs[I], view = parts[2] || 'vitri';
    if (view !== 'vitri' && !pr.setup.ok) return location.replace('#' + M.code + '/' + (I + 1) + '/vitri');
    if (view === 'ket' && !pr.done) return location.replace('#' + M.code + '/' + (I + 1) + '/diem');
    if (!VISIT || VISIT.allow || VISIT.code !== M.code || VISIT.i !== I || VISIT.mode !== MODE) markVisit(); else VISIT.here = location.hash.replace('#', '');
    if (view === 'vitri') { show('setup', pairLabel(I) + ' · xếp vị trí', 'Các cặp', M.code); return renderSetup(); }
    if (view === 'diem' && pr.manualEnd) { pr.manualEnd = false; touch(I); }  // coming back from "Kết thúc" by any path = scoring resumes
    if (view === 'diem') { show('play', pairLabel(I), 'Vị trí', M.code + '/' + (I + 1) + '/vitri'); keepAwake(); return renderPlay(); }
    if (view === 'cacdiem') { show('log', pairLabel(I), 'Tính điểm', M.code + '/' + (I + 1) + '/diem'); return renderLog(); }
    if (view === 'ket') { show('end', pairLabel(I) + ' · kết quả', 'Tính điểm', M.code + '/' + (I + 1) + '/diem'); if (!pr.check && API && (MODE === 'demo' || pr.updated > pr.sent)) submitAndCheck(I); return renderEnd(); }
    renderPairs(); show('pairs', M.code, 'Các trận', '#');
  }
  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', function () { if (document.hidden) { if (ST) store(); } else if (M) { retryAll(); pullServer(M.code); } });
  /* light / dark: same choice as the main site (localStorage 'gcl-theme'); follows the phone until picked */
  (function () {
    var root = document.documentElement, btn = $('themeBtn'), mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : !!(mq && mq.matches); }
    function paint() { var d = isDark(); root.classList.toggle('is-dark', d); btn.setAttribute('aria-label', d ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'); btn.setAttribute('aria-pressed', String(d)); }
    btn.addEventListener('click', function () { var next = isDark() ? 'light' : 'dark'; root.setAttribute('data-theme', next); try { localStorage.setItem('gcl-theme', next); } catch (e) {} paint(); });
    if (mq && mq.addEventListener) mq.addEventListener('change', paint);
    paint();
  })();
  route();
})();
