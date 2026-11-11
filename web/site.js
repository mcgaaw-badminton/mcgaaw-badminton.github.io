(function () {
  'use strict';
  var S = window.SITE;
  var $ = function (id) { return document.getElementById(id); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var SHUTTLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8.5 16.5 5 3h14l-3.5 13.5"/><path d="M10 3l.8 13.5M14 3l-.8 13.5M6.2 7.5h11.6M7.3 12h9.4"/><path d="M8.5 16.5h7v1.5a3.5 3.5 0 0 1-7 0z"/></svg>';
  var ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  var CHEV = '<svg class="go" viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';

  /* ---------- data helpers ---------- */
  var teamById = {}, byCode = {};
  S.teams.forEach(function (t) { teamById[t.id] = t; });
  S.matches.forEach(function (m) { byCode[m.code] = m; });
  var finalM = byCode[S.bracket.final];
  var PLAYERS = (S.stats && S.stats.players) || [];
  function sideName(s) { return s.team ? teamById[s.team].name : s.label; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dateOf(m) { var p = m.iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function status(m) { var d = dateOf(m), t = today(); return m.result ? 'done' : d < t ? 'wait' : +d === +t ? 'today' : 'up'; }
  var ST = { done: ['Đã đấu', 'done'], wait: ['Chờ kết quả', 'lose'], today: ['Hôm nay', 'win'], up: ['Sắp diễn ra', 'win'], live: ['Đang đấu', 'live'], locked: ['Đã chốt', 'done'], ready: ['Chờ chốt', 'live'] };
  function tagCls(m) { return m.branch === 'lose' ? 'tag lose' : m.branch === 'final' ? 'tag final' : 'tag'; }
  var days = [];
  S.matches.forEach(function (m) { if (days.indexOf(m.iso) < 0) days.push(m.iso); });
  var dayInfo = days.map(function (iso) {
    var ms = S.matches.filter(function (m) { return m.iso === iso; });
    return { iso: iso, matches: ms, day: ms[0].day, label: ms[0].date.slice(0, 5), done: ms.every(function (m) { return m.result; }) };
  });
  var played = S.matches.filter(function (m) { return m.winner; }).length;
  var upcoming = S.matches.filter(function (m) { return !m.result && dateOf(m) >= today(); });
  var nextM = upcoming[0];
  var nextDayIdx = nextM ? days.indexOf(nextM.iso) : days.length - 1;

  var rec = {};
  S.teams.forEach(function (t) { rec[t.id] = { w: 0, l: 0 }; });
  S.matches.forEach(function (m) {
    if (!m.winner) return;
    var w = m[m.winner].team, l = m[m.winner === 'a' ? 'b' : 'a'].team;
    rec[w].w++; rec[l].l++;
  });
  function teamState(id) {
    if (finalM && finalM.winner) {
      if (finalM[finalM.winner].team === id) return ['Vô địch', 'champ', 0];
      if (finalM[finalM.winner === 'a' ? 'b' : 'a'].team === id) return ['Á quân', 'win', 1];
    }
    var l = rec[id].l;
    if (l >= 2) return ['Đã dừng', 'out', 4];
    if (l === 1) return ['Nhánh thua', 'lose', 3];
    return ['Nhánh thắng', 'win', 2];
  }

  /* ---------- player tags (defined before any renderer uses them) ---------- */
  var HEART = '<svg class="fh" viewBox="0 0 24 24" aria-label="Nữ" role="img"><path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21z"/></svg>';
  function isFemale(n) { return /(^|\s)Thị(\s|$)/.test(String(n).normalize('NFC')); }
  function seedTag(i) { return '<span class="seed-tag s' + i + '" aria-label="Seed ' + i + '">' + i + '</span>'; }
  /* last season's champions: gold cup label (config/teams.json past_champions) */
  var CHAMPS = S.champions || [];
  var CUP = '<svg class="cup" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v3a5 5 0 0 1-10 0V4zM7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3M12 12v4M8.5 20h7M10 16h4l.5 4h-5z"/></svg>';
  function isChamp(n) { return CHAMPS.indexOf(n) >= 0; }
  function champTag() { return '<span class="champ" title="Vô địch mùa trước">' + CUP + 'Champion</span>'; }

  /* ---------- top-1 animated badges (GOAT stats + Flower leader) ---------- */
  var GOAT_BADGES = (function () {
    var byNameAndType = {};
    var cats = (S.goat && S.goat.cats) || [];
    var ICONS = {
      atk: {
        cls: 'ico-atk anim-smash',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="17" cy="17" r="3"/><path d="M14.5 14.5L6 6M6 6h6M6 6v6"/></svg>'
      },
      sup: {
        cls: 'ico-sup anim-wing',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 15c3-4 6-4 8-1 2-3 5-3 8 1"/><circle cx="12" cy="8" r="2.5"/></svg>'
      },
      diff: {
        cls: 'ico-diff anim-rise',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>'
      },
      eff: {
        cls: 'ico-eff anim-target',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><circle cx="12" cy="12" r="7"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="2" fill="currentColor"/></svg>'
      },
      rate: {
        cls: 'ico-rate anim-star',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l2.6 6.6L21 11l-6.4 2.4L12 20l-2.6-6.6L3 11l6.4-2.4L12 2z"/></svg>'
      },
      pa: {
        cls: 'ico-pa anim-shield',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1"><path d="M12 3l7 3v6c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6l7-3z"/></svg>'
      },
      run: {
        cls: 'ico-run anim-bolt',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>'
      },
      heat: {
        cls: 'ico-heat anim-flame',
        svg: '<svg class="ico-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2c1.5 3.5 4.5 5.5 4.5 9.5a4.5 4.5 0 0 1-9 0c0-2.2 1.2-4.1 2.5-5.5 0 2 1.5 3 2 1-0.5-2 0-3.5 0-5z"/></svg>'
      }
    };
    function detectType(title) {
      if (title.indexOf('Tấn công') >= 0) return 'atk';
      if (title.indexOf('Hỗ trợ') >= 0) return 'sup';
      if (title.indexOf('Hiệu số') >= 0) return 'diff';
      if (title.indexOf('Hiệu suất') >= 0) return 'eff';
      if (title.indexOf('thắng') >= 0 || title.indexOf('Thắng') >= 0) return 'rate';
      if (title.indexOf('Thủng lưới') >= 0 || title.indexOf('thua') >= 0 || title.indexOf('Phòng thủ') >= 0) return 'pa';
      if (title.indexOf('Chuỗi') >= 0) return 'run';
      if (title.indexOf('Nhiệt') >= 0 || title.indexOf('Nóng') >= 0) return 'heat';
      return null;
    }
    cats.forEach(function (c) {
      var t = detectType(c.title);
      if (!t || !ICONS[t]) return;
      var info = ICONS[t];
      var tip = c.title + ': ' + (c.value || '');
      var badge = '<span class="top-ico ' + info.cls + '" title="' + esc(tip) + '" aria-label="' + esc(tip) + '">' + info.svg + '</span>';
      var names = [c.name].concat(c.tie || []);
      names.forEach(function (nm) {
        if (!nm) return;
        if (!byNameAndType[nm]) byNameAndType[nm] = {};
        byNameAndType[nm][t] = badge;
      });
    });

    var FLOWER_SVG = '<span class="top-ico ico-flower anim-flower" title="Dẫn đầu bảng hoa: {n} bông" aria-label="Dẫn đầu bảng hoa">' +
      '<svg class="ico-svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a3 3 0 0 1 3 3c0 1.2-.7 2.2-1.7 2.7.9.5 1.7 1.3 2 2.3.9-.7 2.1-.9 3.2-.4a3 3 0 0 1-1.2 5.8c-1.2 0-2.2-.7-2.7-1.7-.5.9-1.3 1.7-2.3 2 .7.9.9 2.1.4 3.2a3 3 0 0 1-5.8-1.2c0-1.2.7-2.2 1.7-2.7-.9-.5-1.7-1.3-2-2.3-.9.7-2.1.9-3.2.4a3 3 0 0 1 1.2-5.8c1.2 0 2.2.7 2.7 1.7.5-.9 1.3-1.7 2.3-2-.7-.9-.9-2.1-.4-3.2A3 3 0 0 1 12 2z"/></svg></span>';

    return {
      detectType: detectType,
      get: function (name, metricFilter) {
        var userBadges = byNameAndType[name] || {};
        // If a specific metric filter is requested (e.g. state.metric in BXH):
        if (metricFilter) {
          if (metricFilter === 'eggs') {
            try {
              if (typeof EGG !== 'undefined') {
                var best = 0, leadName = null;
                PLAYERS.forEach(function (p) {
                  var n = EGG.get(p.id);
                  if (n > best) { best = n; leadName = p.name; }
                });
                if (best > 0 && leadName === name) {
                  return FLOWER_SVG.replace('{n}', best);
                }
              }
            } catch (e) {}
            return '';
          }
          // For any other metric: return ONLY that metric's badge, NEVER flower or other stats!
          return userBadges[metricFilter] || '';
        }

        // When NO filter is specified (e.g. Schedule pairs or Profile modal):
        // Show at most 1 signature GOAT badge so badges NEVER overlap or crowd each other!
        var ORDER = ['heat', 'atk', 'diff', 'sup', 'eff', 'rate', 'pa', 'run'];
        for (var i = 0; i < ORDER.length; i++) {
          if (userBadges[ORDER[i]]) return userBadges[ORDER[i]];
        }
        return '';
      }
    };
  })();

  function marks(n) {
    return (isFemale(n) ? HEART : '') +
           (isChamp(n) ? '<span class="cup-i" title="Vô địch mùa trước">' + CUP + '</span>' : '') +
           GOAT_BADGES.get(n);
  }
  /* name chip: tappable in the schedule (pick + highlight), plain glass chip elsewhere (hover shows heat) */
  function pn(n, cls) { return '<button type="button" class="pn' + (cls ? ' ' + cls : '') + '" data-p="' + esc(n) + '">' + esc(n) + marks(n) + '</button>'; }
  function pnPlain(n, cls) { return '<span class="pn plain' + (cls ? ' ' + cls : '') + '" data-h="' + esc(n) + '" tabindex="0">' + esc(n) + marks(n) + '</span>'; }
  function femTag() { return '<span class="fem">' + HEART.replace('aria-label="Nữ" role="img"', 'aria-hidden="true"') + 'Nữ</span>'; }

  var FXI = window.FX_INLINE || {};
  /* flowers (v1.22.0, replaced the rotten eggs; ids, counts and the Apps Script board stay the same) */
  var FH = window.FlowerHeads || null;
  function hseed(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function flowerIcon(id, size) { return FH ? FH.svg(hseed(id), { size: size || 20 }).replace('class="fh"', 'class="fh egg-i"').replace('role="img" aria-label="Hoa"', 'aria-hidden="true"') : ''; }
  /* ---------- flowers (ex rotten eggs): shared counter per player (Google Sheet behind an Apps Script web app; local-only when not configured) ---------- */
  /* referees' official scores (Apps Script ?ref=all), shown on the match cards while a match is played and until the build after the referee's "Chốt"
     puts the result into the standings. Only matches without a result in the build are touched. */
  var REF = (function () {
    var api = (S.meta && S.meta.eggs && S.meta.eggs.api) || '', data = {}, finals = {}, busy = false;
    var want = S.matches.some(function (m) { return !m.result && m.a.team && m.b.team && dateOf(m) <= today(); });
    function apply() {
      document.querySelectorAll('.ref-live[data-ref]').forEach(function (el) {
        var code = el.dataset.ref, m = S.matches.filter(function (x) { return x.code === code; })[0], rows = data[code];
        var badge = document.querySelector('[data-badge="' + code + '"]');
        if (!m || m.result || !rows) { el.hidden = true; return; }
        var n = S.pairs.length, done = 0, ta = 0, tb = 0, parts = [];
        for (var k = 1; k <= n; k++) {
          var r = rows[String(k)]; if (!r || (!r.done && !r.a && !r.b)) continue;  // a pair reset by the referee counts as not played
          ta += r.a; tb += r.b; if (r.done) done++;
          parts.push('<span class="' + (r.done ? 'd' : 'p') + '">' + S.pairs[k - 1].join('–') + ': ' + r.a + '–' + r.b + '</span>');
        }
        if (!parts.length) { el.hidden = true; return; }
        var fin = finals[code], k2 = fin ? 'locked' : done === n ? 'ready' : 'live';
        el.hidden = false;
        el.innerHTML = '<b>' + (fin ? 'Trọng tài đã chốt · tổng ' + fin.a + '–' + fin.b : (done === n ? 'Xong ' + n + '/' + n + ' cặp, chờ trọng tài chốt' : 'Đang đấu · xong ' + done + '/' + n + ' cặp') + ' · tổng ' + ta + '–' + tb) + '</b>' + parts.join('') +
          (fin ? '<small>Lịch và bảng xếp hạng cập nhật trong ít phút.</small>' : '');
        if (badge) { var st = ST[k2]; badge.className = 'badge ' + st[1]; badge.textContent = st[0]; }
      });
    }
    function pull() {
      if (!api || !want || busy || document.hidden) return;
      busy = true;
      fetch(api + '?ref=all').then(function (r) { return r.json(); }).then(function (d) { if (d && d.matches) { data = d.matches; finals = d.finals || {}; apply(); } })
        .catch(function () {}).then(function () { busy = false; });
    }
    if (api && want) { pull(); setInterval(pull, 30000); document.addEventListener('visibilitychange', pull); }
    return { apply: apply };
  })();

  var EGG = (function () {
    var cfg = (S.meta && S.meta.eggs) || {}, api = cfg.api || '', limit = +cfg.limit || 0;
    var counts = {}, pending = {}, inflight = {}, subs = [], timer = null, state = api ? 'connecting' : 'local';
    var LKEY = 'gcl-eggs', DKEY = 'gcl-eggs-day', CKEY = 'gcl-eggs-last';
    function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
    counts = (api ? ls(CKEY) : ls(LKEY)) || {};  // last known board shows instantly, the server refreshes it
    function emit() { subs.forEach(function (f) { try { f(); } catch (e) {} }); }
    function get(id) { return (counts[id] || 0) + (pending[id] || 0) + (inflight[id] || 0); }
    function usedToday() { var d = ls(DKEY); return d && d.day === new Date().toDateString() ? d.n : 0; }
    function left() { return limit ? Math.max(0, limit - usedToday()) : Infinity; }
    var seq = 0, applied = 0, TS = '', PASS = '', asking = false;
    var SITEKEY = (S.meta && S.meta.protect && S.meta.protect.sitekey) || '';
    /* busy server: it may ask for a Cloudflare Turnstile check (only when it is configured); one check gives a 30-min pass */
    function challenge() {
      if (asking || !SITEKEY) return; asking = true;
      var ov = document.createElement('div'); ov.className = 'ts-ov';
      ov.innerHTML = '<div class="ts-card glass" role="dialog" aria-modal="true"><b>Xác nhận bạn không phải máy</b><small>Đang có rất nhiều lượt tặng hoa. Xác nhận một lần để tặng tiếp.</small><div class="ts-box"></div><button type="button" class="ts-x">Để sau</button></div>';
      document.body.appendChild(ov);
      function done() { asking = false; ov.remove(); }
      ov.querySelector('.ts-x').onclick = done;
      function render() { window.turnstile.render(ov.querySelector('.ts-box'), { sitekey: SITEKEY, callback: function (t) { TS = t; done(); clearTimeout(timer); flush(); } }); }
      if (window.turnstile) return render();
      var sc = document.createElement('script'); sc.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; sc.async = true; sc.onload = render; sc.onerror = done; document.head.appendChild(sc);
    }
    function take(d, n) {
      if (!d || typeof d !== 'object' || d.error) return;
      if (n !== undefined) { if (n < applied || Object.keys(inflight).length) return; applied = n; }  // never let an older read undo newer throws
      Object.keys(d).forEach(function (k) { if (typeof d[k] === 'number') counts[k] = d[k]; });
      state = 'live'; ls(CKEY, counts); emit();
    }
    function hit(id) {
      if (!left()) return false;
      if (limit) ls(DKEY, { day: new Date().toDateString(), n: usedToday() + 1 });
      pending[id] = (pending[id] || 0) + 1;
      emit();
      clearTimeout(timer); timer = setTimeout(flush, 350);
      return true;
    }
    function flush(beacon) {
      if (Object.keys(inflight).length && !beacon) { clearTimeout(timer); timer = setTimeout(flush, 800); return; }
      var batch = pending; pending = {};
      var ids = Object.keys(batch); if (!ids.length) return;
      if (!api) { ids.forEach(function (id) { counts[id] = (counts[id] || 0) + batch[id]; }); ls(LKEY, counts); emit(); return; }
      var extra = {}; if (TS) extra._ts = TS; if (PASS) extra._pass = PASS;
      var body = JSON.stringify(Object.assign({}, batch, extra));
      if (beacon) { try { navigator.sendBeacon(api, new Blob([body], { type: 'text/plain' })); } catch (e) {} return; }
      inflight = batch;
      fetch(api, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) {
          if (d && d.error === 'captcha') { TS = ''; challenge(); throw new Error('captcha'); }
          if (!d || d.error) throw new Error('bad');
          if (d._pass) PASS = d._pass; TS = '';
          inflight = {}; applied = ++seq; take(d); setTimeout(flush, 0);
        })
        .catch(function () {  // keep the throws and retry a little later
          ids.forEach(function (id) { pending[id] = (pending[id] || 0) + batch[id]; }); inflight = {};
          clearTimeout(timer); timer = setTimeout(flush, 5000);
        });
    }
    window.addEventListener('pagehide', function () { flush(true); });
    /* refresh fast (every 4 s) while an egg board is on screen, slowly (20 s) otherwise */
    var busy = false, lastPull = 0;
    function onScreen() {
      if ($('pFocus') && !$('pFocus').hidden) return true;
      var b = $('bxh'); if (!b) return false; var r = b.getBoundingClientRect();
      return r.bottom > 0 && r.top < innerHeight;
    }
    function pull() {
      if (!api || document.hidden || busy) return;
      busy = true; lastPull = Date.now(); var n = ++seq;
      fetch(api).then(function (r) { return r.json(); }).then(function (d) { take(d, n); })
        .catch(function () { if (state !== 'live') { state = 'offline'; emit(); } })
        .then(function () { busy = false; });
    }
    if (api) {
      pull();
      setInterval(function () { if (Date.now() - lastPull >= (onScreen() ? 4000 : 20000)) pull(); }, 1000);
      document.addEventListener('visibilitychange', pull);
    }
    return { get: get, hit: hit, left: left, limit: limit, on: function (f) { subs.push(f); }, state: function () { return state; } };
  })();
  /* bouquets count only flowers given after the switch: base = each player's egg total then (config/site.json eggs.flower_base) */
  var FBASE = (S.meta && S.meta.eggs && S.meta.eggs.base) || {};
  function fresh(id) { return Math.max(0, EGG.get(id) - (FBASE[id] || 0)); }
  function bqOf(id) { return Math.floor(fresh(id) / 10); }
  function bqInner(id) { var b = bqOf(id); return b && FH ? FH.posy(hseed(id + 'b'), { size: 20 }).replace('role="img" aria-label="Bó hoa"', 'aria-hidden="true"') + '×' + b : ''; }
  function bqChip(id) { var b = bqOf(id); return '<span class="fl-bq' + (b ? '' : ' none') + '" data-egg-f="' + esc(id) + '" data-b="' + b + '" title="' + b + ' bó hoa (10 bông = 1 bó)">' + bqInner(id) + '</span>'; }
  function eggBtn(id, name, cls) {
    var n = EGG.get(id);
    return '<button type="button" class="egg-btn' + (cls ? ' ' + cls : '') + '" data-egg="' + esc(id) + '" aria-label="Tặng hoa cho ' + esc(name) + ' (đã có ' + n + ' bông)">' +
      flowerIcon(id, 22) + '<span class="egg-say">Tặng</span><b class="egg-n" data-egg-n="' + esc(id) + '">' + n + '</b>' + bqChip(id) + '</button>';
  }
  function refreshEggs() {
    document.querySelectorAll('[data-egg-n]').forEach(function (el) { var n = EGG.get(el.dataset.eggN); if (el.textContent !== String(n)) el.textContent = n; });
    document.querySelectorAll('[data-egg-f]').forEach(function (el) { var id = el.dataset.eggF, b = bqOf(id); if (el.dataset.b === String(b)) return; el.dataset.b = b; el.classList.toggle('none', !b); el.title = b + ' bó hoa (10 bông = 1 bó)'; el.innerHTML = bqInner(id); });
  }
  EGG.on(refreshEggs);

  /* throw a flower: a random FlowerHeads flower (seeded generator, assets/vendor/flower-heads.js) flies in a GSAP arc from the mascot,
     opens on the button and bursts into petals in its own colours (canvas-confetti). Every 10 new flowers for a player = 1 bouquet
     (counted from the egg total at the switch, meta.eggs.base). 3 quick taps on one player = streak: the page dims, the robot and a big
     flower stand side by side; 50 in one streak → the robot grows, gets angry and locks flowers for 10 s. Sounds are generated (Web Audio),
     the robot can read its lines (browser voice, vi-VN only); one mute button silences both (localStorage gcl-mute). */
  var G = window.gsap, boom = window.confetti && !reduce ? confetti.create(null, { resize: true, useWorker: true, disableForReducedMotion: true }) : null;
  var PETAL = window.confetti && confetti.shapeFromPath ? [confetti.shapeFromPath({ path: 'M0 0 C5 -7 15 -7 20 0 C15 7 5 7 0 0 Z' }), confetti.shapeFromPath({ path: 'M0 0 C3 -9 13 -10 18 -2 C14 6 5 7 0 0 Z' })] : ['circle'];
  var TEAMC = { 1: ['#2F45F0', '#C9D1FF'], 2: ['#B0285E', '#F6C9DA'], 3: ['#157A4A', '#BFE6D2'], 4: ['#B8924A', '#F1E2BF'], 5: ['#6A3FC2', '#DCCDF6'], 6: ['#1F7A8C', '#C2E6EC'] };
  var flying = 0;
  function petals(x, y, n, cols) { if (boom) boom({ particleCount: n, spread: 360, startVelocity: 14, gravity: .55, decay: .9, ticks: 120, scalar: 1.1, shapes: PETAL, colors: cols, origin: { x: x / innerWidth, y: y / innerHeight }, zIndex: 120, disableForReducedMotion: true }); }
  function shower(n) {
    if (!boom) return;
    for (var i = 0; i < 4; i++) setTimeout(function () { boom({ particleCount: n, angle: 270, spread: 160, startVelocity: 6, gravity: .32, decay: .96, ticks: 420, scalar: 1.25, drift: Math.random() * 1.2 - .6, shapes: PETAL, colors: ['#FF8FB1', '#FFD1DE', '#FFC531', '#9B7BE0', '#FFFFFF', '#E0245E'], origin: { x: Math.random(), y: -.05 }, zIndex: 120, disableForReducedMotion: true }); }, i * 180);
  }

  /* ---------- sound + voice, one mute switch ---------- */
  var AUD = (function () {
    var muted = (function () { try { return localStorage.getItem('gcl-mute') === '1'; } catch (e) { return false; } })(), ac = null, vi = null, subs = [];
    function ctx() { if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; } } if (ac && ac.state === 'suspended') ac.resume(); return ac; }
    function tone(f, t0, d, type, vol) {
      var a = ctx(); if (!a) return; var o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol || .15, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(a.destination); o.start(t); o.stop(t + d + .05);
    }
    var FX = {
      pop: function () { tone(880 + Math.random() * 220, 0, .09, 'triangle', .06); },
      bq: function () { [1046.5, 1318.5, 1568].forEach(function (f, i) { tone(f, i * .09, .5, 'sine', .14); tone(f * 2, i * .09, .25, 'sine', .035); }); },
      angry: function () { tone(110, 0, .5, 'sawtooth', .11); tone(116, 0, .5, 'sawtooth', .09); tone(82, .45, .6, 'sawtooth', .11); tone(87, .45, .6, 'square', .05); }
    };
    function pickVoice() { if (window.speechSynthesis) vi = speechSynthesis.getVoices().filter(function (v) { return /^vi/i.test(v.lang); })[0] || null; }
    if (window.speechSynthesis) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
    return {
      fx: function (k) { if (!muted && FX[k]) try { FX[k](); } catch (e) {} },
      talk: function (t) {
        if (muted || !vi || !t) return;
        try { speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(t); u.voice = vi; u.lang = vi.lang; u.rate = 1.05; u.pitch = 1.25; speechSynthesis.speak(u); } catch (e) {}
      },
      muted: function () { return muted; },
      toggle: function () {
        muted = !muted; try { localStorage.setItem('gcl-mute', muted ? '1' : '0'); } catch (e) {}
        if (muted && window.speechSynthesis) speechSynthesis.cancel();
        subs.forEach(function (f) { f(muted); });
      },
      on: function (f) { subs.push(f); }
    };
  })();
  var MUTE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="spk" d="M4 9h4l5-4v14l-5-4H4z"/><path class="wav" d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/><path class="off" d="M16 9l5 6M21 9l-5 6"/></svg>';
  function muteBtn(cls) { return '<button type="button" class="mute-btn ' + (cls || '') + '" aria-pressed="' + AUD.muted() + '" aria-label="Tắt / bật tiếng robot">' + MUTE_SVG + '</button>'; }
  document.addEventListener('click', function (e) { var b = e.target.closest && e.target.closest('.mute-btn'); if (!b) return; e.stopPropagation(); AUD.toggle(); });
  document.querySelectorAll('.mute-btn').forEach(function (b) { b.setAttribute('aria-pressed', AUD.muted()); });
  AUD.on(function (m) { document.querySelectorAll('.mute-btn').forEach(function (b) { b.setAttribute('aria-pressed', m); }); if (!m) AUD.fx('pop'); });

  /* ---------- robot lines ---------- */
  var LINES = {
    first: ['Bông đầu tiên cho {name}! Thêm {left} bông nữa là thành một bó.', 'Mở hàng rồi! {name} nhận bông hoa đầu tiên của bạn.'],
    near: ['Còn 1 bông nữa là {name} có bó hoa!', 'Một bông nữa thôi, gói bó cho {name} nào.'],
    bq: ['Ting! Bó hoa thứ {b} cho {name}.', '{name} nhận bó thứ {b}. Fan cứng đây rồi!', '10 bông gói thành bó thứ {b} cho {name}.'],
    over: ['{name} vừa vượt {other} về hoa: {a} vs {c}.', 'Đảo chiều! {name} ({a}) qua mặt {other} ({c}).'],
    tie: ['{name} và {other} đang hòa, {a} bông mỗi người. Ai phá thế hòa?'],
    focus: ['Bạn tặng {name} {mine} bông rồi đó. Chia cho đồng đội khác chút nhé?', '{name} nhận đủ rồi, ngó qua mấy bạn ít hoa xem.'],
    fan: ['Bạn đã tặng {total} bông, đúng là fan cứng của giải.'],
    streak: ['Chuỗi {a} bông cho {name}! Tay nhanh ghê.', '{name} vừa nhận một trận mưa hoa: {a} bông liền tay.'],
    lock: ['Đủ rồi đó! 50 bông liền tay, hết hoa cho cả giải luôn. Khóa 10 giây!', 'Dừng tay! Vườn hoa trụi lủi rồi. Nghỉ 10 giây cho hoa mọc lại!'],
    unlock: ['Hết giận rồi. Tặng tiếp nhưng nhẹ tay thôi nha.', 'Hoa mọc lại rồi, mời tặng tiếp.'],
    locked: ['Còn đang khóa mà, đợi {s} giây nữa!']
  };
  function line(k, v) { var a = LINES[k], t = a[Math.floor(Math.random() * a.length)]; return t.replace(/\{(\w+)\}/g, function (_, x) { return v && v[x] !== undefined ? v[x] : ''; }); }
  var saidAt = {};
  function once(key, gap) { var t = Date.now(); if (saidAt[key] && t - saidAt[key] < gap) return false; saidAt[key] = t; return true; }
  function say(k, v, mood) { var t = line(k, v); if (window.mascotSay) mascotSay(t, mood); AUD.talk(t); return t; }

  var mine = {}, mineTotal = 0;
  function nameOf(id) { var p = PLAYERS.filter(function (x) { return x.id === id; })[0]; return p ? p.name : ''; }
  function teamOf(id) { return +String(id).split('-')[0] || 1; }
  /* what the robot says after one flower lands (one line at most, combo first) */
  function react(id, before) {
    var n = EGG.get(id), v = { name: nameOf(id), a: n, b: bqOf(id), left: 10 - fresh(id) % 10, mine: mine[id], total: mineTotal };
    var others = PLAYERS.filter(function (p) { return p.id !== id; }).map(function (p) { return { id: p.id, name: p.name, n: EGG.get(p.id) }; });
    var passed = others.filter(function (o) { return before !== undefined && before <= o.n && n > o.n; }).sort(function (a, b) { return b.n - a.n; })[0];
    var tied = others.filter(function (o) { return o.n === n && n > 0; })[0];
    if (fresh(id) > 0 && fresh(id) % 10 === 0) return say('bq', v, 'happy');
    if (mineTotal === 1) return say('first', v, 'happy');
    if (passed && once('over', 4000)) { v.other = passed.name; v.c = passed.n; return say('over', v, 'happy'); }
    if (tied && once('tie', 6000)) { v.other = tied.name; return say('tie', v); }
    if (mine[id] === 20 && once('focus' + id, 60000)) return say('focus', v);
    if (mineTotal === 50) return say('fan', v, 'happy');
    if (fresh(id) % 10 === 9 && once('near', 4000)) return say('near', v);
    if (window.mascotMood) mascotMood('happy', 1000);
  }
  function mascotBody() { var ms = document.querySelector('.mascot:not(.away)'); return ms && ms.offsetParent !== null ? ms.querySelector('.ms-body') : null; }
  function bqPop(anchor, id) {
    var r = anchor.getBoundingClientRect(), el = document.createElement('div'); el.className = 'bq-pop';
    el.style.left = Math.min(innerWidth - 150, Math.max(8, r.left + r.width / 2 - 70)) + 'px'; el.style.top = Math.max(8, r.top - 170) + 'px';
    el.innerHTML = (FH ? FH.bouquet(Math.random(), { size: 140, wrap: TEAMC[teamOf(id)] }) : '') + '<b class="bq-tag">Bó thứ ' + bqOf(id) + '</b>';
    document.body.appendChild(el);
    if (!G || reduce) { setTimeout(function () { el.remove(); }, 1600); return; }
    var tl = G.timeline({ onComplete: function () { el.remove(); } });
    tl.fromTo(el, { scale: .3, y: 60, rotation: -15, opacity: 0 }, { scale: 1, y: 0, rotation: 0, opacity: 1, duration: .6, ease: 'elastic.out(1,.55)' });
    el.querySelectorAll('.fh-b').forEach(function (g, i) { tl.fromTo(g, { opacity: 0, scale: .2, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: .35, ease: 'back.out(3)' }, .2 + i * .07); });
    tl.to(el, { y: -40, opacity: 0, scale: .85, duration: .5, ease: 'power2.in' }, '+=1');
  }
  function throwFx(btn, before) {
    var id = btn.dataset.egg, icon = btn.querySelector('.egg-i') || btn, r = icon.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    var seed = Math.random(), info = FH ? FH.head(seed) : { colors: ['#FF8FB1', '#FFD1DE', '#FFC531'] };
    var land = function () {
      AUD.fx('pop');
      var combo = fresh(id) > 0 && fresh(id) % 10 === 0;
      petals(tx, ty, combo ? 24 : 10, info.colors);
      if (G) {
        var nb = document.querySelector('.egg-btn[data-egg="' + id + '"]') || btn;
        G.fromTo(nb, { scale: .86 }, { scale: 1, duration: .5, ease: 'elastic.out(1.1,.45)', clearProps: 'transform' });
        var plus = document.createElement('span'); plus.className = 'egg-plus'; plus.textContent = '+1'; document.body.appendChild(plus);
        G.fromTo(plus, { x: tx + 10, y: ty - 10, opacity: 1, scale: .6 }, { y: ty - 54, scale: 1.1, opacity: 0, duration: .9, ease: 'power2.out', onComplete: function () { plus.remove(); } });
      }
      if (combo) { AUD.fx('bq'); bqPop(btn, id); shower(14); }
      react(id, before);
    };
    var mb = mascotBody();
    if (!G || reduce || flying > 12 || !FH) return land();
    var mr = mb && mb.getBoundingClientRect();
    var sx = mr ? mr.left + mr.width / 2 : tx + (Math.random() * 160 - 80), sy = mr ? mr.top + 16 : innerHeight + 30;
    var el = document.createElement('div'); el.className = 'egg-fly'; document.body.appendChild(el);
    var f = FH.mount(el, { seed: seed, size: 32, state: 'bud' });
    var peak = Math.min(sy, ty) - 70 - Math.random() * 70, dur = .55 + Math.min(.35, Math.hypot(tx - sx, ty - sy) / 2000);
    flying++;
    G.set(el, { x: sx - 16, y: sy - 16, rotation: -40, scale: .6 });
    G.timeline({ onComplete: function () {
        flying--; land(); f.setState('bloom');
        G.timeline({ onComplete: function () { el.remove(); } }).to(el, { scale: 1.7, duration: .4, ease: 'back.out(2)' }).to(el, { scale: 2, opacity: 0, y: '-=12', duration: .35 }, '+=.15');
      } })
      .to(el, { x: tx - 16, duration: dur, ease: 'none' }, 0)
      .to(el, { y: peak - 16, duration: dur * .45, ease: 'power2.out' }, 0)
      .to(el, { y: ty - 16, duration: dur * .55, ease: 'power2.in' }, dur * .45)
      .to(el, { rotation: 300 + Math.random() * 120, scale: 1, duration: dur, ease: 'power1.out' }, 0);
  }
  function give(id) {
    var before = EGG.get(id);
    if (!EGG.hit(id)) return null;
    mine[id] = (mine[id] || 0) + 1; mineTotal++;
    return before;
  }

  /* ---------- streak ---------- */
  var STREAK_START = 3, STREAK_GAP = 1500, STREAK_IDLE = 3000, STREAK_MAX = 50, LOCK_S = 10;
  var taps = {}, SK = null, lockUntil = 0;
  function quick(id) { var t = Date.now(); taps[id] = (taps[id] || []).filter(function (x) { return t - x < STREAK_GAP; }); taps[id].push(t); return taps[id].length >= STREAK_START; }
  function skSize() {
    if (!SK) return; var W = innerWidth, H = innerHeight;
    var fl = Math.round(Math.max(120, Math.min(W * .48, H * .34, 260))), bot = Math.round(Math.max(90, Math.min(W * .34, H * .26, 200)));
    if (fl + bot + 40 > W - 32) { var k = (W - 72) / (fl + bot); fl = Math.round(fl * k); bot = Math.round(bot * k); }
    SK.botPx = bot; SK.ov.style.setProperty('--fl', fl + 'px'); SK.ov.style.setProperty('--bot', bot + 'px');
  }
  function skSay(t, m) {
    if (!SK) return; var b = SK.ov.querySelector('.sk-say'); b.textContent = t; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop');
    if (SK.bot && m) { SK.bot.setState(m); clearTimeout(SK.mt); SK.mt = setTimeout(function () { if (SK && SK.bot && !SK.locked) SK.bot.setState('happy'); }, 1600); }
  }
  function skFlower() { if (FH) SK.fl = FH.mount(SK.ov.querySelector('.sk-f'), { seed: Math.random(), size: 120, state: 'bloom' }); }
  function skRing() { SK.ov.querySelector('.sk-ring .on').style.strokeDashoffset = (339.3 * (1 - (fresh(SK.id) % 10) / 10)).toFixed(1); }
  function openStreak(id, already) {
    var ov = document.createElement('div'); ov.className = 'sk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Chuỗi hoa cho ' + nameOf(id));
    ov.innerHTML = muteBtn('sk-mute') + '<button type="button" class="sk-x" aria-label="Thoát chuỗi"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>' +
      '<div class="sk-who">Tặng hoa cho</div><b class="sk-name">' + esc(nameOf(id)) + '</b><div class="sk-say" aria-live="polite"></div>' +
      '<div class="sk-stage"><div class="sk-bot"><div class="sk-bot-in"></div></div><div class="sk-fw"><button type="button" class="sk-btn" aria-label="Tặng thêm 1 bông"><svg class="sk-ring" viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="54"/><circle class="on" cx="60" cy="60" r="54"/></svg><span class="sk-f"></span></button></div></div>' +
      '<div class="sk-n"><b>' + already + '</b> bông trong chuỗi</div><div class="sk-hint">Chạm liên tục vào bông hoa · dừng 3 giây để kết thúc</div>';
    document.body.appendChild(ov); document.documentElement.classList.add('sk-open');
    SK = { id: id, n: already, ov: ov, idle: null };
    skSize(); addEventListener('resize', skSize);
    SK.bot = window.RobotHeads ? RobotHeads.mount(ov.querySelector('.sk-bot-in'), { shape: 'rectangle', size: SK.botPx, color: '#22337F', trimColor: '#D9C08A', screenColor: '#E9EDFF', seed: .42, label: 'Robot của giải' }) : null;
    if (SK.bot) SK.bot.setState('happy');
    skFlower(); skRing(); skSay('Bấm tiếp đi, đủ 10 bông là thành bó!');
    SK.idle = setTimeout(closeStreak, STREAK_IDLE);
    ov.querySelector('.sk-btn').addEventListener('pointerdown', function (e) { e.preventDefault(); skTap(); });
    ov.querySelector('.sk-btn').addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); skTap(); } });
    ov.querySelector('.sk-x').onclick = closeStreak;
    if (G && !reduce) { G.fromTo(ov, { opacity: 0 }, { opacity: 1, duration: .25 }); G.fromTo(ov.querySelector('.sk-stage'), { scale: .4 }, { scale: 1, duration: .6, ease: 'elastic.out(1,.5)' }); }
    ov.querySelector('.sk-btn').focus({ preventScroll: true });
  }
  function skTap() {
    if (!SK || SK.locked) return;
    if (give(SK.id) === null) return;
    clearTimeout(SK.idle); SK.idle = setTimeout(closeStreak, STREAK_IDLE);
    SK.n++;
    var r = SK.ov.querySelector('.sk-btn').getBoundingClientRect();
    AUD.fx('pop'); if (SK.fl) petals(r.left + r.width / 2, r.top + r.height / 2, 12, SK.fl.colors);
    SK.ov.querySelector('.sk-n b').textContent = SK.n; skRing();
    if (G && !reduce) { G.fromTo(SK.ov.querySelector('.sk-btn'), { scale: .9 }, { scale: 1, duration: .35, ease: 'back.out(3)' }); G.fromTo(SK.ov.querySelector('.sk-bot-in'), { y: 0 }, { y: -10, duration: .12, yoyo: true, repeat: 1, ease: 'power1.out' }); }
    if (SK.bot && SK.n % 5 === 0 && SK.n < STREAK_MAX && SK.bot.poke) SK.bot.poke();
    skFlower();
    if (fresh(SK.id) % 10 === 0) {
      AUD.fx('bq'); shower(10);
      var t = line('bq', { name: nameOf(SK.id), b: bqOf(SK.id) }); skSay(t, 'speaking'); AUD.talk(t);
      var pop = document.createElement('div'); pop.className = 'sk-bq'; pop.innerHTML = FH ? FH.bouquet(Math.random(), { size: 110, wrap: TEAMC[teamOf(SK.id)] }) : '';
      SK.ov.querySelector('.sk-fw').appendChild(pop);
      if (G && !reduce) G.timeline({ onComplete: function () { pop.remove(); } }).fromTo(pop, { opacity: 0, y: 40, scale: .4 }, { opacity: 1, y: 0, scale: 1, duration: .55, ease: 'elastic.out(1,.55)' }).to(pop, { opacity: 0, y: -30, duration: .4 }, '+=.5');
      else setTimeout(function () { pop.remove(); }, 1200);
    } else if (SK.n === 25) skSay('25 bông rồi! Tay ai mà nhanh vậy?', 'speaking');
    else if (SK.n === STREAK_MAX - 5) skSay('Còn 5 bông nữa là tôi giận đó nha…', 'thinking');
    if (SK.n >= STREAK_MAX) angry();
  }
  function closeStreak() {
    if (!SK || SK.locked) return; var s = SK; SK = null; clearTimeout(s.idle); clearTimeout(s.mt);
    removeEventListener('resize', skSize); document.documentElement.classList.remove('sk-open');
    var end = function () { s.ov.remove(); };
    if (G && !reduce) G.to(s.ov, { opacity: 0, duration: .3, onComplete: end }); else end();
    if (s.n >= 10) say('streak', { name: nameOf(s.id), a: s.n }, 'happy');
  }
  function angry() {
    SK.locked = true; clearTimeout(SK.idle); clearTimeout(SK.mt); lockUntil = Date.now() + LOCK_S * 1000;
    var ov = SK.ov, bot = ov.querySelector('.sk-bot'); ov.classList.add('locked'); AUD.fx('angry');
    ov.querySelector('.sk-btn').disabled = true;
    if (SK.bot) { SK.bot.setState('error'); setTimeout(function () { if (SK && SK.locked && SK.bot) SK.bot.setState('error'); }, 450); }
    var t = line('lock'); skSay(t); AUD.talk(t);
    var cnt = document.createElement('div'); cnt.className = 'sk-lock'; ov.appendChild(cnt);
    if (G && !reduce) {
      var r = bot.getBoundingClientRect(), k = Math.min(1.9, (innerWidth - 32) / r.width, innerHeight * .45 / r.height);
      G.to(bot, { x: innerWidth / 2 - (r.left + r.width / 2), scale: k, duration: .6, ease: 'back.out(1.7)', onComplete: function () { G.to(bot, { rotation: 4, duration: .07, repeat: 11, yoyo: true, ease: 'none', onComplete: function () { G.set(bot, { rotation: 0 }); } }); } });
      G.to(ov.querySelector('.sk-fw'), { opacity: .15, scale: .8, duration: .4 });
    }
    (function tick() {
      var left = Math.ceil((lockUntil - Date.now()) / 1000);
      if (left > 0) { cnt.innerHTML = 'Khóa hoa <b>' + left + '</b> giây'; setTimeout(tick, 250); return; }
      if (SK.bot) SK.bot.setState('happy');
      var u = line('unlock'); skSay(u); AUD.talk(u);
      var done = function () { SK.locked = false; closeStreak(); };
      if (G && !reduce) { G.to(bot, { x: 0, scale: 1, duration: .5, ease: 'power2.inOut' }); G.to(ov.querySelector('.sk-fw'), { opacity: 1, scale: 1, duration: .4 }); setTimeout(done, 1400); } else done();
    })();
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && SK) closeStreak(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.egg-btn'); if (!b) return;
    e.stopPropagation();
    var id = b.dataset.egg;
    if (Date.now() < lockUntil) { b.classList.add('empty'); setTimeout(function () { b.classList.remove('empty'); }, 600); if (once('locked', 1500)) say('locked', { s: Math.ceil((lockUntil - Date.now()) / 1000) }, 'error'); return; }
    var before = give(id);
    if (before === null) { b.classList.add('empty'); setTimeout(function () { b.classList.remove('empty'); }, 600); if (window.mascotSay) mascotSay('Hôm nay bạn đã tặng hết ' + EGG.limit + ' bông rồi, mai tặng tiếp nhé!'); return; }
    if (quick(id) && !SK) { taps[id] = []; throwFx(b, before); openStreak(id, STREAK_START); return; }
    throwFx(b, before);
  });

  /* ---------- show/hide blocks (member lists) ---------- */
  var CHEVD = '<svg class="chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  var CHIP = '<span class="chev-chip" aria-hidden="true">' + CHEVD + '</span>';
  function box(id, inner, open) { return '<div class="collapse' + (open ? ' open' : '') + '" id="' + id + '"><div class="collapse-in">' + inner + '</div></div>'; }
  function setOpen(btn, open) {
    var box = document.getElementById(btn.getAttribute('aria-controls')); if (!box) return;
    btn.setAttribute('aria-expanded', String(open));
    box.classList.toggle('open', open);
    var lab = btn.querySelector('.lbl');
    if (lab && btn.dataset.label) lab.textContent = open ? btn.dataset.label.replace(/^Xem/, 'Ẩn') : btn.dataset.label;
  }
  document.addEventListener('click', function (e) {
    var btn = e.target.closest && e.target.closest('.vs-toggle, .team-toggle, .lane-toggle, .b-toggle'); if (!btn) return;
    setOpen(btn, btn.getAttribute('aria-expanded') !== 'true');
    if (btn.classList.contains('team-toggle')) syncTeamsAll();
  });

  /* ---------- glass spotlight ---------- */
  document.addEventListener('pointermove', function (e) {
    var el = e.target.closest && e.target.closest('.tilt');
    if (!el) return;
    var r = el.getBoundingClientRect();
    el.style.setProperty('--mx', (e.clientX - r.left) + 'px');
    el.style.setProperty('--my', (e.clientY - r.top) + 'px');
  }, { passive: true });

  /* ---------- nav + tab bar ---------- */
  var navLinks = document.querySelectorAll('.nav a, .tabbar a');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) {
        if (!en.isIntersecting) return;
        navLinks.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + en.target.id); });
      });
    }, { rootMargin: '-40% 0px -55% 0px' });
    ['home', 'ket-qua', 'lich', 'so-do', 'bxh', 'doi', 'the-le', 'thu-vien', 'tai-lieu'].forEach(function (id) { var el = $(id); if (el) io.observe(el); });
  }

  /* ---------- island ---------- */
  var island = $('island');
  function daysLeft(m) { return Math.round((dateOf(m) - today()) / 864e5); }
  if (nextM) {
    var dl = daysLeft(nextM);
    $('islandShort').textContent = nextM.code + ' · ' + (dl === 0 ? 'Hôm nay' : dl + ' ngày');
    $('islandLong').textContent = sideName(nextM.a) + ' vs ' + sideName(nextM.b) + ' · ' + S.rules.weekday + ' ' + nextM.date.slice(0, 5);
  } else {
    $('islandShort').textContent = finalM && finalM.winner ? 'Vô địch: ' + sideName(finalM[finalM.winner]) : 'Giải đã kết thúc';
  }
  island.addEventListener('click', function () { pickDay(nextDayIdx); $('lich').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' }); });

  /* ---------- hero slider ---------- */
  var slides = S.slides, cur = 0, timer = null, playing = true, DUR = 6500, hover = false;
  var slidesEl = $('slides'), dotsEl = $('dots'), prog = $('progress'), hero = slidesEl.parentNode;
  slidesEl.innerHTML = slides.map(function (s, i) {
    var bg = s.src
      ? '<div class="slide-bg"><img src="' + esc(s.src) + '" alt=""' + (i ? ' loading="lazy"' : '') + '></div>'
      : '<div class="court"><div class="court-lines"></div></div>';
    var h = i === 0 ? 'h1' : 'h2';
    return '<article class="slide' + (i ? '' : ' on') + (s.report ? ' report' : '') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' / ' + slides.length + '">' + bg +
      '<div class="slide-in">' + (s.eyebrow ? '<p class="chip-gold glass-dark">' + esc(s.eyebrow) + '</p>' : '') +
      (s.title ? '<' + h + '>' + esc(s.title) + '</' + h + '>' : '') + (s.sub ? '<p class="sub">' + esc(s.sub) + '</p>' : '') +
      (s.stats && s.stats.length ? '<div class="rstats">' + s.stats.map(function (x) { return '<div class="rs glass-dark"><b>' + esc(x.v) + '</b><small>' + esc(x.k) + '</small></div>'; }).join('') + '</div>' : '') +
      (s.cta ? '<div class="ctas"><a class="cta" href="' + esc(s.cta.href) + '"' + (/\.pdf$/i.test(s.cta.href) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(s.cta.label) + ARROW + '</a>' +
        (s.cta2 ? '<a class="cta alt" href="' + esc(s.cta2.href) + '">' + esc(s.cta2.label) + '</a>' : '') + '</div>' : '') + '</div></article>';
  }).join('');
  dotsEl.innerHTML = slides.map(function (s, i) { return '<button type="button" role="tab" aria-label="Slide ' + (i + 1) + '" aria-selected="' + !i + '" data-i="' + i + '"></button>'; }).join('');
  var slideEls = slidesEl.children, dotEls = dotsEl.children;
  if (slides.length < 2) { dotsEl.hidden = true; hero.querySelector('.hero-btns').hidden = true; }
  function go(i) {
    if (slides.length < 2) return;
    cur = (i + slides.length) % slides.length;
    for (var k = 0; k < slideEls.length; k++) { slideEls[k].classList.toggle('on', k === cur); dotEls[k].setAttribute('aria-selected', k === cur); }
    var nx = slideEls[(cur + 1) % slides.length].querySelector('img[loading]'); if (nx) nx.removeAttribute('loading');
    restart();
  }
  function restart() {
    clearTimeout(timer); prog.style.transition = 'none'; prog.style.width = '0';
    if (!playing || reduce || hover || slides.length < 2) return;
    void prog.offsetWidth; prog.style.transition = 'width ' + DUR + 'ms linear'; prog.style.width = '100%';
    timer = setTimeout(function () { go(cur + 1); }, DUR);
  }
  function setPlaying(p) {
    playing = p;
    $('playIcon').setAttribute('d', p ? 'M9 6v12M15 6v12' : 'M8 5l11 7-11 7z');
    $('playSlide').setAttribute('aria-label', p ? 'Tạm dừng tự chạy' : 'Tự chạy slide');
    restart();
  }
  $('prevSlide').addEventListener('click', function () { go(cur - 1); });
  $('nextSlide').addEventListener('click', function () { go(cur + 1); });
  $('playSlide').addEventListener('click', function () { setPlaying(!playing); });
  dotsEl.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) go(+b.dataset.i); });
  hero.addEventListener('mouseenter', function () { hover = true; restart(); });
  hero.addEventListener('mouseleave', function () { hover = false; restart(); });
  hero.addEventListener('keydown', function (e) { if (e.key === 'ArrowLeft') go(cur - 1); if (e.key === 'ArrowRight') go(cur + 1); });
  swipe(hero, function () { go(cur + 1); }, function () { go(cur - 1); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else restart(); });
  if (reduce) setPlaying(false); else restart();
  function swipe(el, onLeft, onRight) {
    var x0 = null, y0 = 0;
    el.addEventListener('pointerdown', function (e) { if (e.pointerType !== 'mouse') { x0 = e.clientX; y0 = e.clientY; } });
    el.addEventListener('pointerup', function (e) {
      if (x0 === null) return;
      var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
      if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy)) (dx < 0 ? onLeft : onRight)();
    });
    el.addEventListener('pointercancel', function () { x0 = null; });
  }

  /* ---------- bento: next match ---------- */
  var lastCount = {};
  function vsCard(m) {
    var meta = function (k) { var s = m[k]; return s.team ? rec[s.team].w + ' thắng · ' + rec[s.team].l + ' thua' : 'Chờ kết quả'; };
    return '<div class="vs-card"><div class="vs-side"><b>' + esc(sideName(m.a)) + '</b><small>' + meta('a') + '</small></div>' +
      '<div class="vs-mid"><span class="code">' + esc(m.code) + '</span><span class="x">VS</span><span>' + esc(m.round) + '</span></div>' +
      '<div class="vs-side"><b>' + esc(sideName(m.b)) + '</b><small>' + meta('b') + '</small></div></div>';
  }
  if (nextM) {
    var sameDay = upcoming.filter(function (m) { return m.iso === nextM.iso; });
    $('wNext').innerHTML = '<div class="w-label"><span class="live"><span class="pulse"></span>Trận kế tiếp</span><span>Ngày ' + nextM.day + ' · ' + esc(S.rules.weekday) + ' ' + esc(nextM.date) +
      (S.meta.matchTime ? ' · ' + esc(S.meta.matchTime) : '') + (S.meta.venue ? ' · ' + esc(S.meta.venue) : '') + '</span></div>' +
      sameDay.map(vsCard).join('') + '<div class="count' + (S.meta.matchTime ? '' : ' one') + '" id="count" aria-label="Đếm ngược"></div>';
    tick(); setInterval(tick, 1000);
  } else {
    $('wNext').innerHTML = '<div class="w-label"><span>Giải đã kết thúc</span></div><div class="vs-card"><div class="vs-side"><b>' +
      (finalM && finalM.winner ? 'Vô địch: ' + esc(sideName(finalM[finalM.winner])) : 'Cảm ơn các đội') + '</b></div></div>';
  }
  function tick() {
    var t = dateOf(nextM), parts;
    if (S.meta.matchTime) {
      var hm = S.meta.matchTime.split(':'); t.setHours(+hm[0], +hm[1] || 0);
      var ms = Math.max(0, t - new Date());
      parts = [[Math.floor(ms / 864e5), 'Ngày'], [Math.floor(ms / 36e5) % 24, 'Giờ'], [Math.floor(ms / 6e4) % 60, 'Phút'], [Math.floor(ms / 1e3) % 60, 'Giây']]
        .map(function (p) { return [String(p[0]).padStart(2, '0'), p[1]]; });
    } else {
      var d = daysLeft(nextM);
      parts = [[d === 0 ? 'Hôm nay' : d, d === 0 ? 'Ngày thi đấu' : 'ngày nữa tới trận']];
    }
    var el = $('count');
    if (!el.children.length) el.innerHTML = parts.map(function () { return '<div><b></b><span></span></div>'; }).join('');
    parts.forEach(function (p, i) {
      var cell = el.children[i];
      if (lastCount[i] !== p[0]) { cell.firstChild.innerHTML = '<span class="flip">' + esc(p[0]) + '</span>'; lastCount[i] = p[0]; }
      cell.lastChild.textContent = p[1];
    });
  }

  /* ---------- bento: progress ring ---------- */
  var C = 2 * Math.PI * 44, total = S.matches.length;
  var phase = nextM ? 'Đang ở <b>' + esc(nextM.round) + '</b> · còn ' + daysLeft(finalM) + ' ngày tới chung kết' : 'Đã xong <b>' + total + ' trận</b>';
  $('wProg').innerHTML = '<div class="w-label"><span>Tiến độ giải</span><span>' + played + '/' + total + '</span></div>' +
    '<div class="ring"><svg viewBox="0 0 104 104" aria-hidden="true"><circle class="track" cx="52" cy="52" r="44"/><circle class="bar" id="ringBar" cx="52" cy="52" r="44" stroke-dasharray="' + C + '" stroke-dashoffset="' + C + '"/></svg>' +
    '<div class="ring-txt"><b id="ringNum">0</b><span>trận đã đấu trên ' + total + '</span></div></div><p class="phase">' + phase + '</p>';
  requestAnimationFrame(function () { requestAnimationFrame(function () {
    $('ringBar').style.strokeDashoffset = C * (1 - Math.max(played / total, .02));
    countUp($('ringNum'), played);
  }); });
  function countUp(el, to) {
    if (reduce || !to) { el.textContent = to; return; }
    var t0 = performance.now();
    (function step(t) { var k = Math.min(1, (t - t0) / 1200); el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3))); if (k < 1) requestAnimationFrame(step); })(t0);
  }

  /* ---------- bento: 7-day strip ---------- */
  $('wDays').innerHTML = '<div class="w-label"><span>' + dayInfo.length + ' ' + esc(S.rules.weekday.toLowerCase()) + '</span><span>' + esc(S.meta.firstDate) + ' → ' + esc(S.meta.lastDate.slice(0, 5)) + '</span></div>' +
    '<div class="strip">' + dayInfo.map(function (d, i) {
      var cls = d.done ? 'done' : i === nextDayIdx && nextM ? 'next' : '';
      return '<button type="button" class="' + cls + '" data-i="' + i + '" aria-label="Ngày ' + d.day + ', ' + d.label + ', ' + d.matches.length + ' trận"><span class="d">' + d.label.slice(0, 2) + '</span><span class="m">Th' + d.label.slice(3) + '</span><i></i></button>';
    }).join('') + '</div>';
  $('wDays').addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b) return;
    pickDay(+b.dataset.i); $('lich').scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
  });

  /* ---------- bento: team status ---------- */
  var order = S.teams.slice().sort(function (a, b) { return teamState(a.id)[2] - teamState(b.id)[2] || rec[b.id].w - rec[a.id].w || a.id - b.id; });
  $('wStat').innerHTML = '<div class="w-label"><span>Trạng thái đội</span><a href="#doi">Xem đội</a></div><ul class="stat-list">' +
    order.map(function (t, i) {
      var st = teamState(t.id);
      return '<li style="--i:' + i + '"><b>' + esc(t.name) + '</b><span class="rec">' + rec[t.id].w + '–' + rec[t.id].l + '</span><span class="badge ' + st[1] + '">' + st[0] + '</span></li>';
    }).join('') + '</ul>';

  /* ---------- schedule: segmented days + panel ---------- */
  var seg = $('daySeg'), thumb = $('segThumb'), curDay = -1;
  seg.insertAdjacentHTML('beforeend', dayInfo.map(function (d, i) {
    return '<button type="button" role="tab" id="day-' + i + '" aria-selected="false" data-i="' + i + '"><b>' + d.label + '</b><small>Ngày ' + d.day + ' · ' + d.matches.length + ' trận</small>' + (d.done ? '<span class="dot" aria-label="đã đấu"></span>' : '') + '</button>';
  }).join(''));
  var segBtns = seg.querySelectorAll('button');
  seg.addEventListener('click', function (e) { var b = e.target.closest('button'); if (b) pickDay(+b.dataset.i); });
  seg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var n = Math.max(0, Math.min(dayInfo.length - 1, curDay + (e.key === 'ArrowRight' ? 1 : -1))); pickDay(n); segBtns[n].focus(); }
  });
  function moveThumb() {
    var b = segBtns[curDay]; if (!b) return;
    thumb.style.width = b.offsetWidth + 'px'; thumb.style.transform = 'translateX(' + b.offsetLeft + 'px)';
  }
  window.addEventListener('resize', moveThumb);
  /* one pair row everywhere (schedule, bracket pop-up; the referee page has its own copy):
     team A names | A score · seed · B score | team B names. Result colours: winner side green, loser red,
     a draw keeps the default ink. Names stay tappable in the schedule (data-p highlights a player). */
  function short(n) { return n.split(' ').slice(-2).join(' '); }
  function pairsHtml(m, plain) {
    var A = m.a.team ? teamById[m.a.team].members : null, B = m.b.team ? teamById[m.b.team].members : null;
    if (!A && !B) return '<div class="pairs tbd">Tên VĐV hiện khi đã có kết quả ' + esc([m.a.label, m.b.label].join(', ').replace(/Thắng |Thua /g, '')) + '</div>';
    var r = m.result, lu = (r && r.lineup) || {};  // stand-ins typed by the organisers: {"3": {"a": [2, 5]}}
    var nm = function (n, sub) { return (plain ? '<span class="pq">' + esc(short(n)) + '</span>' : '<button type="button" class="pn bare" data-p="' + esc(n) + '" title="' + esc(n) + '">' + esc(short(n)) + marks(n) + '</button>') + (sub ? '<span class="sub">thay</span>' : ''); };
    var side = function (Lm, seeds, orig, c) { return '<span class="n' + c + '">' + (Lm ? seeds.map(function (x, j) { return '<i>' + nm(Lm[x - 1], x !== orig[j]) + '</i>'; }).join('') : '<i class="tbd">Chưa xác định</i>') + '</span>'; };
    return '<div class="pairs">' + S.pairs.map(function (p, i) {
      var o = lu[i + 1] || {}, sc = r && r.pairs ? r.pairs[i] : undefined, absent = r && r.pairs && !sc;
      var ca = sc && sc[0] !== sc[1] ? (sc[0] > sc[1] ? ' rw' : ' rx') : '', cb = ca === ' rw' ? ' rx' : ca === ' rx' ? ' rw' : '';
      return '<div class="pair' + (absent ? ' absent' : '') + '">' + side(A, o.a || p, p, ca) +
        '<span class="s l' + ca + '">' + (sc ? sc[0] : absent ? '–' : '') + '</span><span class="no" title="Cặp ' + (i + 1) + (absent ? ' · vắng, không đấu' : '') + '">' + p[0] + '–' + p[1] + '</span><span class="s' + cb + '">' + (sc ? sc[1] : absent ? '–' : '') + '</span>' +
        side(B, o.b || p, p, ' r' + cb) + (absent ? '<span class="meta">vắng · không đấu</span>' : '') + '</div>';
    }).join('') + '</div>';
  }
  /* absent pairs (null in result.pairs) were not played: shown as a note, they count for nobody */
  function absentTxt(r) { var n = (r && r.pairs || []).filter(function (p) { return !p; }).length; return n ? ' · ' + n + ' cặp vắng' : ''; }
  function matchCard(m, i) {
    var st = ST[status(m)];
    var rc = function (k) { return !m.result || m.result.a === m.result.b ? '' : m.winner === k ? ' rw' : ' rx'; };
    var mid = m.result
      ? '<div class="score"><span class="' + rc('a') + '">' + esc(m.result.a) + '</span><span class="lo">:</span><span class="' + rc('b') + '">' + esc(m.result.b) + '</span></div>'
      : '<span class="x">VS</span>';
    var sub = m.result ? 'Cặp thắng ' + m.result.pa + '–' + m.result.pb + absentTxt(m.result) : esc(m.round);
    var sides = '<span class="vs-side' + rc('a') + '"><b>' + esc(sideName(m.a)) + '</b></span><span class="vs-mid">' + mid + '<span>' + sub + '</span></span><span class="vs-side r' + rc('b') + '"><b>' + esc(sideName(m.b)) + '</b></span>';
    var top = '<div class="m-top"><span class="' + tagCls(m) + '">' + esc(m.code) + ' · ' + esc(m.round) + '</span><span class="badge ' + st[1] + '" data-badge="' + esc(m.code) + '">' + st[0] + '</span></div>' +
      '<p class="ref-live" data-ref="' + esc(m.code) + '" hidden></p>';
    if (!(m.a.team || m.b.team)) return '<article class="match glass" style="--i:' + i + '">' + top + '<div class="vs-card">' + sides + '</div>' + pairsHtml(m) + '</article>';
    return '<article class="match glass" style="--i:' + i + '">' + top +
      '<button type="button" class="vs-card vs-toggle" aria-expanded="false" aria-controls="pairs-' + m.code + '" data-label="Xem thành viên">' + sides +
      '<span class="vs-hint"><span class="lbl">Xem thành viên</span>' + CHIP + '</span></button>' + box('pairs-' + m.code, pairsHtml(m)) + '</article>';
  }
  function pickDay(i) {
    if (i === curDay) return;
    curDay = i;
    segBtns.forEach(function (b, k) { b.setAttribute('aria-selected', k === i); b.tabIndex = k === i ? 0 : -1; });
    $('dayPanel').setAttribute('aria-labelledby', 'day-' + i);
    $('dayPanel').innerHTML = dayInfo[i].matches.map(matchCard).join('');
    REF.apply();
    moveThumb();
    var b = segBtns[i], sc = seg.parentNode;
    if (b.offsetLeft < sc.scrollLeft || b.offsetLeft + b.offsetWidth > sc.scrollLeft + sc.clientWidth) sc.scrollTo({ left: b.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
  }
  pickDay(nextDayIdx);
  $('busyNote').textContent = S.rules.busy_note;

  /* ---------- bracket (v1.28.0, owner review 261111-bracket-v2) ----------
     One map, two lanes: nhánh thắng above, nhánh thua below, CK tổng on the right. Every connection is a
     "pipeline" from the row of the team that travels it to the row it feeds: green = that team won the match
     (winner's path), red = it lost (drop to nhánh thua), grey = the team has since left the season. Pipes have
     their own track in each gutter, so none runs over text or over another (crossings are drawn as bridges).
     Tap a pipe: it and its two matches light up; tap outside / Esc: normal. Tap a match: pop-up (result and the
     5 pairs, or the two rosters when not played). Team chips light one team's whole path. Phones scroll the
     same map sideways, opened at the match being played next. */
  var BK = (function () {
    var CW = 168, CH = 92, W = 1412, H = 590, X = [40, 276, 512, 748, 984, 1220];
    var POS = { T1: [X[0], 44], T2: [X[0], 154], T3: [X[0], 264], T4: [X[1], 99], T6: [X[2], 200],
                T5: [X[1], 452], T7: [X[2], 452], T8: [X[3], 452], T9: [X[4], 452], T10: [X[5], 326] };
    var st = { team: null, focus: null }, loss = {}, champ = finalM && finalM.winner ? finalM[finalM.winner].team : null;
    S.teams.forEach(function (t) { loss[t.id] = 0; });
    S.matches.forEach(function (m) { if (m.winner) { var l = m[m.winner === 'a' ? 'b' : 'a'].team; if (l) loss[l]++; } });
    function state(id) { return champ === id ? 'champ' : loss[id] >= 2 ? 'out' : loss[id] === 1 ? 'lose' : 'win'; }
    function stTxt(s) { return { win: 'Chưa thua', lose: 'Đã thua 1 trận', out: 'Đã rời giải', champ: 'Vô địch' }[s]; }
    var EDGES = [];
    // drops first, then the losers' lane, then winners (later pipes bridge over earlier ones)
    S.matches.forEach(function (m) { if (m.loseTo && POS[m.code] && POS[m.loseTo]) EDGES.push({ from: m.code, to: m.loseTo, who: 'L' }); });
    S.matches.forEach(function (m) { if (m.winTo && m.branch === 'lose' && POS[m.code] && POS[m.winTo]) EDGES.push({ from: m.code, to: m.winTo, who: 'W' }); });
    S.matches.forEach(function (m) { if (m.winTo && m.branch !== 'lose' && POS[m.code] && POS[m.winTo]) EDGES.push({ from: m.code, to: m.winTo, who: 'W' }); });
    function rowY(c, side) { return POS[c][1] + 28 + (side === 'a' ? 16 : 48); }
    function L(c) { return POS[c][0]; } function R(c) { return POS[c][0] + CW; }
    function entry(e) { var t = byCode[e.to], lab = (e.who === 'W' ? 'Thắng ' : 'Thua ') + e.from; return t.a.label === lab ? 'a' : 'b'; }
    function traveller(e) { var m = byCode[e.from]; if (!m.winner) return null; return m[e.who === 'W' ? m.winner : (m.winner === 'a' ? 'b' : 'a')].team; }
    function route(e) {
      var m = byCode[e.from], ws = m.winner, ls = ws === 'a' ? 'b' : 'a';
      var y0 = ws ? rowY(e.from, e.who === 'W' ? ws : ls) : POS[e.from][1] + 60, y1 = rowY(e.to, entry(e)), x1 = L(e.to);
      switch (e.from + e.to) {
        case 'T1T5': return [[L('T1'), y0], [26, y0], [26, 412], [254, 412], [254, y1], [x1, y1]];
        case 'T2T5': return [[L('T2'), y0], [12, y0], [12, 426], [238, 426], [238, y1], [x1, y1]];
        case 'T1T4': case 'T2T4': return [[R(e.from), y0], [244, y0], [244, y1], [x1, y1]];
        case 'T3T6': return [[R('T3'), y0], [484, y0], [484, y1], [x1, y1]];
        case 'T3T7': return [[R('T3'), y0], [496, y0], [496, y1], [x1, y1]];
        case 'T4T6': return [[R('T4'), y0], [466, y0], [466, y1], [x1, y1]];
        case 'T4T8': var xt = R('T4') - 26; return [[xt, POS.T4[1]], [xt, 70], [726, 70], [726, y1], [x1, y1]];
        case 'T6T9': return [[R('T6'), y0], [700, y0], [700, 360], [960, 360], [960, y1], [x1, y1]];
        case 'T6T10': return [[R('T6'), y0], [1196, y0], [1196, y1], [x1, y1]];
        case 'T5T7': return [[R('T5'), y0], [472, y0], [472, y1], [x1, y1]];
        case 'T7T8': return [[R('T7'), y0], [712, y0], [712, y1], [x1, y1]];
        case 'T8T9': return [[R('T8'), y0], [946, y0], [946, y1], [x1, y1]];
        case 'T9T10': return [[R('T9'), y0], [1204, y0], [1204, y1], [x1, y1]];
      }
      var xm = Math.round((R(e.from) + x1) / 2); return [[R(e.from), y0], [xm, y0], [xm, y1], [x1, y1]];
    }
    function path(p) {
      var d = 'M' + p[0][0] + ' ' + p[0][1];
      for (var i = 1; i < p.length; i++) {
        var a = p[i], b = p[i - 1], c = p[i + 1];
        if (!c) { d += ' L' + a[0] + ' ' + a[1]; break; }
        var l1 = Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]), l2 = Math.abs(c[0] - a[0]) + Math.abs(c[1] - a[1]), r = Math.min(10, l1 / 2, l2 / 2);
        d += ' L' + (a[0] - Math.sign(a[0] - b[0]) * r) + ' ' + (a[1] - Math.sign(a[1] - b[1]) * r) + ' Q' + a[0] + ' ' + a[1] + ' ' + (a[0] + Math.sign(c[0] - a[0]) * r) + ' ' + (a[1] + Math.sign(c[1] - a[1]) * r);
      }
      return d;
    }
    function plen(p) { var s = 0; for (var i = 1; i < p.length; i++) s += Math.abs(p[i][0] - p[i - 1][0]) + Math.abs(p[i][1] - p[i - 1][1]); return s; }
    function dot(team) { return '<span class="bk-dot ' + (team ? state(team) : 'none') + '"></span>'; }
    function involved(m, t) { return !!t && (m.a.team === t || m.b.team === t); }
    function card(m) {
      var r = m.result, h = '<span class="bk-ch"><span class="' + tagCls(m) + '">' + m.code + '</span><span>' + esc(m.round) + '</span><span class="when">' + esc(m.date.slice(0, 5)) + '</span></span>';
      ['a', 'b'].forEach(function (k) {
        var s = m[k], cls = r && r.a !== r.b ? (m.winner === k ? ' won' : ' lost') : '';
        h += '<span class="bk-row' + cls + '">' + dot(s.team) + '<span class="nm' + (s.team ? '' : ' tbd') + '">' + esc(sideName(s)) + '</span>' + (r ? '<b class="sc">' + r[k] + '</b>' : '') + '</span>';
      });
      return h;
    }
    function render() {
      $('bkChips').innerHTML = '<button type="button" class="bk-chip" data-t="" aria-pressed="true"><span class="bk-st all">✓</span>Tất cả</button>' +
        S.teams.map(function (t) {
          var s = state(t.id);
          return '<button type="button" class="bk-chip" data-t="' + t.id + '" aria-pressed="false" title="' + stTxt(s) + '"><span class="bk-st ' + s + '">' + (s === 'out' ? '✕' : s === 'champ' ? '★' : loss[t.id]) + '</span>' + esc(t.name) + '<small>' + stTxt(s) + '</small></button>';
        }).join('');
      var lw = X[5] - 22, html = '<div class="bk-lane lw" style="width:' + lw + 'px;height:398px"></div><div class="bk-lane ll" style="top:398px;width:' + lw + 'px;height:' + (H - 398) + 'px"></div>' +
        '<div class="bk-lane-h lw" style="left:' + X[0] + 'px;top:16px">Nhánh thắng</div><div class="bk-lane-h ll" style="left:' + X[0] + 'px;top:' + POS.T5[1] + 'px">Nhánh thua</div>', svg = '';
      EDGES.forEach(function (e, i) {
        var p = route(e), d = path(p), who = traveller(e), len = plen(p);
        // colour = what happened on this pipe: winner's path green, drop red; grey once the team has left
        var cls = !who ? 'todo' : state(who) === 'out' ? 'out' : e.who === 'W' ? 'win' : 'lose';
        var anim = reduce ? '' : ' grow" style="--len:' + len + ';stroke-dasharray:' + len + ';animation-delay:' + (0.15 + i * 0.05) + 's';
        svg += '<g class="bk-pipe ' + cls + '" data-e="' + i + '" role="button" tabindex="0" aria-label="' + e.from + ' đến ' + e.to + (who ? ': ' + esc(teamById[who].name) : '') + '"><path class="gap" d="' + d + '"/>' +
          (who ? '<path class="rim' + anim + '" d="' + d + '"/><path class="core' + anim + '" d="' + d + '"/><path class="flow" d="' + d + '"/>' : '<path class="core" d="' + d + '"/>') + '<path class="hit" d="' + d + '"/></g>';
      });
      html += '<svg class="bk-wires" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="false">' + svg + '</svg>';
      Object.keys(POS).forEach(function (c, i) {
        var m = byCode[c]; if (!m) return;
        html += '<button type="button" class="bk-card' + (m.branch === 'final' ? ' final' : '') + '" data-m="' + c + '" style="left:' + POS[c][0] + 'px;top:' + POS[c][1] + 'px;width:' + CW + 'px;height:' + CH + 'px;--d:' + (i * 0.04) + 's" aria-label="' + c + ': ' + esc(sideName(m.a)) + ' gặp ' + esc(sideName(m.b)) + '">' + card(m) + '</button>';
      });
      $('bkCanvas').innerHTML = html;
      fit(); mark();
    }
    function mark() {
      document.querySelectorAll('#bkChips .bk-chip').forEach(function (b) { b.setAttribute('aria-pressed', String((b.dataset.t || null) === st.team)); });
      document.querySelectorAll('#bkCanvas .bk-pipe').forEach(function (g) { var i = +g.dataset.e; g.classList.toggle('on', st.focus === i || (!!st.team && traveller(EDGES[i]) === st.team)); });
      document.querySelectorAll('#bkCanvas .bk-card').forEach(function (b) { var c = b.dataset.m; b.classList.toggle('on', (st.focus != null && (EDGES[st.focus].from === c || EDGES[st.focus].to === c)) || involved(byCode[c], st.team)); });
      $('bkBoard').classList.toggle('focus', st.focus != null || !!st.team);
    }
    var opened = false;
    function fit() {
      var sc = $('bkScroll'), w = sc.clientWidth; if (!w) return;
      var k = w >= 900 ? Math.min(1, w / W) : Math.max(.72, Math.min(1, w / 560));
      $('bkCanvas').style.transform = 'scale(' + k + ')';
      $('bkStage').style.width = Math.round(W * k) + 'px'; $('bkStage').style.height = Math.round(H * k) + 'px';
      $('bkBoard').classList.toggle('scrolls', W * k > w + 2);
      if (!opened && W * k > w + 2) {
        opened = true;
        var nx = S.matches.filter(function (m) { return !m.result && POS[m.code]; })[0];
        if (nx && (POS[nx.code][0] + CW) * k > w) sc.scrollLeft = Math.max(0, (POS[nx.code][0] - 60) * k - w / 3);
      }
    }
    /* pop-up: a played match shows the score, the 5 pairs (unified pair row) and where each team goes next;
       a match not played yet shows the two rosters */
    var box = document.createElement('div'); box.className = 'pm'; box.hidden = true;
    box.innerHTML = '<div class="pm-card glass bm" role="dialog" aria-modal="true" aria-labelledby="bmT"><button type="button" class="pm-x" aria-label="Đóng"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="bm-in"></div></div>';
    document.body.appendChild(box);
    var back = null;
    function close() { if (box.hidden) return; box.hidden = true; document.documentElement.classList.remove('pm-open'); if (back && back.focus) back.focus(); }
    box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.pm-x')) close(); });
    function open(code) {
      var m = byCode[code], r = m.result, h = '', side = function (k) { var s = m[k]; return s.team ? dot(s.team) + stTxt(state(s.team)) : dot(null) + 'chờ kết quả ' + esc((s.label || '').replace(/^(Thắng|Thua) /, '')); };
      var hc = function (k) { return !r || r.a === r.b ? '' : m.winner === k ? ' rw' : ' rx'; };
      h += '<div class="bm-eb"><span class="' + tagCls(m) + '">' + m.code + '</span>' + esc(m.round) + ' · ' + esc(m.date) + '</div>';
      h += '<div class="bm-h"><div class="t' + hc('a') + '" id="bmT">' + esc(sideName(m.a)) + '<small>' + side('a') + '</small></div>' +
        (r ? '<div class="vs">' + r.a + '–' + r.b + '</div>' : '<div class="vs no">chưa đấu</div>') +
        '<div class="t r' + hc('b') + '">' + esc(sideName(m.b)) + '<small>' + side('b') + '</small></div></div>';
      if (r) {
        var Wn = m[m.winner], Ls = m[m.winner === 'a' ? 'b' : 'a'];
        h += '<p class="bm-sub"><b>' + esc(sideName(Wn)) + '</b> thắng · cặp ' + r.pa + '–' + r.pb + absentTxt(r) + '</p>';
        if (r.pairs) h += pairsHtml(m, true);
        if (r.players) {
          var best = null; for (var id in r.players) { var v = r.players[id]; if (!best || v[0] > best[1]) best = [id, v[0]]; }
          if (best) { var tp = best[0].split('-'); h += '<p class="bm-star">Ghi điểm nhiều nhất: <b>' + esc(teamById[tp[0]].members[tp[1] - 1]) + '</b> (' + esc(teamById[tp[0]].name) + ') · ' + best[1] + ' điểm tấn công</p>'; }
        }
        h += '<div class="bm-next">' + (m.winTo ? '<span class="gw">' + esc(sideName(Wn)) + ' → ' + m.winTo + '</span>' : '<span class="gc">★ ' + esc(sideName(Wn)) + ' vô địch</span>') +
          (m.loseTo ? '<span class="gl">' + esc(sideName(Ls)) + ' ↓ ' + m.loseTo + ' (nhánh thua)</span>' : m.branch === 'final' ? '<span class="go">' + esc(sideName(Ls)) + ' á quân</span>' : '<span class="go">✕ ' + esc(sideName(Ls)) + ' rời giải</span>') + '</div>';
      } else {
        h += '<p class="bm-sub">Chưa thi đấu · thành viên hai đội</p><div class="bm-mem">' + ['a', 'b'].map(function (k) {
          var s = m[k];
          if (!s.team) return '<div class="side"><h4>' + dot(null) + esc(s.label) + '</h4><p class="tbd">Chờ kết quả ' + esc((s.label || '').replace(/^(Thắng|Thua) /, '')) + ' để biết đội.</p></div>';
          return '<div class="side"><h4>' + dot(s.team) + esc(teamById[s.team].name) + '</h4><ol>' + teamById[s.team].members.map(function (n, i) { return '<li>' + seedTag(i + 1) + pnPlain(n) + '</li>'; }).join('') + '</ol></div>';
        }).join('') + '</div>';
        h += '<div class="bm-next">' + (m.winTo ? '<span class="gw">Thắng → ' + m.winTo + '</span>' : '<span class="gc">Thắng là vô địch</span>') + (m.loseTo ? '<span class="gl">Thua ↓ ' + m.loseTo + '</span>' : m.branch === 'final' ? '<span class="go">Thua là á quân</span>' : '<span class="go">Thua ✕ rời giải</span>') + '</div>';
      }
      back = document.activeElement; box.querySelector('.bm-in').innerHTML = h; box.hidden = false; document.documentElement.classList.add('pm-open'); box.querySelector('.pm-x').focus();
    }
    $('bkBoard').addEventListener('click', function (e) {
      var p = e.target.closest('.bk-pipe'), c = e.target.closest('[data-m]');
      if (p) { var i = +p.dataset.e; st.focus = st.focus === i ? null : i; st.team = null; return mark(); }
      if (c) return open(c.dataset.m);
      if (st.focus != null || st.team) { st.focus = null; st.team = null; mark(); }
    });
    $('bkBoard').addEventListener('keydown', function (e) { var p = e.target.closest('.bk-pipe'); if (p && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); p.dispatchEvent(new MouseEvent('click', { bubbles: true })); } });
    document.addEventListener('click', function (e) { if (st.focus != null && !e.target.closest('#bkBoard') && !e.target.closest('.pm')) { st.focus = null; mark(); } });
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (!box.hidden) return close(); if (st.focus != null) { st.focus = null; mark(); } });
    $('bkChips').addEventListener('click', function (e) { var c = e.target.closest('[data-t]'); if (!c) return; st.team = c.dataset.t || null; /* team ids are strings in data.js */ st.focus = null; mark(); });
    $('bkScroll').addEventListener('scroll', function () { $('bkBoard').classList.add('swiped'); }, { passive: true });
    window.addEventListener('resize', fit);
    render();
    return { open: open };
  })();

  /* ---------- teams: seed tags + female label ---------- */
  $('teams').innerHTML = S.teams.map(function (t) {
    var st = teamState(t.id);
    var fem = t.members.filter(isFemale).length;
    return '<article class="team glass tilt rv"><h3 class="team-h"><button type="button" class="team-toggle" aria-expanded="false" aria-controls="roster-' + t.id + '">' +
      '<span class="tn">' + esc(t.name) + '<small>' + t.members.length + ' VĐV' + (fem ? ' · ' + fem + ' nữ' : '') + '</small></span>' +
      '<span class="badge ' + st[1] + '">' + st[0] + ' · ' + rec[t.id].w + '–' + rec[t.id].l + '</span>' + CHIP + '</button></h3>' +
      '<div class="collapse" id="roster-' + t.id + '"><div class="collapse-in"><ol>' +
      t.members.map(function (n, i) { return '<li>' + seedTag(i + 1) + pnPlain(n, 'nm') + '<span class="tags">' + (isChamp(n) ? champTag() : '') + (isFemale(n) ? femTag() : '') + '</span></li>'; }).join('') + '</ol></div></div></article>';
  }).join('');
  function syncTeamsAll() {
    var t = document.querySelectorAll('.team-toggle'), open = [].filter.call(t, function (b) { return b.getAttribute('aria-expanded') === 'true'; }).length;
    $('teamsAll').textContent = open === t.length ? 'Thu gọn tất cả' : 'Mở tất cả';
  }
  $('teamsAll').addEventListener('click', function () {
    var t = document.querySelectorAll('.team-toggle'), allOpen = [].every.call(t, function (b) { return b.getAttribute('aria-expanded') === 'true'; });
    t.forEach(function (b) { setOpen(b, !allOpen); });
    syncTeamsAll();
  });
  $('seedLegend').innerHTML = '<span>' + seedTag(1) + 'Số trong ô là seed (seed 1 viền vàng)</span><span>' + femTag() + 'VĐV nữ</span>' + (CHAMPS.length ? '<span>' + champTag() + 'Vô địch mùa trước</span>' : '') + '<span>Rê chuột (hoặc chạm) vào tên để xem nhiệt độ</span>';

  /* ---------- pick a player in the schedule: highlight their pairs + show their heat from the standings ---------- */
  var hlCss = document.createElement('style'); document.head.appendChild(hlCss);
  var allNames = {}; S.teams.forEach(function (t) { t.members.forEach(function (n) { allNames[n] = t; }); });
  var pStats = {}, heatRank = ((S.stats && S.stats.players) || []).slice().sort(function (a, b) { return b.heat - a.heat; });
  heatRank.forEach(function (p, i) { p.hrank = i + 1; pStats[p.name] = p; });
  var selP = null;
  function cssStr(v) { return '"' + String(v).replace(/["\\]/g, '\\$&') + '"'; }
  function selectPlayer(n) {
    selP = n && allNames[n] ? n : null;
    try { selP ? localStorage.setItem('gcl-player', selP) : localStorage.removeItem('gcl-player'); } catch (e) {}
    var bar = $('pFocus');
    if (!selP) { hlCss.textContent = ''; bar.hidden = true; return; }
    var q = '[data-p=' + cssStr(selP) + ']';
    hlCss.textContent =
      '#lich .pn' + q + '{background:var(--brand);color:var(--brand-ink);box-shadow:0 0 0 3px var(--brand-soft),0 4px 12px rgba(12,20,48,.18)}' +
      '#lich .pn' + q + ' .fh{color:currentColor}' +
      '#lich .pair:has(' + q + '){background:var(--brand-soft)}' +
      '#lich .match:has(' + q + ') .vs-toggle{box-shadow:0 0 0 2px var(--brand)}';
    var t = allNames[selP], codes = S.matches.filter(function (m) { return m.a.team === t.id || m.b.team === t.id; }).map(function (m) { return m.code; });
    $('pFocusName').innerHTML = '<span class="who-line">' + esc(selP) + GOAT_BADGES.get(selP) + (isChamp(selP) ? ' ' + champTag() : '') + '</span>';
    $('pFocusMeta').textContent = t.name + ' · seed ' + (t.members.indexOf(selP) + 1) + (codes.length ? ' · ' + codes.join(', ') : '');
    var st = pStats[selP];
    if (st) {
      $('pFocusHeat').hidden = false;
      $('pFocusDeg').textContent = st.heat.toFixed(1) + '°';
      var tr = $('pFocusTrend');
      tr.className = 'trend' + (st.trend > 0 ? ' up' : st.trend < 0 ? ' down' : '');
      tr.textContent = st.played ? (st.trend > 0 ? '▲ +' + st.trend : st.trend < 0 ? '▼ ' + st.trend : '—') : '';
      $('pFocusRank').textContent = 'Hạng ' + st.hrank + '/' + heatRank.length + (st.played ? ' · ' + st.won + 'T ' + st.lost + 'B' : ' · theo seed');
      $('pFocusBar').style.width = Math.max(4, Math.min(100, (st.heat - 20) / 25 * 100)).toFixed(0) + '%';
      if (st.hrank === 1 || st.heat >= 40) {
        $('pFocusHeat').classList.add('heat-aura');
      } else {
        $('pFocusHeat').classList.remove('heat-aura');
      }
    } else {
      $('pFocusHeat').hidden = true;
      $('pFocusHeat').classList.remove('heat-aura');
    }
    $('pFocusEgg').innerHTML = st ? eggBtn(st.id, selP, 'small') : '';
    bar.hidden = false;
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('button.pn'); if (!b) return;
    selectPlayer(b.dataset.p === selP ? null : b.dataset.p);
  });
  $('pFocusClear').addEventListener('click', function () { selectPlayer(null); });

  /* hover (or tap) a name outside the schedule: small glass tip with the player's heat */
  var tip = $('heatTip'), tipFor = null, tipTimer;
  function showTip(el) {
    var n = el.dataset.h, st = pStats[n]; if (!st) return;
    tipFor = el;
    var tr = st.played ? (st.trend > 0 ? '<small class="trend up">▲ +' + st.trend + '</small>' : st.trend < 0 ? '<small class="trend down">▼ ' + st.trend + '</small>' : '') : '';
    tip.innerHTML = '<span class="pf-deg"><b>' + st.heat.toFixed(1) + '°</b>' + tr + '</span><span class="thermo" aria-hidden="true"><i style="width:' + Math.max(4, Math.min(100, (st.heat - 20) / 25 * 100)).toFixed(0) + '%"></i></span>' +
      '<small>Hạng ' + st.hrank + '/' + heatRank.length + (st.played ? ' · ' + st.won + 'T ' + st.lost + 'B' : ' · theo seed') + '</small>';
    tip.hidden = false;
    var r = el.getBoundingClientRect(), w = tip.offsetWidth, h = tip.offsetHeight;
    var x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.top - h - 8;
    if (y < 70) y = r.bottom + 8;
    tip.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  }
  function hideTip() { tip.hidden = true; tipFor = null; }
  document.addEventListener('pointerover', function (e) {
    if (e.pointerType !== 'mouse') return;  // touch: the tap below shows it
    var el = e.target.closest && e.target.closest('.pn[data-h]'); if (el) showTip(el); else if (tipFor) hideTip();
  });
  document.addEventListener('focusin', function (e) { var el = e.target.closest && e.target.closest('.pn[data-h]'); if (el) showTip(el); });
  document.addEventListener('focusout', function (e) { if (tipFor && e.target === tipFor) hideTip(); });
  document.addEventListener('click', function (e) {
    var el = e.target.closest && e.target.closest('.pn[data-h]'); if (!el) return;
    clearTimeout(tipTimer); showTip(el); tipTimer = setTimeout(hideTip, 3000);
  });
  window.addEventListener('scroll', function () { if (tipFor) { var r = tipFor.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight) hideTip(); else showTip(tipFor); } }, { passive: true });
  try { var keep = localStorage.getItem('gcl-player'); if (keep) selectPlayer(keep); } catch (e) {}
  $('pairChips').innerHTML = S.pairs.map(function (p) { return '<span>' + p[0] + '–' + p[1] + '</span>'; }).join('');


  /* ---------- player profile (pop-up) and compare (2–3 on phones, 2–5 on wider screens) ----------
     Match numbers come from the GOAT data (every finished pair on the referee sheet, incl. matches not yet closed);
     heat and its trend come from the standings (closed matches). */
  var CMP = (function () {
    var players = (S.stats && S.stats.players) || [], byId = {}, G = (S.goat && S.goat.players) || {};
    players.forEach(function (p) { byId[p.id] = p; });
    var heatRank = players.slice().sort(function (a, b) { return b.heat - a.heat; }).map(function (p) { return p.id; });
    var api = { on: false, ids: [], render: function () {} };
    function max() { return window.matchMedia && window.matchMedia('(max-width: 720px)').matches ? 3 : 5; }
    function ini(n) { var w = n.trim().split(/\s+/); return (w.length > 2 ? w[w.length - 2][0] : '') + w[w.length - 1][0]; }
    function prof(id) {
      var s = byId[id] || {}, g = G[id] || {};
      return { id: id, name: s.name, team: s.team, seed: s.seed, female: s.female, heat: s.heat, trend: s.trend, played: s.played,
        n: g.n || 0, pairs: g.pairs || 0, won: g.won || 0, pf: g.pf || 0, pa: g.pa || 0, diff: g.diff || 0, atk: g.atk || 0, sup: g.sup || 0,
        eff: g.eff, rate: g.rate, run: g.run || 0, log: g.log || [], eggs: EGG.get(id), rank: heatRank.indexOf(id) + 1 };
    }
    var ROWS = [  // label, value, text, higher is better (null = not ranked)
      ['Nhiệt độ', function (q) { return q.heat; }, function (q) { return q.heat.toFixed(1) + '°'; }, true],
      ['Trận · cặp', function (q) { return q.pairs; }, function (q) { return q.n + ' · ' + q.pairs; }, null],  // 9 tiles = 3 full rows
      ['Cặp thắng–thua', function (q) { return q.won; }, function (q) { return q.won + '–' + (q.pairs - q.won); }, true],
      ['Hiệu số / cặp', function (q) { return q.pairs ? q.diff / q.pairs : -1e9; }, function (q) { return q.pairs ? (q.diff > 0 ? '+' : '') + (q.diff / q.pairs).toFixed(1) : '–'; }, true],
      ['Thủng lưới / cặp', function (q) { return q.pairs ? -q.pa / q.pairs : -1e9; }, function (q) { return q.pairs ? (q.pa / q.pairs).toFixed(1) : '–'; }, true],
      ['Tấn công / cặp', function (q) { return q.pairs ? q.atk / q.pairs : -1e9; }, function (q) { return q.pairs ? (q.atk / q.pairs).toFixed(1) : '–'; }, true],
      ['Hỗ trợ / cặp', function (q) { return q.pairs ? q.sup / q.pairs : -1e9; }, function (q) { return q.pairs ? (q.sup / q.pairs).toFixed(1) : '–'; }, true],
      ['Hiệu suất', function (q) { return q.eff == null ? -1 : q.eff; }, function (q) { return q.eff == null ? '–' : q.eff + '%'; }, true],
      ['Chuỗi dài nhất', function (q) { return q.run; }, function (q) { return q.run || '–'; }, true],
      ['Hoa', function (q) { return q.eggs; }, function (q) { return q.eggs; }, null]];
    var box = document.createElement('div'); box.className = 'pm'; box.hidden = true;
    box.innerHTML = '<div class="pm-card glass" role="dialog" aria-modal="true" aria-labelledby="pmTitle"><button type="button" class="pm-x" aria-label="Đóng"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button><div class="pm-in"></div></div>';
    document.body.appendChild(box);
    var inner = box.querySelector('.pm-in'), back = null;
    var card = box.querySelector('.pm-card');
    function open(html, kind) { back = document.activeElement; inner.innerHTML = html; card.className = 'pm-card glass ' + (kind || ''); box.hidden = false; document.documentElement.classList.add('pm-open'); box.querySelector('.pm-x').focus(); }
    function close() { box.hidden = true; document.documentElement.classList.remove('pm-open'); if (back && back.focus) back.focus(); }
    box.addEventListener('click', function (e) { if (e.target === box || e.target.closest('.pm-x')) close(); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(); });
    function tags(q) { return esc(teamById[q.team].name) + seedTag(q.seed) + (q.female ? femTag() : '') + (isChamp(q.name) ? champTag() : ''); }
    function profile(id) {
      var q = prof(id); if (!q.name) return;
      var w = Math.max(4, Math.min(100, (q.heat - 20) / 25 * 100)), tr = q.played ? (q.trend > 0 ? '▲ +' + q.trend : q.trend < 0 ? '▼ ' + q.trend : 'giữ nguyên') : 'theo seed';
      var tiles = ROWS.slice(1).map(function (r) { return '<div><b>' + esc(String(r[2](q))) + '</b><small>' + r[0] + '</small></div>'; }).join('');
      var peers = players.filter(function (p) { return p.seed === q.seed && p.id !== id; }).sort(function (a, b) { return (G[b.id] ? 1 : 0) - (G[a.id] ? 1 : 0) || b.heat - a.heat; }).slice(0, 3);
      var sugg = '<div class="pm-sugg"><p class="pm-h">So sánh nhanh · cùng hạt giống ' + q.seed + '</p><div>' + peers.map(function (p) {
        return '<button type="button" class="pm-chip" data-cmp-with="' + esc(id) + ',' + esc(p.id) + '"><b>' + esc(p.name.split(' ').slice(-2).join(' ')) + '</b><small>' + esc(teamById[p.team].name) + ' · ' + p.heat.toFixed(1) + '°</small></button>';
      }).join('') + '<button type="button" class="pm-chip more" data-cmp-add="' + esc(id) + '"><b>Chọn người khác</b><small>' + (api.ids.indexOf(id) >= 0 ? 'đang trong so sánh' : 'tối đa ' + max() + ' người') + '</small></button></div></div>';
      var arcPct = Math.max(0, Math.min(1, (q.heat - 20) / 25));
      var dashoffset = Math.round(126 * (1 - arcPct));
      var isHot = q.rank === 1 || q.heat >= 40;
      var auraCls = isHot ? ' heat-aura' : '';

      var gaugeHtml = '<div class="pm-gauge-box' + auraCls + '"><div class="pm-gauge-arc">' +
        '<svg viewBox="0 0 100 56" class="pm-gauge-svg" aria-hidden="true">' +
          '<path d="M 12 48 A 38 38 0 0 1 88 48" class="pm-gauge-bg" stroke-width="7" stroke-linecap="round" fill="none"/>' +
          '<path d="M 12 48 A 38 38 0 0 1 88 48" class="pm-gauge-val" stroke-width="7" stroke-linecap="round" fill="none" stroke-dasharray="126" stroke-dashoffset="' + dashoffset + '"/>' +
        '</svg><b>' + q.heat.toFixed(1) + '°</b></div>' +
        '<div class="pm-gauge-text"><small>Nhiệt độ</small>' +
          '<span class="trend ' + (q.trend > 0 ? 'up' : q.trend < 0 ? 'down' : '') + '">' + tr + '</span>' +
          '<span class="pm-rank">Hạng ' + q.rank + '/30</span>' +
        '</div>' +
      '</div>';

      open('<div class="pm-head"><span class="av">' + esc(ini(q.name)) + '</span><div><h3 id="pmTitle" class="pm-title-line">' + esc(q.name) + GOAT_BADGES.get(q.name) + '</h3><p class="pm-tags">' + tags(q) + '</p></div>' +
        gaugeHtml + '</div>' +
        '<div class="pm-tiles">' + tiles + '</div>' + sugg +
        '<p class="pm-note">' + (S.goat ? 'Số liệu trận tính đến ' + esc(S.goat.asof) + ', gồm cặp của trận chưa chốt; nhiệt độ theo BXH.' : 'Chưa có dữ liệu trận.') + '</p>', 'prof');
    }
    function compare() {
      var qs = api.ids.map(prof);
      var head = '<tr><th></th>' + qs.map(function (q) { return '<th><button type="button" class="pname" data-pid="' + esc(q.id) + '">' + esc(q.name.split(' ').slice(-2).join(' ')) + '</button><small>' + esc(teamById[q.team].name) + ' · seed ' + q.seed + '</small></th>'; }).join('') + '</tr>';
      var body = ROWS.map(function (r) {
        var vals = qs.map(r[1]), best = r[3] ? Math.max.apply(null, vals) : null, nBest = vals.filter(function (v) { return v === best; }).length;
        return '<tr><th>' + r[0] + '</th>' + qs.map(function (q, k) { return '<td class="' + (r[3] && vals[k] === best && nBest < qs.length ? 'best' : '') + '">' + esc(String(r[2](q))) + '</td>'; }).join('') + '</tr>';
      }).join('');
      open('<h3 id="pmTitle">So sánh ' + qs.length + ' VĐV</h3>' +
        '<div class="cmp-wrap"><table class="cmp"><thead>' + head + '</thead><tbody>' + body + '</tbody></table></div>' +
        '<p class="pm-note">Ô tô đậm = tốt nhất trong nhóm. ' + (S.goat ? 'Số liệu trận tính đến ' + esc(S.goat.asof) + '.' : '') + '</p>', 'wide c' + qs.length);
    }
    var tray = document.createElement('div'); tray.className = 'cmp-tray glass'; tray.hidden = true; document.body.appendChild(tray);
    api.tray = function () {
      tray.hidden = !api.on;
      if (!api.on) return;
      var m = max(); if (api.ids.length > m) api.ids = api.ids.slice(0, m);
      tray.innerHTML = '<span>' + (api.ids.length ? api.ids.map(function (id) { return '<em>' + esc(prof(id).name.split(' ').pop()) + '</em>'; }).join('') : 'Chọn 2–' + m + ' VĐV để so sánh') + '</span>' +
        '<button type="button" class="cta" id="cmpGo"' + (api.ids.length < 2 ? ' disabled' : '') + '>So sánh ' + api.ids.length + '/' + m + '</button><button type="button" class="cmp-off" id="cmpOff" aria-label="Tắt so sánh">✕</button>';
    };
    function toggle(id) {
      var k = api.ids.indexOf(id);
      if (k >= 0) api.ids.splice(k, 1); else if (api.ids.length < max()) api.ids.push(id);
      api.render();
    }
    document.addEventListener('click', function (e) {
      var t;
      if ((t = e.target.closest('[data-pid]'))) { e.preventDefault(); return profile(t.dataset.pid); }
      if ((t = e.target.closest('[data-cmp]'))) return toggle(t.dataset.cmp);
      if ((t = e.target.closest('[data-cmp-with]'))) { api.ids = t.dataset.cmpWith.split(','); api.on = true; api.render(); return compare(); }
      if ((t = e.target.closest('[data-cmp-add]'))) {
        var id = t.dataset.cmpAdd; api.on = true; if (api.ids.indexOf(id) < 0 && api.ids.length < max()) api.ids.push(id);
        close(); api.render(); var b = $('bxh'); if (b) b.scrollIntoView({ behavior: 'smooth' }); return;
      }
      if (e.target.closest('#cmpGo')) return compare();
      if (e.target.closest('#cmpOff')) { api.on = false; api.ids = []; return api.render(); }
    });
    return api;
  })();

  /* ---------- standings & stats (BXH): team table, matches, players; recalculated by the build after every result ---------- */
  (function () {
    var ST = S.stats || { teams: [], players: [], highlights: {}, played: 0 };
    var bar = $('bxhBar'), body = $('bxhBody'), note = $('bxhNote');
    var state = { tab: 'player', teamFilter: 'all', matchFilter: 'all', matchTeam: '', metric: 'eggs', pTeam: '', pSeed: '', pFem: false, showAll: false };
    var STATUS = { champ: ['Vô địch', 'champ'], runner: ['Á quân', 'win'], win: ['Nhánh thắng', 'win'], lose: ['Nhánh thua', 'lose'], out: ['Đã dừng', 'out'] };
    function avg(k) { return function (p) { return p.played ? (p[k] || 0) / p.played : -1e9; }; }
    function avgTxt(k, signed) { return function (p) { if (!p.played) return '–'; var v = (p[k] || 0) / p.played, t = (Math.round(v * 10) / 10).toFixed(1).replace('.0', ''); return (signed && v > 0 ? '+' : '') + t + '<small class="per">/cặp</small>'; }; }
    var METRICS = [
      ['heat', 'Nhiệt độ', function (p) { return p.heat; }, function (p) { return p.heat.toFixed(1) + '°'; }],
      ['eggs', 'Hoa', function (p) { return EGG.get(p.id); }, function (p) { return EGG.get(p.id); }],
      ['won', 'Cặp thắng', function (p) { return p.won; }, function (p) { return p.won; }],
      /* point metrics rank by the average per pair played (owner, 2026-11-11): a player who missed a pair is not behind for it */
      ['atk', 'Tấn công', avg('atk'), avgTxt('atk'), 'atk'],
      ['sup', 'Hỗ trợ', avg('sup'), avgTxt('sup'), 'sup'],
      ['diff', 'Hiệu số', avg('diff'), avgTxt('diff', true), 'diff'],
      /* v1.27.0: "Tỉ lệ thắng" dropped (owner; Nhiệt độ already weighs the win rate) and "Điểm ghi" dropped (= Tấn công + Hỗ trợ exactly);
         added Thủng lưới/cặp (fewer is better) and Hiệu suất (share of the team's points the player scored) */
      ['pa', 'Thủng lưới', function (p) { return p.played ? -p.pa / p.played : -1e9; }, function (p) { return p.played ? (Math.round(p.pa / p.played * 10) / 10).toFixed(1).replace('.0', '') + '<small class="per">/cặp</small>' : '–'; }, 'pa'],
      ['eff', 'Hiệu suất', function (p) { return p.pf ? (p.atk || 0) / p.pf : -1; }, function (p) { return p.pf ? Math.round(100 * (p.atk || 0) / p.pf) + '%' : '–'; }]
    ];
    function sign(n) { return (n > 0 ? '+' : '') + n; }
    function dcls(n) { return n > 0 ? 'pos-n' : n < 0 ? 'neg-n' : ''; }
    function initials(name) { var w = name.trim().split(/\s+/); return (w.length > 2 ? w[w.length - 2][0] : '') + w[w.length - 1][0]; }
    function chips(name, items, cur, key, label) {
      return '<div class="chipset" role="group" aria-label="' + name + '">' + (label ? '<span class="chip-lbl">' + esc(label) + '</span>' : '') + items.map(function (it) {
        return '<button type="button" class="chip"' + (key ? ' data-k="' + key + '"' : '') + ' data-v="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + esc(it[1]) + '</button>';
      }).join('') + '</div>';
    }
    function teamOpts(cur) {
      return '<option value="">Tất cả đội</option>' + S.teams.map(function (t) { return '<option value="' + t.id + '"' + (t.id === cur ? ' selected' : '') + '>' + esc(t.name) + '</option>'; }).join('');
    }

    function renderTeam() {
      bar.innerHTML = chips('Lọc đội', [['all', 'Tất cả'], ['win', 'Nhánh thắng'], ['lose', 'Nhánh thua'], ['out', 'Đã dừng']], state.teamFilter);
      var rows = ST.teams.filter(function (r) {
        if (state.teamFilter === 'all') return true;
        if (state.teamFilter === 'out') return r.status === 'out' || r.status === 'runner';
        if (state.teamFilter === 'win') return r.status === 'win' || r.status === 'champ';
        return r.status === state.teamFilter;
      });
      if (!rows.length) { body.innerHTML = '<p class="board-empty">Không có đội nào ở nhóm này.</p>'; return; }
      body.innerHTML = '<div class="tbl-scroll"><table class="tbl"><caption class="sr">Bảng xếp hạng đội</caption><thead><tr><th class="l">#</th><th class="l">Đội</th><th>Trận</th><th>Thắng</th><th>Thua</th><th class="opt">Cặp</th><th class="opt">Điểm</th><th class="opt">Hiệu số</th><th>HS/cặp</th><th class="opt">Phong độ</th><th>Trạng thái</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var st = STATUS[r.status], hd = r.pf - r.pa;
          var form = r.form.length ? r.form.map(function (f) { return '<i class="' + (f.win ? 'fw' : 'fl') + '" title="' + f.code + '">' + (f.win ? 'T' : 'B') + '</i>'; }).join('') : '<span class="none">–</span>';
          return '<tr class="' + (r.pos === 1 && ST.played ? 'top' : '') + '"><td class="pos">' + r.pos + '</td><td class="l tm">' + esc(teamById[r.team].name) + '</td><td>' + r.played + '</td><td class="strong">' + r.w + '</td><td>' + r.l + '</td>' +
            '<td class="opt">' + r.pw + '–' + r.pl + '</td><td class="opt">' + r.pf + '–' + r.pa + '</td><td class="opt ' + dcls(hd) + '">' + sign(hd) + '</td><td class="strong ' + dcls(r.dpp || 0) + '">' + (r.dpp == null ? '–' : sign(r.dpp)) + '</td><td class="opt"><span class="form">' + form + '</span></td><td><span class="badge ' + st[1] + '">' + st[0] + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
      note.textContent = 'Xếp theo: vô địch / á quân, rồi số trận thắng, ít trận thua, tỉ lệ thắng cặp, hiệu số điểm mỗi cặp (HS/cặp = tổng hiệu số chia số cặp đã đấu, cặp vắng không tính). Đội bị loại xếp theo vòng bị loại.';
    }

    function renderMatch() {
      bar.innerHTML = chips('Lọc trận', [['all', 'Tất cả'], ['done', 'Đã đấu'], ['win', 'Nhánh thắng'], ['lose', 'Nhánh thua'], ['final', 'Chung kết']], state.matchFilter) +
        '<div class="filters-r"><label class="sr" for="bxhMatchTeam">Lọc theo đội</label><select class="sel" id="bxhMatchTeam">' + teamOpts(state.matchTeam) + '</select></div>';
      var h = ST.highlights || {}, hl = '';
      if (h.biggest) {
        var lp = h.longestPair;
        hl = '<div class="hl-row"><div class="hl"><small>Cách biệt lớn nhất</small><b>' + h.biggest.margin + ' điểm</b><span>' + h.biggest.code + ' · ' + esc(sideName(byCode[h.biggest.code].a)) + ' – ' + esc(sideName(byCode[h.biggest.code].b)) + '</span></div>' +
          '<div class="hl"><small>Trận sít sao nhất</small><b>' + h.closest.margin + ' điểm</b><span>' + h.closest.code + ' · ' + esc(sideName(byCode[h.closest.code].a)) + ' – ' + esc(sideName(byCode[h.closest.code].b)) + '</span></div>' +
          (lp ? '<div class="hl"><small>Cặp nhiều điểm nhất</small><b>' + lp.score[0] + '–' + lp.score[1] + '</b><span>' + lp.code + ' · cặp ' + S.pairs[lp.pair].join('–') + '</span></div>' : '') + '</div>';
      }
      var rows = S.matches.filter(function (m) {
        if (state.matchFilter === 'done' && !m.result) return false;
        if (['win', 'lose', 'final'].indexOf(state.matchFilter) >= 0 && m.branch !== state.matchFilter) return false;
        if (state.matchTeam && m.a.team !== state.matchTeam && m.b.team !== state.matchTeam) return false;
        return true;
      });
      body.innerHTML = hl + (rows.length ? rows.map(function (m) {
        var r = m.result, cls = function (k) { return m.winner ? (m.winner === k ? 'won' : 'lo') : ''; };
        var sc = r ? r.a + ' : ' + r.b + '<small>cặp ' + r.pa + '–' + r.pb + '</small>' : '<small>' + (status(m) === 'wait' ? 'Chờ kết quả' : 'Chưa đấu') + '</small>';
        var meta = r ? 'Cách biệt ' + Math.abs(r.a - r.b) + (r.pairs ? absentTxt(r) : ' · chưa có điểm từng cặp') : esc(m.round);
        return '<div class="mrow"><div class="when"><span class="' + tagCls(m) + '">' + m.code + '</span><span>' + m.date.slice(0, 5) + '</span></div>' +
          '<div class="vs"><span class="' + cls('a') + '">' + esc(sideName(m.a)) + '</span><span class="sc">' + sc + '</span><span class="' + cls('b') + '">' + esc(sideName(m.b)) + '</span></div><div class="meta">' + meta + '</div></div>';
      }).join('') : '<p class="board-empty">Không có trận nào khớp bộ lọc.</p>');
      note.textContent = ST.played ? 'Đã đấu ' + ST.played + '/' + S.matches.length + ' trận.' : 'Chưa có trận nào kết thúc. Kết quả và các chỉ số sẽ hiện sau trận đầu tiên (04/11).';
    }

    function renderPlayer() {
      /* seed filter as chips: one seed, all, or "Chia nhóm" = a separate ranking for each seed 1–5 */
      /* phones (≤560 px): metrics scroll in one row; seed / team / women sit behind one "Lọc" button (BASEMENT §6) */
      var nf = (state.pSeed ? 1 : 0) + (state.pTeam ? 1 : 0) + (state.pFem ? 1 : 0);
      bar.innerHTML = '<div class="m-scroll">' + chips('Chỉ số', METRICS.map(function (m) { return [m[0], m[1]]; }), state.metric) + '</div>' +
        '<div class="ph-tools"><button type="button" class="flt-tgl" id="bxhFlt" aria-expanded="' + !!state.fOpen + '" aria-controls="bxhFltBox"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>Lọc' + (nf ? ' <b>' + nf + '</b>' : '') + '</button></div>' +
        '<div class="flt' + (state.fOpen ? ' open' : '') + '" id="bxhFltBox">' +
        chips('Hạt giống', [['', 'Tất cả'], ['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5'], ['group', 'Chia nhóm']], state.pSeed, 'seed', 'Hạt giống') +
        '<div class="filters-r"><label class="sr" for="bxhPTeam">Lọc theo đội</label><select class="sel" id="bxhPTeam">' + teamOpts(state.pTeam) + '</select>' +
        '<label class="tgl"><input type="checkbox" id="bxhPFem"' + (state.pFem ? ' checked' : '') + '>Chỉ VĐV nữ</label></div></div>' +
        '<button type="button" class="cmp-tgl" id="bxhCmp" aria-pressed="' + CMP.on + '"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 4v16M16 4v16M4 8h8M12 16h8"/></svg>So sánh</button>';
      var M = METRICS.filter(function (m) { return m[0] === state.metric; })[0];
      var grouped = state.pSeed === 'group';
      var list = ST.players.filter(function (p) {
        return (!state.pTeam || p.team === state.pTeam) && (grouped || !state.pSeed || String(p.seed) === state.pSeed) && (!state.pFem || p.female);
      }).sort(function (x, y) { return M[2](y) - M[2](x) || y.heat - x.heat || x.seed - y.seed; });
      if (!list.length) { body.innerHTML = '<p class="board-empty">Không có VĐV nào khớp bộ lọc.</p>'; return; }
      var olCls = '<ol class="plist' + (state.metric === 'eggs' ? ' eggs-mode' : '') + '">';
      if (grouped) {
        body.innerHTML = [1, 2, 3, 4, 5].map(function (sd) {
          var g = list.filter(function (p) { return p.seed === sd; });
          return g.length ? '<h3 class="pgroup">Hạt giống ' + sd + '</h3>' + olCls + g.map(row).join('') + '</ol>' : '';
        }).join('');
      } else {
        var shown = state.showAll ? list : list.slice(0, 10);
        body.innerHTML = olCls + shown.map(row).join('') + '</ol>' + (list.length > 10 ? '<button type="button" class="more" id="bxhMore">' + (state.showAll ? 'Thu gọn' : 'Xem tất cả ' + list.length + ' VĐV') + '</button>' : '');
      }
      function row(p, i) {
        var main = M[3](p), sub = '';
        if (state.metric === 'eggs') {
          main = '<span class="egg-main"><span data-egg-n="' + esc(p.id) + '">' + EGG.get(p.id) + '</span>' + bqChip(p.id) + '</span>';
          sub = '<small>' + p.heat.toFixed(1) + '° nhiệt độ</small>';
        } else if (state.metric === 'heat') {
          var w = Math.max(4, Math.min(100, (p.heat - 20) / 25 * 100));
          sub = '<span class="thermo" aria-hidden="true"><i style="width:' + w.toFixed(0) + '%"></i></span>' +
            (p.played ? '<small class="trend ' + (p.trend > 0 ? 'up' : p.trend < 0 ? 'down' : '') + '">' + (p.trend > 0 ? '▲ +' + p.trend : p.trend < 0 ? '▼ ' + p.trend : 'giữ nguyên') + '</small>' : '<small>theo seed</small>');
        } else if (M[4]) {
          var tot = p[M[4]] || 0;
          sub = '<small>' + (M[4] === 'pa' ? 'thua ' : 'tổng ') + (M[4] === 'diff' && tot > 0 ? '+' : '') + tot + ' · ' + p.played + ' cặp</small>';
        } else {
          sub = '<small>' + p.played + ' cặp · ' + p.won + 'T ' + p.lost + 'B</small>';
        }
        var picked = CMP.ids.indexOf(p.id) >= 0;
        return '<li class="prow' + (i === 0 ? ' top' : '') + (CMP.on ? ' cmp-on' : '') + (picked ? ' picked' : '') + '">' +
          (CMP.on ? '<button type="button" class="cmp-pick" data-cmp="' + esc(p.id) + '" aria-pressed="' + picked + '" aria-label="Chọn ' + esc(p.name) + ' để so sánh"></button>' : '') +
          '<span class="rk">' + (i + 1) + '</span><span class="av" aria-hidden="true">' + esc(initials(p.name)) + '</span>' +
          '<span class="who"><span class="who-line"><button type="button" class="pname" data-pid="' + esc(p.id) + '">' + esc(p.name) + '</button>' + GOAT_BADGES.get(p.name, state.metric) + '</span><small>' + esc(teamById[p.team].name) + seedTag(p.seed) + (p.female ? femTag() : '') + (isChamp(p.name) ? champTag() : '') + '</small></span>' +
          '<span class="val"><b>' + main + '</b>' + sub + '</span>' + (state.metric === 'eggs' ? eggBtn(p.id, p.name) : '') + '</li>';
      }
      note.textContent = state.metric === 'eggs'
        ? 'Bấm nút bông hoa ở mỗi dòng để tặng hoa, mỗi lần ra một bông khác nhau. 10 bông mới gói thành 1 bó. Bấm liền 3 lần để vào chuỗi hoa. ' + (EGG.state() === 'local' ? 'Hiện đang đếm trên máy của bạn, chưa nối bảng chung.' : 'Đếm chung cho mọi người, cập nhật trực tiếp.')
        : state.metric === 'heat'
        ? 'Nhiệt độ 20°–45°: lúc đầu tính theo seed; sau mỗi trận, tỉ lệ thắng cặp và hiệu số điểm của chính VĐV dần thay thế điểm khởi đầu. Mũi tên so với trước trận gần nhất.'
        : state.metric === 'eff' ? 'Hiệu suất = điểm VĐV tự ghi (tấn công) / điểm cả cặp ghi khi VĐV trên sân. '
        : (/^(atk|sup|diff|pa)$/.test(state.metric) ? 'Xếp theo trung bình mỗi cặp đã đấu (tổng chia số cặp), nên VĐV vắng cặp không bị thiệt' + (state.metric === 'pa' ? '; thủng lưới càng ít càng tốt. ' : '. ') : 'Chỉ số tính từ điểm từng cặp đã nhập. ') + (ST.played ? '' : 'Chưa có trận nào, tạm xếp theo seed.');
    }

    function render() {
      ({ team: renderTeam, match: renderMatch, player: renderPlayer })[state.tab]();
      CMP.tray();
    }
    var tabs = $('bxhTabs').querySelectorAll('button');
    $('bxhTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.tab = b.dataset.tab; state.showAll = false;
      tabs.forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      render();
    });
    CMP.render = render;
    bar.addEventListener('click', function (e) {
      if (e.target.closest('#bxhCmp')) { CMP.on = !CMP.on; if (!CMP.on) CMP.ids = []; return render(); }
      if (e.target.closest('#bxhFlt')) { state.fOpen = !state.fOpen; return render(); }
      var c = e.target.closest('.chip'); if (!c) return;
      if (state.tab === 'team') state.teamFilter = c.dataset.v;
      else if (state.tab === 'match') state.matchFilter = c.dataset.v;
      else if (c.dataset.k === 'seed') { state.pSeed = c.dataset.v; state.showAll = false; }
      else { state.metric = c.dataset.v; state.showAll = false; }
      render();
    });
    bar.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'bxhMatchTeam') state.matchTeam = t.value;
      if (t.id === 'bxhPTeam') state.pTeam = t.value;
      if (t.id === 'bxhPFem') state.pFem = t.checked;
      state.showAll = false;
      render();
    });
    body.addEventListener('click', function (e) { if (e.target.id === 'bxhMore') { state.showAll = !state.showAll; render(); } });
    var eggRe;
    EGG.on(function () {  // re-sort the egg board shortly after the throwing stops
      if (state.tab !== 'player' || state.metric !== 'eggs') return;
      clearTimeout(eggRe); eggRe = setTimeout(render, 1500);
    });
    $('bxhEyebrow').textContent = ST.played ? 'Sau ' + ST.played + ' trận · tự cập nhật' : 'Tự cập nhật sau mỗi trận';
    render();
  })();


  /* ---------- mascot: a robot-heads TV robot (MIT, vendored) that reminds the schedule; its face follows what is happening ---------- */
  (function () {
    var root = $('mascot'); if (!root) return;
    var bubble = $('msBubble'), text = $('msText'), act = $('msAct');
    var phone = window.matchMedia && matchMedia('(max-width: 900px)').matches, quiet = window.matchMedia && matchMedia('(max-width: 560px)').matches;  // phones: no text bubble, face + voice only
    var bot = window.RobotHeads ? RobotHeads.mount($('msRobot'), { shape: 'rectangle', size: phone ? 64 : 112, color: '#22337F', trimColor: '#D9C08A', screenColor: '#E9EDFF', seed: .42, label: 'Robot của giải' }) : null;
    var base = 'idle', moodT;
    function mood(m, ms) { if (!bot) return; clearTimeout(moodT); bot.setState(m); if (ms) moodT = setTimeout(function () { bot.setState(base); }, ms); }
    window.mascotMood = mood;
    var pref = (function () { try { return localStorage.getItem('gcl-mascot'); } catch (e) { return null; } })();
    function save(v) { try { localStorage.setItem('gcl-mascot', v); } catch (e) {} }
    var msgs = [];
    if (nextM) {
      var dl = daysLeft(nextM), sameDay = S.matches.filter(function (m) { return m.date === nextM.date && !m.result; });
      if (dl === 0) base = 'happy';
      msgs.push([dl === 0 ? 'Hôm nay có trận ' + sameDay.map(function (m) { return m.code; }).join(' & ') + '! Nhớ ra sân cổ vũ nha.'
        : dl === 1 ? 'Mai thi đấu rồi! ' + nextM.code + ': ' + sideName(nextM.a) + ' vs ' + sideName(nextM.b) + '.'
        : 'Còn ' + dl + ' ngày tới ' + nextM.code + ': ' + sideName(nextM.a) + ' vs ' + sideName(nextM.b) + ', ' + S.rules.weekday + ' ' + nextM.date.slice(0, 5) + '.', 'Xem lịch', '#lich']);
    }
    var lastDone = S.matches.filter(function (m) { return m.result; }).slice(-1)[0];
    if (lastDone) msgs.push(['Kết quả mới: ' + lastDone.code + ' ' + sideName(lastDone.a) + ' ' + lastDone.result.a + '–' + lastDone.result.b + ' ' + sideName(lastDone.b) + '.', 'Xem BXH', '#bxh']);
    msgs.push(['Thấy ai đánh hay? Vào BXH tặng hoa, đủ 10 bông là thành một bó!', 'Tặng hoa', '#bxh', 'eggs']);
    msgs.push(['Chạm vào tên VĐV trong lịch để xem cặp đấu và nhiệt độ của người đó.', 'Mở lịch', '#lich']);
    var i = 0, cycle;
    function show(k) {
      var m = msgs[k % msgs.length]; text.textContent = m[0];
      act.textContent = m[1]; act.setAttribute('href', m[2]); act.dataset.eggs = m[3] || '';
      if (!quiet) { bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); }
      mood('speaking', Math.min(4200, 900 + m[0].length * 45));
    }
    window.mascotSay = function (t, m) { if (root.classList.contains('away')) return; mood(m || 'speaking', 2500); if (quiet) return; text.textContent = t; act.hidden = true; bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop'); clearTimeout(cycle); cycle = setTimeout(function () { act.hidden = false; bubble.hidden = true; }, 4000); };
    function start() { clearTimeout(cycle); show(i); cycle = setTimeout(function next() { bubble.hidden = true; cycle = setTimeout(function () { i++; show(i); cycle = setTimeout(next, 9000); }, 20000); }, 9000); }
    function away(on) {
      root.classList.toggle('away', on); save(on ? 'away' : 'on');
      if (on) { clearTimeout(cycle); bubble.hidden = true; base = 'sleeping'; mood('sleeping'); } else { base = nextM && daysLeft(nextM) === 0 ? 'happy' : 'idle'; mood(base); }
    }
    if (pref === 'away') away(true); else { mood(base); setTimeout(start, 2500); }
    $('msBody').addEventListener('click', function () {
      if (root.classList.contains('away')) { away(false); start(); return; }
      if (bot) bot.poke();
      i++; start();
    });
    $('msClose').addEventListener('click', function () { away(true); });
    if ($('msHide')) $('msHide').addEventListener('click', function () { away(true); });
    act.addEventListener('click', function () {
      bubble.hidden = true;
      if (act.dataset.eggs) { var t = document.querySelector('#bxhTabs [data-tab="player"]'); if (t) t.click(); var c = document.querySelector('#bxhBar .chip[data-v="eggs"]'); if (c) c.click(); }
    });
    /* react to the page: error if the flower board is offline, happy on every flower */
    var lastEgg = EGG.state();
    EGG.on(function () {
      var st = EGG.state(); if (st === lastEgg) return; lastEgg = st;
      if (st === 'offline') mood('error', 2500);
    });
  })();

  /* ---------- gallery + lightbox ---------- */
  var albums = S.gallery.filter(function (a) { return a.items.length; }), all = [];
  albums.forEach(function (a) { a.items.forEach(function (it) { all.push({ src: it.src, thumb: it.thumb, w: it.w, h: it.h, caption: it.caption, album: a.album }); }); });
  var shown = all, lbIndex = 0;
  if (!all.length) { $('galleryEmpty').hidden = false; $('albumFilters').hidden = true; }
  else {
    var fl = [['*', 'Tất cả']].concat(albums.map(function (a) { return [a.album, a.title]; }));
    $('albumFilters').innerHTML = fl.map(function (f, i) { return '<button type="button" role="tab" aria-selected="' + !i + '" data-album="' + esc(f[0]) + '">' + esc(f[1]) + '</button>'; }).join('');
    $('albumFilters').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      $('albumFilters').querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      renderGallery(b.dataset.album);
    });
    renderGallery('*');
  }
  function renderGallery(album) {
    shown = album === '*' ? all : all.filter(function (x) { return x.album === album; });
    $('gallery').innerHTML = shown.map(function (x, i) {
      var wh = x.w && x.h ? ' width="' + x.w + '" height="' + x.h + '"' : '';
      return '<button type="button" class="g-item" data-i="' + i + '" aria-label="Xem ảnh ' + (i + 1) + (x.caption ? ': ' + esc(x.caption) : '') + '"><img src="' + esc(x.thumb || x.src) + '" alt="' + esc(x.caption) + '" loading="lazy" decoding="async"' + wh + '>' +
        (x.caption ? '<span class="cap glass-dark">' + esc(x.caption) + '</span>' : '') + '</button>';
    }).join('');
    $('gallery').querySelectorAll('img').forEach(function (img) { if (img.complete) img.classList.add('loaded'); else img.addEventListener('load', function () { img.classList.add('loaded'); }); });
  }
  $('gallery').addEventListener('click', function (e) { var b = e.target.closest('.g-item'); if (b) openLb(+b.dataset.i, b); });
  var lb = $('lightbox'), lbImg = $('lbImg'), opener = null;
  function showLb(i) {
    lbIndex = (i + shown.length) % shown.length;
    var x = shown[lbIndex];
    lbImg.src = x.src; lbImg.alt = x.caption || '';
    lbImg.style.animation = 'none'; void lbImg.offsetWidth; lbImg.style.animation = '';
    $('lbCap').textContent = x.caption || ''; $('lbCap').hidden = !x.caption;
    $('lbCount').textContent = (lbIndex + 1) + ' / ' + shown.length;
    [1, -1].forEach(function (d) { (new Image()).src = shown[(lbIndex + d + shown.length) % shown.length].src; });
  }
  function openLb(i, from) { opener = from; lb.hidden = false; document.body.classList.add('lock'); showLb(i); $('lbClose').focus(); }
  function closeLb() { lb.hidden = true; document.body.classList.remove('lock'); lbImg.removeAttribute('src'); if (opener) opener.focus(); }
  $('lbClose').addEventListener('click', closeLb);
  $('lbPrev').addEventListener('click', function () { showLb(lbIndex - 1); });
  $('lbNext').addEventListener('click', function () { showLb(lbIndex + 1); });
  lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) {
    if (lb.hidden) return;
    if (e.key === 'Escape') closeLb();
    if (e.key === 'ArrowLeft') showLb(lbIndex - 1);
    if (e.key === 'ArrowRight') showLb(lbIndex + 1);
    if (e.key === 'Tab') {
      var f = lb.querySelectorAll('button'), first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });
  swipe(lb, function () { showLb(lbIndex + 1); }, function () { showLb(lbIndex - 1); });

  /* ---------- "Kết quả": match-day reports (newest first) and the GOAT of every stat, both linked to their PDF ---------- */
  (function () {
    var body = $('kqBody'), tabs = $('kqTabs'); if (!body || !tabs) return;
    var reps = S.reports || [], goat = S.goat, tab = 'day';
    function pdf(href, label) { return '<a class="cta kq-pdf" href="' + esc(href) + '" target="_blank" rel="noopener">' + esc(label) + ARROW + '</a>'; }
    function results(r) {  // the day's matches as they stand in the build (closed result, or "chờ chốt")
      return S.matches.filter(function (m) { return m.date === r.date && m.a.team && m.b.team; }).map(function (m) {
        var a = sideName(m.a), b = sideName(m.b), res = m.result;
        return '<div class="kq-m"><span class="' + tagCls(m) + '">' + esc(m.code) + '</span><span class="kq-t ta' + (m.winner === 'a' ? ' win' : '') + '">' + esc(a) + '</span>' +
          '<b>' + (res ? res.a + '–' + res.b : '–') + '</b><span class="kq-t tb' + (m.winner === 'b' ? ' win' : '') + '">' + esc(b) + '</span>' +
          '<small>' + (res ? 'Đã chốt · cặp ' + res.pa + '–' + res.pb : 'Chờ chốt') + '</small></div>';
      }).join('');
    }
    function day() {
      if (!reps.length) return '<p class="board-empty">Báo cáo đầu tiên sẽ có sau ngày thi đấu 1.</p>';
      return reps.map(function (r, i) {
        return '<article class="kq-card glass' + (i ? ' old' : '') + '"><p class="eyebrow">' + esc(r.eyebrow) + '</p><h3>' + esc(r.title) + '</h3>' +
          '<div class="kq-ms">' + results(r) + '</div>' +
          '<div class="kq-stats">' + (r.stats || []).map(function (x) { return '<div><b>' + esc(x.v) + '</b><small>' + esc(x.k) + '</small></div>'; }).join('') + '</div>' +
          pdf(r.href, 'Báo cáo ngày ' + r.day + ' (PDF)') + '</article>';
      }).join('');
    }
    function goatHtml() {
      if (!goat) return '<p class="board-empty">Báo cáo GOAT sẽ có sau ngày thi đấu đầu tiên.</p>';
      return '<p class="kq-scope">' + esc(goat.scope) + '</p><div class="kq-goat">' + goat.cats.map(function (c) {
        return '<div class="kq-g glass"><p class="kq-gt">' + esc(c.title) + '</p><div class="kq-g1"><span class="crown">GOAT</span><b>' + esc(c.value) + '</b></div>' +
          '<p class="kq-gn"><span class="who-line"><button type="button" class="pname" data-pid="' + esc(c.id || '') + '">' + esc(c.name) + '</button>' + GOAT_BADGES.get(c.name) + '</span></p><small>' + esc(c.tag) + '</small>' + (c.tie && c.tie.length ? '<small class="kq-tie">Đồng hạng: ' + esc(c.tie.join(', ')) + '</small>' : '') +
          '<ol start="2">' + c.rest.map(function (x) { return '<li><button type="button" class="pname" data-pid="' + esc(x[2] || '') + '">' + esc(x[0]) + '</button><b>' + esc(x[1]) + '</b></li>'; }).join('') + '</ol>' +
          (c.min > 1 ? '<small class="kq-min">Tối thiểu ' + c.min + ' cặp</small>' : '') + '</div>';
      }).join('') + '</div>' + pdf(goat.href, 'Báo cáo GOAT (PDF)');
    }
    function render() { body.innerHTML = tab === 'day' ? day() : goatHtml(); $('kqEyebrow').textContent = tab === 'day' ? 'Báo cáo sau mỗi ngày thi đấu' : 'Toàn giải · ' + (goat ? 'tính đến ' + goat.asof : 'chưa có dữ liệu'); }
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return; tab = b.dataset.tab;
      tabs.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-selected', x === b); }); render();
    });
    render();
  })();

  /* ---------- docs + footer ---------- */
  var DOC = '<span class="doc-ic"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg></span>';
  $('docs').innerHTML = (S.docs.length ? S.docs : [{ label: 'Tài liệu sẽ được cập nhật', href: null }]).map(function (d) {
    var inner = DOC + '<span>' + esc(d.label) + '<small>' + (d.href ? 'PDF · mở trong tab mới' : 'Có trong bản website đầy đủ') + '</small></span>';
    return '<li>' + (d.href ? '<a class="doc glass tilt" href="' + esc(d.href) + '" target="_blank" rel="noopener">' + inner + CHEV + '</a>' : '<div class="doc glass">' + inner + '</div>') + '</li>';
  }).join('');
  $('updated').textContent = 'Cập nhật lúc ' + S.meta.updated + ' (giờ Việt Nam)';

  /* ---------- reveal: content stays visible, sections below the fold glide up as they arrive ---------- */
  if ('IntersectionObserver' in window && !reduce) {
    var rv = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.classList.remove('pre'); rv.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    document.querySelectorAll('.rv').forEach(function (el) {
      if (el.getBoundingClientRect().top > window.innerHeight) { el.classList.add('pre'); rv.observe(el); }
    });
  }
  /* ---------- flying shuttle: follows scroll on desktop; off on phones and with reduced motion ---------- */
  (function () {
    var fly = $('fly'), rkShuttle = $('rkShuttle'), racket = $('heroRacket'), spot = $('rkSpot');
    var desk = window.matchMedia('(min-width: 901px)');
    var main = fly.querySelector('.fly-shuttle'), ghosts = [].slice.call(fly.querySelectorAll('.ghost'));
    var BW = 56, BH = 73, OY = BH * .57;
    // the flight stays in the empty right margin (the robot owns the left); anchor: selector, fy, position across the margin (0 = content edge, 1 = window edge), scale, kind
    var A = [
      ['#rkSpot', .5, 0, 0, 'rest'],
      ['.hero', .3, .5, .8],
      ['.bento', .5, .38, .7],
      ['#lich', .3, .62, .8],
      ['#so-do', .3, .4, .75],
      ['#so-do', .8, .6, .75],
      ['#bxh', .4, .38, .8],
      ['#doi', .4, .62, .8],
      ['#thu-vien', .5, .45, 1, 'smash'],
      ['.foot', .15, .55, 1.1, 'land']
    ];
    var SZ = 84;  // the shuttle's footprint while it spins
    var P = [], C = [], T = [], S = [], K = [], ready = false, running = false, gut = 0;
    var cur = null, ang = -28, hist = [], lastScroll = 0, dir = 1, lastT = 0;

    function gutter() {  // width of the empty margin beside the content column
      var w = document.querySelector('main .wrap');
      return w ? w.getBoundingClientRect().left + 16 : 0;
    }
    function layout() {
      var sx = window.scrollX, sy = window.scrollY, vw = document.documentElement.clientWidth, vh = window.innerHeight;
      var maxS = Math.max(1, document.documentElement.scrollHeight - vh);
      gut = gutter();

      P = []; S = []; K = []; T = [];
      A.forEach(function (a) {
        var el = document.querySelector(a[0]); if (!el) return;
        var r = el.getBoundingClientRect(), x, y;
        if (a[4] === 'rest') { x = r.left + sx + r.width / 2; y = r.top + sy + r.height / 2; }
        else { x = vw - gut + gut * a[2]; y = r.top + sy + r.height * a[1]; }
        P.push([x, y]);
        var room = Math.min(gut * a[2], gut * (1 - a[2])) - 4;  // free space on the narrower side
        S.push(a[4] === 'rest' ? rkShuttle.getBoundingClientRect().width / BW : Math.max(.35, Math.min(a[3], 2 * room / SZ)));
        K.push(a[4] || '');
      });
      P.forEach(function (p, i) {
        var t = i === 0 ? 0 : i === P.length - 1 ? maxS : Math.min(maxS, Math.max(0, p[1] - vh * .5));
        if (i === 1) t = Math.max(t, 140);
        if (i > 0) t = Math.max(t, T[i - 1] + 80);
        T.push(t);
      });
      C = [];
      for (var i = 0; i < P.length - 1; i++) {
        var p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
        var c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
        C.push([p1, c1, c2, p2]);
      }
      ready = P.length > 2;
    }
    function bez(c, t) {
      var u = 1 - t;
      return [u*u*u*c[0][0] + 3*u*u*t*c[1][0] + 3*u*t*t*c[2][0] + t*t*t*c[3][0], u*u*u*c[0][1] + 3*u*u*t*c[1][1] + 3*u*t*t*c[2][1] + t*t*t*c[3][1]];
    }
    function tan(c, t) {
      var u = 1 - t;
      return [3*u*u*(c[1][0]-c[0][0]) + 6*u*t*(c[2][0]-c[1][0]) + 3*t*t*(c[3][0]-c[2][0]), 3*u*u*(c[1][1]-c[0][1]) + 6*u*t*(c[2][1]-c[1][1]) + 3*t*t*(c[3][1]-c[2][1])];
    }
    function target(s) {
      var i = 0;
      while (i < T.length - 2 && s >= T[i + 1]) i++;
      var raw = Math.min(1, Math.max(0, (s - T[i]) / (T[i + 1] - T[i] || 1)));
      var kind = K[i + 1], t;
      if (i === 0) t = 1 - Math.pow(1 - raw, 2);                 // serve: quick off the racket
      else if (kind === 'smash') t = raw * raw;                  // smash: accelerates into the dive
      else if (kind === 'land') t = 1 - Math.pow(1 - raw, 3);    // land: brakes into the footer
      else t = raw * raw * (3 - 2 * raw);                        // rally: ease in and out
      var p = bez(C[i], t), d = tan(C[i], t);
      if (kind === 'land' && raw > .78) p[1] -= Math.sin((raw - .78) / .22 * Math.PI) * 16 * (1 - raw) * 4;
      var a = Math.atan2(d[1], d[0]) * 180 / Math.PI - 90;
      if (i === 0 && raw < .18) a = mixAng(-28, a, raw / .18);
      if (kind === 'land' && raw > .8) a = mixAng(a, 0, (raw - .8) / .2);
      return { x: p[0], y: p[1], a: a, s: S[i] + (S[i + 1] - S[i]) * t, smash: kind === 'smash' && raw > .2, rest: s < 2 };
    }
    function mixAng(a, b, k) { var d = ((b - a + 540) % 360) - 180; return a + d * k; }

    function frame(now) {
      if (!running) return;
      requestAnimationFrame(frame);
      if (!ready) return;
      var dt = Math.min(64, now - (lastT || now)); lastT = now;
      var sy = window.scrollY;
      if (sy !== lastScroll) { dir = sy > lastScroll ? 1 : -1; lastScroll = sy; }
      var tg = target(sy);
      if (!tg.rest) {
        tg.y = Math.min(sy + window.innerHeight - 90, Math.max(sy + 120, tg.y)); // stay on screen
        if (sy > T[1] * .6) { var vw2 = document.documentElement.clientWidth, hw = SZ * tg.s / 2 + 2; tg.x = Math.max(vw2 - gut + hw, Math.min(vw2 - hw, tg.x)); } // stay inside the margin
      }
      var swing = Math.min(1, sy / (T[1] || 1));
      racket.style.setProperty('--swing', (22 - 18 * swing) + 'deg');
      if (!cur) cur = { x: tg.x, y: tg.y, s: tg.s };
      var k = 1 - Math.pow(1 - .16, dt / 16.7);
      var px = cur.x, py = cur.y;
      cur.x += (tg.x - cur.x) * k; cur.y += (tg.y - cur.y) * k; cur.s += (tg.s - cur.s) * k;
      var speed = Math.hypot(cur.x - px, cur.y - py);
      var ta = tg.a + (dir < 0 && !tg.rest ? 180 : 0);
      ang = mixAng(ang, ta, k * .9);
      var wob = Math.sin(now / 140) * 8 * Math.min(1, speed / 18);
      var atRest = tg.rest && Math.abs(cur.y - tg.y) < .5 && Math.abs(cur.x - tg.x) < .5;
      fly.hidden = atRest;
      rkShuttle.classList.toggle('away', !atRest);
      var vy = window.scrollY;
      var place = function (el, x, y, a, s, o) {
        el.style.transform = 'translate(' + (x - BW / 2).toFixed(1) + 'px,' + (y - vy - OY).toFixed(1) + 'px) rotate(' + a.toFixed(1) + 'deg) scale(' + s.toFixed(3) + ')';
        if (o !== undefined) el.style.opacity = o.toFixed(2);
      };
      place(main, cur.x, cur.y, ang + wob, cur.s);
      hist.unshift({ x: cur.x, y: cur.y, a: ang, s: cur.s });
      if (hist.length > 16) hist.length = 16;
      var f = Math.min(1, speed / 10) * (tg.smash ? 1.6 : 1);
      ghosts.forEach(function (g, n) {
        var h = hist[Math.min(hist.length - 1, (n + 1) * (tg.smash ? 3 : 2))];
        place(g, h.x, h.y, h.a, h.s * (1 - n * .06), Math.max(0, (.34 - n * .06) * f));
      });
    }
    var rt;
    function relayout() { clearTimeout(rt); rt = setTimeout(function () { sync(); if (running) layout(); }, 120); }
    function start() {
      if (running) return;
      running = true; fly.hidden = false; layout(); cur = null; lastT = 0; lastScroll = window.scrollY;
      requestAnimationFrame(frame);
    }
    function stop() {
      running = false; fly.hidden = true; rkShuttle.classList.remove('away'); racket.style.removeProperty('--swing');
    }
    function sync() { if (desk.matches && !reduce && gutter() >= 64) start(); else stop(); }  // margin too narrow: the shuttle stays on the racket
    if (desk.addEventListener) desk.addEventListener('change', sync); else desk.addListener(sync);
    window.addEventListener('resize', relayout);
    window.addEventListener('load', relayout);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(relayout);
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(document.body);
    sync();
  })();
  /* ---------- light / dark: follows the system until the viewer picks one ---------- */
  (function () {
    var root = document.documentElement, btn = $('themeBtn');
    var mq = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
    function isDark() { var t = root.getAttribute('data-theme'); return t ? t === 'dark' : !!(mq && mq.matches); }
    function paint() {
      var d = isDark();
      root.classList.toggle('is-dark', d);
      btn.setAttribute('aria-label', d ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối');
      btn.setAttribute('aria-pressed', String(d));
    }
    btn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('gcl-theme', next); } catch (e) { /* storage off: choice lasts this visit */ }
      paint();
    });
    if (mq && mq.addEventListener) mq.addEventListener('change', paint);
    if (window.MutationObserver) new MutationObserver(paint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
    paint();
  })();
  /* ---------- live clock (Vietnam time) + release check ---------- */
  (function () {
    var fmtT = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    var fmtD = new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', weekday: 'short', day: '2-digit', month: '2-digit' });
    var clock = $('clock');
    function tickClock() { var n = new Date(); clock.innerHTML = '<b>' + fmtT.format(n) + '</b> · ' + fmtD.format(n); clock.dateTime = n.toISOString(); }
    tickClock(); setInterval(tickClock, 1000);
    var b = S.meta.build || {};
    $('ver').textContent = 'Phiên bản ' + (b.version || '1.0.0') + (b.commit ? ' · ' + b.commit : '') + (b.builtAt ? ' · phát hành ' + S.meta.updated : '');
    if (!b.id || location.protocol === 'file:') return;
    var shown = false;
    function check() {
      fetch('version.json?t=' + Date.now(), { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (v) {
        if (!v || v.id === b.id || shown) return;
        shown = true;
        $('toastMsg').textContent = v.dataHash !== b.dataHash ? 'Kết quả thi đấu vừa được cập nhật. Nhấn F5 hoặc Tải lại.' : 'Giao diện vừa được cập nhật (v' + v.version + '). Nhấn F5 hoặc Tải lại.';
        $('toast').hidden = false;
      }).catch(function () { /* offline or preview: skip */ });
    }
    $('toastBtn').addEventListener('click', function () { location.reload(); });
    setInterval(check, 60000);
    document.addEventListener('visibilitychange', function () { if (!document.hidden) check(); });
  })();
})();
