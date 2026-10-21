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
  function femTag() { return '<span class="fem">' + HEART.replace('aria-label="Nữ" role="img"', 'aria-hidden="true"') + 'Nữ</span>'; }

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
    ['home', 'lich', 'so-do', 'doi', 'the-le', 'thu-vien', 'tai-lieu'].forEach(function (id) { var el = $(id); if (el) io.observe(el); });
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
    var n = function (L, i) { return L ? esc(L[i - 1]) + (isFemale(L[i - 1]) ? HEART : '') : '—'; };
    return '<div class="pairs">' + S.pairs.map(function (p, i) {
      return '<div class="pair"><span class="no" title="Cặp ' + (i + 1) + '">' + p[0] + '–' + p[1] + '</span><span>' + n(A, p[0]) + '<br>' + n(A, p[1]) + '</span><span>' + n(B, p[0]) + '<br>' + n(B, p[1]) + '</span></div>';
    }).join('') + '</div>';
  }
  function matchCard(m, i) {
    var st = ST[status(m)];
    var mid = m.result
      ? '<div class="score"><span class="' + (m.winner === 'a' ? '' : 'lo') + '">' + esc(m.result.a) + '</span><span class="lo">:</span><span class="' + (m.winner === 'b' ? '' : 'lo') + '">' + esc(m.result.b) + '</span></div>'
      : '<span class="x">VS</span>';
    var sub = m.result ? 'Cặp thắng ' + m.result.pa + '–' + m.result.pb : esc(m.round);
    return '<article class="match glass" style="--i:' + i + '"><div class="m-top"><span class="' + tagCls(m) + '">' + esc(m.code) + ' · ' + esc(m.round) + '</span><span class="badge ' + st[1] + '">' + st[0] + '</span></div>' +
      '<div class="vs-card"><div class="vs-side"><b>' + esc(sideName(m.a)) + '</b></div><div class="vs-mid">' + mid + '<span>' + sub + '</span></div><div class="vs-side"><b>' + esc(sideName(m.b)) + '</b></div></div>' +
      pairsHtml(m) + '</article>';
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
    var team = function (k) { var s = m[k]; return '<div class="b-team' + (s.team ? '' : ' tbd') + (m.winner === k ? ' win' : '') + '"><span>' + esc(sideName(s)) + '</span><b>' + (m.result ? esc(m.result[k]) : '') + '</b></div>'; };
    var foot = [];
    if (m.winTo) foot.push('Thắng → ' + m.winTo);
    if (m.loseTo) foot.push('Thua → ' + m.loseTo);
    if (m.branch === 'lose') foot.push('Thua: dừng');
    if (m.branch === 'final') foot.push('Thắng: vô địch');
    return '<div class="b-card' + (m.branch === 'final' ? ' final' : '') + '"><div class="b-head"><span class="' + tagCls(m) + '">' + esc(m.code) + '</span><span>' + esc(m.date.slice(0, 5)) + '</span></div>' +
      team('a') + team('b') + '<div class="b-foot">' + foot.join(' · ') + '</div></div>';
  }
  $('bracket').innerHTML = '<div class="b-lane">Nhánh thắng</div>' +
    S.bracket.win.map(function (c, i) { return '<div class="b-col"><span class="b-colhead">' + COLS[i] + '</span>' + c.map(bCard).join('') + '</div>'; }).join('') +
    '<div class="b-lane lose">Nhánh thua</div>' +
    S.bracket.lose.map(function (c, i) { return '<div class="b-col"><span class="b-colhead">' + LCOLS[i] + '</span>' + c.map(bCard).join('') + '</div>'; }).join('');

  /* ---------- teams: seed tags + female label ---------- */
  $('teams').innerHTML = S.teams.map(function (t) {
    var st = teamState(t.id);
    return '<article class="team glass tilt rv"><div class="team-head"><h3>' + esc(t.name) + '</h3><span class="badge ' + st[1] + '">' + st[0] + ' · ' + rec[t.id].w + '–' + rec[t.id].l + '</span></div><ol>' +
      t.members.map(function (n, i) { return '<li>' + seedTag(i + 1) + '<span class="nm">' + esc(n) + '</span>' + (isFemale(n) ? femTag() : '<span></span>') + '</li>'; }).join('') + '</ol></article>';
  }).join('');
  $('seedLegend').innerHTML = '<span>' + seedTag(1) + 'Số trong ô là seed (seed 1 viền vàng)</span><span>' + femTag() + 'VĐV nữ</span>';
  $('pairChips').innerHTML = S.pairs.map(function (p) { return '<span>' + p[0] + '–' + p[1] + '</span>'; }).join('');

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
