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
  function sideName(s) { return s.team ? teamById[s.team].name : s.label; }
  function today() { var d = new Date(); d.setHours(0, 0, 0, 0); return d; }
  function dateOf(m) { var p = m.iso.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function status(m) { return m.result ? 'done' : dateOf(m) < today() ? 'wait' : 'up'; }
  var ST = { done: ['Đã đấu', 'done'], wait: ['Chờ kết quả', 'lose'], up: ['Sắp diễn ra', 'win'] };
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
  function marks(n) { return (isFemale(n) ? HEART : '') + (isChamp(n) ? '<span class="cup-i" title="Vô địch mùa trước">' + CUP + '</span>' : ''); }
  /* name chip: tappable in the schedule (pick + highlight), plain glass chip elsewhere (hover shows heat) */
  function pn(n, cls) { return '<button type="button" class="pn' + (cls ? ' ' + cls : '') + '" data-p="' + esc(n) + '">' + esc(n) + marks(n) + '</button>'; }
  function pnPlain(n, cls) { return '<span class="pn plain' + (cls ? ' ' + cls : '') + '" data-h="' + esc(n) + '" tabindex="0">' + esc(n) + marks(n) + '</span>'; }
  function femTag() { return '<span class="fem">' + HEART.replace('aria-label="Nữ" role="img"', 'aria-hidden="true"') + 'Nữ</span>'; }

  var FXI = window.FX_INLINE || {};
  var EGG_IMG = FXI.egg || 'assets/fx/egg.svg', SPLAT_IMG = FXI.splat || 'assets/fx/splat.svg';
  var EGG_SVG = '<img class="egg-i" src="' + EGG_IMG + '" alt="" aria-hidden="true" draggable="false">';
  var FLAME_SVG = '<span class="flame-l" aria-hidden="true"></span>';
  /* ---------- rotten eggs: shared counter per player (Google Sheet behind an Apps Script web app; local-only when not configured) ---------- */
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
    var seq = 0, applied = 0;
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
      var body = JSON.stringify(batch);
      if (beacon) { try { navigator.sendBeacon(api, new Blob([body], { type: 'text/plain' })); } catch (e) {} return; }
      inflight = batch;
      fetch(api, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain;charset=utf-8' } })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
        .then(function (d) { if (!d || d.error) throw new Error('bad'); inflight = {}; applied = ++seq; take(d); setTimeout(flush, 0); })
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
  function eggLevel(n) { return n >= 200 ? 4 : n >= 50 ? 3 : n >= 10 ? 2 : n >= 1 ? 1 : 0; }
  function eggBtn(id, name, cls) {
    var n = EGG.get(id);
    return '<button type="button" class="egg-btn' + (cls ? ' ' + cls : '') + '" data-egg="' + esc(id) + '" aria-label="Ném trứng thối vào ' + esc(name) + ' (đã có ' + n + ')">' +
      EGG_SVG + '<span class="egg-say">Ném</span><b class="egg-n" data-egg-n="' + esc(id) + '">' + n + '</b><span class="egg-fire lv' + eggLevel(n) + '" data-egg-f="' + esc(id) + '">' + FLAME_SVG + '</span></button>';
  }
  /* animated Noto fire (Lottie) in every flame that has at least one egg; players are created/destroyed as rows render */
  var FIRE = (function () {
    var data = FXI.fire || null, live = [], want = !!window.lottie && !reduce;
    if (want && !data) fetch('assets/fx/fire.json').then(function (r) { return r.json(); }).then(function (d) { data = d; sync(); }).catch(function () {});
    function sync() {
      live = live.filter(function (x) { if (document.body.contains(x.el) && !x.el.closest('.lv0')) return true; x.anim.destroy(); x.el.removeAttribute('data-on'); return false; });
      if (!want || !data) return;
      document.querySelectorAll('.egg-fire:not(.lv0) .flame-l:not([data-on])').forEach(function (el) {
        if (!el.offsetParent) return;
        el.setAttribute('data-on', '1');
        live.push({ el: el, anim: lottie.loadAnimation({ container: el, renderer: 'svg', loop: true, autoplay: true, animationData: data, rendererSettings: { preserveAspectRatio: 'xMidYMid meet' } }) });
      });
    }
    return { sync: sync };
  })();
  function refreshEggs() {
    document.querySelectorAll('[data-egg-n]').forEach(function (el) { var n = EGG.get(el.dataset.eggN); if (el.textContent !== String(n)) el.textContent = n; });
    document.querySelectorAll('[data-egg-f]').forEach(function (el) { el.className = 'egg-fire lv' + eggLevel(EGG.get(el.dataset.eggF)); });
    FIRE.sync();
  }
  EGG.on(refreshEggs);
  if (window.MutationObserver) { var fireMo; new MutationObserver(function () { clearTimeout(fireMo); fireMo = setTimeout(FIRE.sync, 60); }).observe(document.body, { childList: true, subtree: true }); }

  /* throw: GSAP flies a Noto egg in an arc from the mascot, the fried-egg splat squashes onto the button,
     canvas-confetti scatters shell + yolk, and the Lottie flame flares and spits embers (more at higher levels) */
  var G = window.gsap, boom = window.confetti && !reduce ? confetti.create(null, { resize: true, useWorker: true, disableForReducedMotion: true }) : null;
  var flying = 0;
  function burst(x, y, lvl) {
    if (!boom) return;
    var o = { x: x / innerWidth, y: y / innerHeight };
    boom({ origin: o, particleCount: 10, spread: 80, startVelocity: 16, gravity: 1.3, ticks: 55, scalar: .55, shapes: ['square'], colors: ['#FFFFFF', '#F3EBD3', '#E3D6B0'], disableForReducedMotion: true });
    boom({ origin: o, particleCount: 8, spread: 60, startVelocity: 12, gravity: 1.5, ticks: 60, scalar: .7, shapes: ['circle'], colors: ['#FFC21A', '#FFA800', '#FFD54A'], disableForReducedMotion: true });
    if (lvl) boom({ origin: { x: o.x + 18 / innerWidth, y: o.y }, particleCount: 4 + lvl * 5, angle: 90, spread: 40 + lvl * 8, startVelocity: 6 + lvl * 2, gravity: -.35, decay: .9, drift: 0, ticks: 40 + lvl * 8, scalar: .45, shapes: ['circle'], colors: ['#FF5A00', '#FF8A00', '#FFC400', '#FF2D00'], disableForReducedMotion: true });
  }
  function throwFx(btn) {
    var icon = btn.querySelector('.egg-i') || btn, r = icon.getBoundingClientRect(), tx = r.left + r.width / 2, ty = r.top + r.height / 2;
    var lvl = eggLevel(EGG.get(btn.dataset.egg));
    var land = function () {
      var fl = btn.querySelector('.egg-fire');
      if (G) {
        G.fromTo(btn, { scale: .86 }, { scale: 1, duration: .5, ease: 'elastic.out(1.1,.45)', clearProps: 'transform' });
        if (fl) G.fromTo(fl, { scale: 1.8, y: -4 }, { scale: 1, y: 0, duration: .6, ease: 'elastic.out(1,.4)', clearProps: 'transform' });
        var sp = document.createElement('img'); sp.src = SPLAT_IMG; sp.className = 'egg-splat'; sp.alt = ''; document.body.appendChild(sp);
        G.set(sp, { x: tx - 20, y: ty - 20, rotation: Math.random() * 360 });
        G.timeline({ onComplete: function () { sp.remove(); } })
          .fromTo(sp, { scaleX: .2, scaleY: .2, opacity: 1 }, { scaleX: 1.25, scaleY: .9, duration: .12, ease: 'power3.out' })
          .to(sp, { scaleX: 1, scaleY: 1, duration: .35, ease: 'elastic.out(1,.5)' })
          .to(sp, { y: '+=14', opacity: 0, duration: .5, ease: 'power1.in' }, '+=.15');
        var plus = document.createElement('span'); plus.className = 'egg-plus'; plus.textContent = '+1'; document.body.appendChild(plus);
        G.fromTo(plus, { x: tx + 10, y: ty - 10, opacity: 1, scale: .6 }, { y: ty - 54, scale: 1.1, opacity: 0, duration: .9, ease: 'power2.out', onComplete: function () { plus.remove(); } });
      }
      burst(tx, ty, lvl);
    };
    var ms = document.querySelector('.mascot:not(.away)'), mb = ms && ms.offsetParent !== null && ms.querySelector('.ms-body');
    if (mb && window.mascotMood) mascotMood('happy', 1400);
    if (!G || reduce || flying > 12) return land();
    var mr = mb && mb.getBoundingClientRect();
    var sx = mr ? mr.left + mr.width / 2 : tx + (Math.random() * 160 - 80), sy = mr ? mr.top + 16 : innerHeight + 30;
    var egg = document.createElement('img'); egg.src = EGG_IMG; egg.className = 'egg-fly'; egg.alt = ''; document.body.appendChild(egg);
    var peak = Math.min(sy, ty) - 70 - Math.random() * 70, dur = .5 + Math.min(.35, Math.hypot(tx - sx, ty - sy) / 2000);
    flying++;
    G.set(egg, { x: sx - 13, y: sy - 13, rotation: -30, scale: .7 });
    G.timeline({ onComplete: function () { egg.remove(); flying--; land(); } })
      .to(egg, { x: tx - 13, duration: dur, ease: 'none' }, 0)
      .to(egg, { y: peak - 13, duration: dur * .45, ease: 'power2.out' }, 0)
      .to(egg, { y: ty - 13, duration: dur * .55, ease: 'power2.in' }, dur * .45)
      .to(egg, { rotation: 420 + Math.random() * 180, scale: 1.05, duration: dur, ease: 'none' }, 0)
      .to(egg, { scaleX: 1.35, scaleY: .6, duration: .06 }, dur - .06);
  }
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.egg-btn'); if (!b) return;
    e.stopPropagation();
    if (!EGG.hit(b.dataset.egg)) { b.classList.add('empty'); setTimeout(function () { b.classList.remove('empty'); }, 600); if (window.mascotSay) mascotSay('Hôm nay anh đã hết ' + EGG.limit + ' quả trứng rồi, mai ném tiếp nhé!'); return; }
    throwFx(b);
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
    ['home', 'lich', 'so-do', 'bxh', 'doi', 'the-le', 'thu-vien', 'tai-lieu'].forEach(function (id) { var el = $(id); if (el) io.observe(el); });
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
    return '<article class="slide' + (i ? '' : ' on') + '" role="group" aria-roledescription="slide" aria-label="' + (i + 1) + ' / ' + slides.length + '">' + bg +
      '<div class="slide-in">' + (s.eyebrow ? '<p class="chip-gold glass-dark">' + esc(s.eyebrow) + '</p>' : '') +
      (s.title ? '<' + h + '>' + esc(s.title) + '</' + h + '>' : '') + (s.sub ? '<p class="sub">' + esc(s.sub) + '</p>' : '') +
      (s.cta ? '<a class="cta" href="' + esc(s.cta.href) + '">' + esc(s.cta.label) + ARROW + '</a>' : '') + '</div></article>';
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
  function pairsHtml(m) {
    var A = m.a.team ? teamById[m.a.team].members : null, B = m.b.team ? teamById[m.b.team].members : null;
    if (!A && !B) return '<div class="pairs tbd">Tên VĐV hiện khi đã có kết quả ' + esc([m.a.label, m.b.label].join(', ').replace(/Thắng |Thua /g, '')) + '</div>';
    var side = function (L, p, r) { return '<span class="pside' + (r ? ' r' : '') + '">' + (L ? pn(L[p[0] - 1]) + pn(L[p[1] - 1]) : '<span class="pn tbd">Chưa xác định</span>') + '</span>'; };
    return '<div class="pairs">' + S.pairs.map(function (p, i) {
      return '<div class="pair"><span class="no" title="Cặp ' + (i + 1) + '">' + p[0] + '–' + p[1] + '</span>' + side(A, p) + side(B, p, true) + '</div>';
    }).join('') + '</div>';
  }
  function matchCard(m, i) {
    var st = ST[status(m)];
    var mid = m.result
      ? '<div class="score"><span class="' + (m.winner === 'a' ? '' : 'lo') + '">' + esc(m.result.a) + '</span><span class="lo">:</span><span class="' + (m.winner === 'b' ? '' : 'lo') + '">' + esc(m.result.b) + '</span></div>'
      : '<span class="x">VS</span>';
    var sub = m.result ? 'Cặp thắng ' + m.result.pa + '–' + m.result.pb : esc(m.round);
    var sides = '<span class="vs-side"><b>' + esc(sideName(m.a)) + '</b></span><span class="vs-mid">' + mid + '<span>' + sub + '</span></span><span class="vs-side r"><b>' + esc(sideName(m.b)) + '</b></span>';
    var top = '<div class="m-top"><span class="' + tagCls(m) + '">' + esc(m.code) + ' · ' + esc(m.round) + '</span><span class="badge ' + st[1] + '">' + st[0] + '</span></div>';
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
    moveThumb();
    var b = segBtns[i], sc = seg.parentNode;
    if (b.offsetLeft < sc.scrollLeft || b.offsetLeft + b.offsetWidth > sc.scrollLeft + sc.clientWidth) sc.scrollTo({ left: b.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
  }
  pickDay(nextDayIdx);
  $('busyNote').textContent = S.rules.busy_note;

  /* ---------- bracket ---------- */
  var COLS = ['Vòng 1', 'Bán kết', 'CK nhánh thắng', 'Chung kết tổng'], LCOLS = ['Thua vòng 1', 'Thua vòng 2', 'Thua vòng 3', 'CK nhánh thua'];
  function bCard(code) {
    var m = byCode[code]; if (!m) return '';
    var team = function (k) { var s = m[k]; return '<span class="b-team' + (s.team ? '' : ' tbd') + (m.winner === k ? ' win' : '') + '"><span>' + esc(sideName(s)) + '</span><b>' + (m.result ? esc(m.result[k]) : '') + '</b></span>'; };
    var foot = [];
    if (m.winTo) foot.push('Thắng → ' + m.winTo);
    if (m.loseTo) foot.push('Thua → ' + m.loseTo);
    if (m.branch === 'lose') foot.push('Thua: dừng');
    if (m.branch === 'final') foot.push('Thắng: vô địch');
    var head = '<span class="b-head"><span class="' + tagCls(m) + '">' + esc(m.code) + '</span><span>' + esc(m.date.slice(0, 5)) + '</span></span>';
    var cls = 'b-card' + (m.branch === 'final' ? ' final' : '');
    if (!(m.a.team || m.b.team)) return '<div class="' + cls + '">' + head + team('a') + team('b') + '<div class="b-foot">' + foot.join(' · ') + '</div></div>';
    var roster = function (k) {
      var s = m[k]; if (!s.team) return '<div class="b-roster tbd"><b>' + esc(sideName(s)) + '</b><span>Chưa xác định</span></div>';
      return '<div class="b-roster"><b>' + esc(sideName(s)) + '</b><ol>' + teamById[s.team].members.map(function (n, i) { return '<li>' + seedTag(i + 1) + pnPlain(n) + '</li>'; }).join('') + '</ol></div>';
    };
    return '<div class="' + cls + '"><button type="button" class="b-toggle" aria-expanded="false" aria-controls="bk-' + m.code + '" aria-label="' + esc(m.code) + ': xem thành viên">' + head + team('a') + team('b') +
      '<span class="b-foot"><span>' + foot.join(' · ') + '</span>' + CHIP + '</span></button>' + box('bk-' + m.code, roster('a') + roster('b')) + '</div>';
  }
  var phone = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  function lane(key, title, cols, heads, open) {
    var n = cols.reduce(function (t, c) { return t + c.length; }, 0);
    return '<div class="b-sec ' + key + '"><button type="button" class="lane-toggle" aria-expanded="' + open + '" aria-controls="lane-' + key + '">' +
      '<span class="lt">' + title + '<small>' + n + ' trận</small></span>' + CHIP + '</button>' +
      box('lane-' + key, '<div class="b-grid">' + cols.map(function (c, i) { return '<div class="b-col"><span class="b-colhead">' + heads[i] + '</span>' + c.map(bCard).join('') + '</div>'; }).join('') + '</div>', open) + '</div>';
  }
  $('bracket').innerHTML = lane('win', 'Nhánh thắng', S.bracket.win, COLS, true) + lane('lose', 'Nhánh thua', S.bracket.lose, LCOLS, !phone);

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
    $('pFocusName').innerHTML = esc(selP) + (isChamp(selP) ? ' ' + champTag() : '');
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
    } else $('pFocusHeat').hidden = true;
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


  /* ---------- standings & stats (BXH): team table, matches, players; recalculated by the build after every result ---------- */
  (function () {
    var ST = S.stats || { teams: [], players: [], highlights: {}, played: 0 };
    var bar = $('bxhBar'), body = $('bxhBody'), note = $('bxhNote');
    var state = { tab: 'player', teamFilter: 'all', matchFilter: 'all', matchTeam: '', metric: 'eggs', pTeam: '', pSeed: '', pFem: false, showAll: false };
    var STATUS = { champ: ['Vô địch', 'champ'], runner: ['Á quân', 'win'], win: ['Nhánh thắng', 'win'], lose: ['Nhánh thua', 'lose'], out: ['Đã dừng', 'out'] };
    var METRICS = [
      ['heat', 'Nhiệt độ', function (p) { return p.heat; }, function (p) { return p.heat.toFixed(1) + '°'; }],
      ['eggs', 'Trứng thối', function (p) { return EGG.get(p.id); }, function (p) { return EGG.get(p.id); }],
      ['won', 'Cặp thắng', function (p) { return p.won; }, function (p) { return p.won; }],
      ['pf', 'Điểm ghi', function (p) { return p.pf; }, function (p) { return p.pf; }],
      ['diff', 'Hiệu số', function (p) { return p.diff; }, function (p) { return (p.diff > 0 ? '+' : '') + p.diff; }],
      ['rate', 'Tỉ lệ thắng', function (p) { return p.rate == null ? -1 : p.rate; }, function (p) { return p.rate == null ? '–' : p.rate + '%'; }]
    ];
    function sign(n) { return (n > 0 ? '+' : '') + n; }
    function dcls(n) { return n > 0 ? 'pos-n' : n < 0 ? 'neg-n' : ''; }
    function initials(name) { var w = name.trim().split(/\s+/); return (w.length > 2 ? w[w.length - 2][0] : '') + w[w.length - 1][0]; }
    function chips(name, items, cur) {
      return '<div class="chipset" role="group" aria-label="' + name + '">' + items.map(function (it) {
        return '<button type="button" class="chip" data-v="' + it[0] + '" aria-pressed="' + (it[0] === cur) + '">' + esc(it[1]) + '</button>';
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
      body.innerHTML = '<div class="tbl-scroll"><table class="tbl"><caption class="sr">Bảng xếp hạng đội</caption><thead><tr><th class="l">#</th><th class="l">Đội</th><th>Trận</th><th>Thắng</th><th>Thua</th><th class="opt">Cặp</th><th class="opt">Điểm</th><th>Hiệu số</th><th class="opt">Phong độ</th><th>Trạng thái</th></tr></thead><tbody>' +
        rows.map(function (r) {
          var st = STATUS[r.status], hd = r.pf - r.pa;
          var form = r.form.length ? r.form.map(function (f) { return '<i class="' + (f.win ? 'fw' : 'fl') + '" title="' + f.code + '">' + (f.win ? 'T' : 'B') + '</i>'; }).join('') : '<span class="none">–</span>';
          return '<tr class="' + (r.pos === 1 && ST.played ? 'top' : '') + '"><td class="pos">' + r.pos + '</td><td class="l tm">' + esc(teamById[r.team].name) + '</td><td>' + r.played + '</td><td class="strong">' + r.w + '</td><td>' + r.l + '</td>' +
            '<td class="opt">' + r.pw + '–' + r.pl + '</td><td class="opt">' + r.pf + '–' + r.pa + '</td><td class="strong ' + dcls(hd) + '">' + sign(hd) + '</td><td class="opt"><span class="form">' + form + '</span></td><td><span class="badge ' + st[1] + '">' + st[0] + '</span></td></tr>';
        }).join('') + '</tbody></table></div>';
      note.textContent = 'Xếp theo: vô địch / á quân, rồi số trận thắng, ít trận thua, hiệu số cặp, hiệu số điểm. Đội bị loại xếp theo vòng bị loại.';
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
        var meta = r ? 'Cách biệt ' + Math.abs(r.a - r.b) + (r.pairs ? '' : ' · chưa có điểm từng cặp') : esc(m.round);
        return '<div class="mrow"><div class="when"><span class="' + tagCls(m) + '">' + m.code + '</span><span>' + m.date.slice(0, 5) + '</span></div>' +
          '<div class="vs"><span class="' + cls('a') + '">' + esc(sideName(m.a)) + '</span><span class="sc">' + sc + '</span><span class="' + cls('b') + '">' + esc(sideName(m.b)) + '</span></div><div class="meta">' + meta + '</div></div>';
      }).join('') : '<p class="board-empty">Không có trận nào khớp bộ lọc.</p>');
      note.textContent = ST.played ? 'Đã đấu ' + ST.played + '/' + S.matches.length + ' trận.' : 'Chưa có trận nào kết thúc. Kết quả và các chỉ số sẽ hiện sau trận đầu tiên (04/11).';
    }

    function renderPlayer() {
      var seedOpts = '<option value="">Mọi seed</option>' + [1, 2, 3, 4, 5].map(function (s) { return '<option value="' + s + '"' + (String(s) === state.pSeed ? ' selected' : '') + '>Seed ' + s + '</option>'; }).join('');
      bar.innerHTML = chips('Chỉ số', METRICS.map(function (m) { return [m[0], m[1]]; }), state.metric) +
        '<div class="filters-r"><label class="sr" for="bxhPTeam">Lọc theo đội</label><select class="sel" id="bxhPTeam">' + teamOpts(state.pTeam) + '</select>' +
        '<label class="sr" for="bxhPSeed">Lọc theo seed</label><select class="sel" id="bxhPSeed">' + seedOpts + '</select>' +
        '<label class="tgl"><input type="checkbox" id="bxhPFem"' + (state.pFem ? ' checked' : '') + '>Chỉ VĐV nữ</label></div>';
      var M = METRICS.filter(function (m) { return m[0] === state.metric; })[0];
      var list = ST.players.filter(function (p) {
        return (!state.pTeam || p.team === state.pTeam) && (!state.pSeed || String(p.seed) === state.pSeed) && (!state.pFem || p.female);
      }).sort(function (x, y) { return M[2](y) - M[2](x) || y.heat - x.heat || x.seed - y.seed; });
      if (!list.length) { body.innerHTML = '<p class="board-empty">Không có VĐV nào khớp bộ lọc.</p>'; return; }
      var shown = state.showAll ? list : list.slice(0, 10);
      body.innerHTML = '<ol class="plist' + (state.metric === 'eggs' ? ' eggs-mode' : '') + '">' + shown.map(function (p, i) {
        var main = M[3](p), sub = '';
        if (state.metric === 'eggs') {
          main = '<span class="egg-main"><span data-egg-n="' + esc(p.id) + '">' + EGG.get(p.id) + '</span><span class="egg-fire lv' + eggLevel(EGG.get(p.id)) + '" data-egg-f="' + esc(p.id) + '">' + FLAME_SVG + '</span></span>';
          sub = '<small>' + p.heat.toFixed(1) + '° nhiệt độ</small>';
        } else if (state.metric === 'heat') {
          var w = Math.max(4, Math.min(100, (p.heat - 20) / 25 * 100));
          sub = '<span class="thermo" aria-hidden="true"><i style="width:' + w.toFixed(0) + '%"></i></span>' +
            (p.played ? '<small class="trend ' + (p.trend > 0 ? 'up' : p.trend < 0 ? 'down' : '') + '">' + (p.trend > 0 ? '▲ +' + p.trend : p.trend < 0 ? '▼ ' + p.trend : 'giữ nguyên') + '</small>' : '<small>theo seed</small>');
        } else {
          sub = '<small>' + p.played + ' cặp · ' + p.won + 'T ' + p.lost + 'B</small>';
        }
        return '<li class="prow' + (i === 0 ? ' top' : '') + '"><span class="rk">' + (i + 1) + '</span><span class="av" aria-hidden="true">' + esc(initials(p.name)) + '</span>' +
          '<span class="who"><b>' + esc(p.name) + '</b><small>' + esc(teamById[p.team].name) + seedTag(p.seed) + (p.female ? femTag() : '') + (isChamp(p.name) ? champTag() : '') + '</small></span>' +
          '<span class="val"><b>' + main + '</b>' + sub + '</span>' + eggBtn(p.id, p.name) + '</li>';
      }).join('') + '</ol>' + (list.length > 10 ? '<button type="button" class="more" id="bxhMore">' + (state.showAll ? 'Thu gọn' : 'Xem tất cả ' + list.length + ' VĐV') + '</button>' : '');
      note.textContent = state.metric === 'eggs'
        ? 'Bấm nút quả trứng ở mỗi dòng để ném trứng thối, bấm liên tục để ném nhiều quả. Trứng càng nhiều lửa càng cháy to. ' + (EGG.state() === 'local' ? 'Hiện đang đếm trên máy của bạn, chưa nối bảng chung.' : 'Đếm chung cho mọi người, cập nhật trực tiếp.')
        : state.metric === 'heat'
        ? 'Nhiệt độ 20°–45°: lúc đầu tính theo seed; sau mỗi trận, tỉ lệ thắng cặp và hiệu số điểm của chính VĐV dần thay thế điểm khởi đầu. Mũi tên so với trước trận gần nhất.'
        : 'Chỉ số tính từ điểm từng cặp đã nhập. ' + (ST.played ? '' : 'Chưa có trận nào, tạm xếp theo seed.');
    }

    function render() {
      ({ team: renderTeam, match: renderMatch, player: renderPlayer })[state.tab]();
    }
    var tabs = $('bxhTabs').querySelectorAll('button');
    $('bxhTabs').addEventListener('click', function (e) {
      var b = e.target.closest('button'); if (!b) return;
      state.tab = b.dataset.tab; state.showAll = false;
      tabs.forEach(function (x) { x.setAttribute('aria-selected', x === b); });
      render();
    });
    bar.addEventListener('click', function (e) {
      var c = e.target.closest('.chip'); if (!c) return;
      if (state.tab === 'team') state.teamFilter = c.dataset.v;
      else if (state.tab === 'match') state.matchFilter = c.dataset.v;
      else { state.metric = c.dataset.v; state.showAll = false; }
      render();
    });
    bar.addEventListener('change', function (e) {
      var t = e.target;
      if (t.id === 'bxhMatchTeam') state.matchTeam = t.value;
      if (t.id === 'bxhPTeam') state.pTeam = t.value;
      if (t.id === 'bxhPSeed') state.pSeed = t.value;
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
    var phone = window.matchMedia && matchMedia('(max-width: 900px)').matches;
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
    msgs.push(['Thấy ai đánh hay quá? Vào BXH ném trứng thối cho lửa cháy to lên!', 'Ném trứng', '#bxh', 'eggs']);
    msgs.push(['Chạm vào tên VĐV trong lịch để xem cặp đấu và nhiệt độ của người đó.', 'Mở lịch', '#lich']);
    var i = 0, cycle;
    function show(k) {
      var m = msgs[k % msgs.length]; text.textContent = m[0];
      act.textContent = m[1]; act.setAttribute('href', m[2]); act.dataset.eggs = m[3] || '';
      bubble.hidden = false; bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      mood('speaking', Math.min(4200, 900 + m[0].length * 45));
    }
    window.mascotSay = function (t) { if (root.classList.contains('away')) return; text.textContent = t; act.hidden = true; bubble.hidden = false; mood('speaking', 2500); clearTimeout(cycle); cycle = setTimeout(function () { act.hidden = false; bubble.hidden = true; }, 4000); };
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
    act.addEventListener('click', function () {
      bubble.hidden = true;
      if (act.dataset.eggs) { var t = document.querySelector('#bxhTabs [data-tab="player"]'); if (t) t.click(); var c = document.querySelector('#bxhBar .chip[data-v="eggs"]'); if (c) c.click(); }
    });
    /* react to the page: thinking while the egg board loads, error if it is offline, happy on every throw */
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
    // anchor: selector, fx, fy, dx, dy, scale, kind
    var A = [
      ['#rkSpot', .5, .5, 0, 0, 0, 'rest'],
      ['.hero', .5, .07, 0, 0, .8],
      ['.bento', 0, .55, -44, 0, .7],
      ['#lich .sec-head', .55, .6, 0, 0, .85],
      ['#so-do .bracket-scroll', .02, .22, 0, 0, .75],
      ['#so-do .bracket-scroll', .98, .72, 0, 0, .75],
      ['#doi .teams', .82, .06, 0, -34, .8],
      ['#thu-vien', .02, .55, 0, 0, 1, 'smash'],
      ['.foot-in', .9, 0, 0, -42, 1.1, 'land']
    ];
    var P = [], C = [], T = [], S = [], K = [], ready = false, running = false;
    var cur = null, ang = -28, hist = [], lastScroll = 0, dir = 1, lastT = 0;

    function layout() {
      var sx = window.scrollX, sy = window.scrollY, vw = window.innerWidth, vh = window.innerHeight;
      var maxS = Math.max(1, document.documentElement.scrollHeight - vh);
      P = []; S = []; K = []; T = [];
      A.forEach(function (a) {
        var el = document.querySelector(a[0]); if (!el) return;
        var r = el.getBoundingClientRect();
        var x = r.left + sx + r.width * a[1] + a[3], y = r.top + sy + r.height * a[2] + a[4];
        P.push([Math.min(vw - 34, Math.max(34, x)), y]);
        S.push(a[5] || (rkShuttle.getBoundingClientRect().width / BW));
        K.push(a[6] || '');
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
        C.push([p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2]);
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
      if (!tg.rest) tg.y = Math.min(sy + window.innerHeight - 90, Math.max(sy + 120, tg.y)); // never leave the screen
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
    function relayout() { clearTimeout(rt); rt = setTimeout(function () { layout(); }, 120); }
    function start() {
      if (running) return;
      running = true; fly.hidden = false; layout(); cur = null; lastT = 0; lastScroll = window.scrollY;
      requestAnimationFrame(frame);
    }
    function stop() {
      running = false; fly.hidden = true; rkShuttle.classList.remove('away'); racket.style.removeProperty('--swing');
    }
    function sync() { if (desk.matches && !reduce) start(); else stop(); }
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
