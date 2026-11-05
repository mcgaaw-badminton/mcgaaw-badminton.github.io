/* ---------- streak: 3 quick taps on one player → screen dims, one big flower button for that player ----------
   every tap there counts; 10 = bouquet; 100 in one streak → the robot grows huge, gets angry, flowers lock for 10 s */
var STREAK_START = 3, STREAK_GAP = 1500, STREAK_IDLE = 3000, STREAK_MAX = 100, LOCK_S = 10;
var taps = {}, SK = null, lockUntil = 0;
function quick(id) { var t = Date.now(); taps[id] = (taps[id] || []).filter(function (x) { return t - x < STREAK_GAP; }); taps[id].push(t); return taps[id].length >= STREAK_START; }
function credit(p, n) { p.n += n; mine[p.id] = (mine[p.id] || 0) + n; mineTotal += n; $('sMine').textContent = mineTotal; }
function openStreak(p, start) {
  var ov = document.createElement('div'); ov.className = 'sk-ov'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-label', 'Chuỗi hoa cho ' + p.name);
  ov.innerHTML = '<button type="button" class="sk-x" aria-label="Thoát chuỗi">✕</button><div class="sk-who">Tặng hoa cho</div><b class="sk-name">' + p.name + '</b>' +
    '<div class="sk-say" aria-live="polite"></div><div class="sk-stage"><div class="sk-bot"><div class="sk-bot-in"></div></div><div class="sk-fw"><div class="sk-bq"></div><button type="button" class="sk-btn" aria-label="Tặng thêm 1 bông"><svg class="sk-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="54"/><circle class="on" cx="60" cy="60" r="54"/></svg><span class="sk-f"></span></button></div></div>' +
    '<div class="sk-n"><b>0</b> bông trong chuỗi</div><div class="sk-hint">Chạm liên tục vào bông hoa · dừng 3 giây để kết thúc</div><div class="sk-bqs"></div>';
  document.body.appendChild(ov);
  SK = { p: p, n: 0, ov: ov, idle: null, bqs: 0 };
  skSize(); addEventListener('resize', skSize);
  SK.bot = window.RobotHeads ? RobotHeads.mount(ov.querySelector('.sk-bot-in'), { shape: 'rectangle', size: SK.botPx, color: '#22337F', trimColor: '#D9C08A', screenColor: '#E9EDFF', seed: .42, label: 'Robot của giải' }) : null;
  if (SK.bot) SK.bot.setState('happy');
  $('mascot').style.visibility = 'hidden'; $('bubble').hidden = true;
  newFlower();
  ov.querySelector('.sk-btn').addEventListener('pointerdown', function (e) { e.preventDefault(); skTap(); });
  ov.querySelector('.sk-x').onclick = function () { closeStreak(); };
  if (window.gsap && !reduce) gsap.fromTo(ov, { opacity: 0 }, { opacity: 1, duration: .25 }), gsap.fromTo(ov.querySelector('.sk-btn'), { scale: .3 }, { scale: 1, duration: .6, ease: 'elastic.out(1,.5)' });
  mood('happy');
  for (var i = 0; i < start; i++) skTap(true);
}
/* sizes from the screen: flower and robot side by side, both shrink on short or narrow screens (landscape phones too) */
function skSize() {
  if (!SK) return; var W = innerWidth, H = innerHeight;
  var fl = Math.round(Math.max(120, Math.min(W * .48, H * .34, 260))), bot = Math.round(Math.max(90, Math.min(W * .34, H * .26, 200)));
  if (fl + bot + 40 > W - 32) { var k = (W - 72) / (fl + bot); fl = Math.round(fl * k); bot = Math.round(bot * k); }
  SK.flPx = fl; SK.botPx = bot;
  SK.ov.style.setProperty('--fl', fl + 'px'); SK.ov.style.setProperty('--bot', bot + 'px');
}
function skSay(html, m) { if (!SK) return; var b = SK.ov.querySelector('.sk-say'); b.innerHTML = html; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); if (SK.bot && m) { SK.bot.setState(m); clearTimeout(SK.mt); SK.mt = setTimeout(function () { if (SK && SK.bot && !SK.locked) SK.bot.setState('happy'); }, 1600); } }
function newFlower() { var f = SK.ov.querySelector('.sk-f'); SK.fl = FH.mount(f, { seed: Math.random(), size: 120, state: 'bloom' }); }
function skTap(silent) {
  if (!SK || SK.locked) return;
  clearTimeout(SK.idle); SK.idle = setTimeout(closeStreak, STREAK_IDLE);
  SK.n++; credit(SK.p, 1);
  var r = SK.ov.querySelector('.sk-btn').getBoundingClientRect(), cxp = r.left + r.width / 2, cyp = r.top + r.height / 2;
  sfx('pop'); petals(cxp, cyp, 12, SK.fl.colors);
  SK.ov.querySelector('.sk-n b').textContent = SK.n;
  SK.ov.querySelector('.sk-ring .on').style.strokeDashoffset = (339.3 * (1 - (SK.p.n % 10) / 10)).toFixed(1);
  if (window.gsap && !reduce) { gsap.fromTo(SK.ov.querySelector('.sk-btn'), { scale: .9 }, { scale: 1, duration: .35, ease: 'back.out(3)' }); gsap.fromTo(SK.ov.querySelector('.sk-bot-in'), { y: 0 }, { y: -10, duration: .12, yoyo: true, repeat: 1, ease: 'power1.out' }); }
  if (SK.bot && SK.n % 5 === 0) SK.bot.poke && SK.bot.poke();
  newFlower();
  if (SK.p.n % 10 === 0) {
    SK.bqs++; sfx('bq'); shower(10);
    var b = SK.ov.querySelector('.sk-bq'); b.innerHTML = FH.bouquet(Math.random(), { size: 120, wrap: TEAMC[SK.p.team] });
    if (window.gsap && !reduce) gsap.fromTo(b, { opacity: 0, y: 40, scale: .4 }, { opacity: 1, y: 0, scale: 1, duration: .55, ease: 'elastic.out(1,.55)', onComplete: function () { gsap.to(b, { opacity: 0, y: -30, duration: .4, delay: .5 }); } });
    SK.ov.querySelector('.sk-bqs').insertAdjacentHTML('beforeend', FH.posy(Math.random(), { size: 30 }));
    var h = fill(pick(L.bq.l), { name: SK.p.name, b: Math.floor(SK.p.n / 10) }); skSay(h, 'speaking'); if (!silent) talk(h);
  } else if (SK.n === 1) { skSay('Bấm tiếp đi, đủ 10 bông là thành bó!');
  } else if (SK.n === 50) { skSay('50 bông rồi! Tay ai mà nhanh vậy?', 'speaking');
  } else if (SK.n === 90) { skSay('Còn 10 bông nữa là tôi giận đó nha…', 'thinking');
  }
  if (SK.n >= STREAK_MAX) angry();
}
function closeStreak() {
  if (!SK || SK.locked) return; var s = SK; SK = null; clearTimeout(s.idle);
  removeEventListener('resize', skSize);
  var end = function () { s.ov.remove(); board(); $('mascot').style.visibility = ''; };
  if (window.gsap && !reduce) gsap.to(s.ov, { opacity: 0, duration: .3, onComplete: end }); else end();
  if (s.n >= 10) speak('streak', { name: s.p.name, a: s.n });
}
/* 100 in one streak: big angry robot (same robot-heads robot, 'error' face), red pulse, 10-second lock with a countdown */
function angry() {
  SK.locked = true; clearTimeout(SK.idle); lockUntil = Date.now() + LOCK_S * 1000;
  var ov = SK.ov, bot = ov.querySelector('.sk-bot'); ov.classList.add('locked'); sfx('angry'); if (window.speechSynthesis) speechSynthesis.cancel();
  ov.querySelector('.sk-btn').disabled = true;
  if (SK.bot) SK.bot.setState('error');
  var lt = fill(pick(L.lock.l), { name: SK.p.name }); skSay(lt); talk(lt);
  var cnt = document.createElement('div'); cnt.className = 'sk-lock'; ov.appendChild(cnt);
  if (window.gsap && !reduce) {
    var r = bot.getBoundingClientRect(), k = Math.min(1.9, (innerWidth - 32) / r.width, innerHeight * .45 / r.height);
    var dx = innerWidth / 2 - (r.left + r.width / 2);
    gsap.to(bot, { x: dx, scale: k, duration: .6, ease: 'back.out(1.7)', zIndex: 3, onComplete: function () { gsap.to(bot, { rotation: 4, duration: .07, repeat: 11, yoyo: true, ease: 'none', onComplete: function () { gsap.set(bot, { rotation: 0 }); } }); } });
    gsap.to(ov.querySelector('.sk-fw'), { opacity: .15, scale: .8, duration: .4 });
  }
  (function tick() {
    var left = Math.ceil((lockUntil - Date.now()) / 1000);
    if (left > 0) { cnt.innerHTML = 'Khóa hoa <b>' + left + '</b> giây'; setTimeout(tick, 250); return; }
    if (SK.bot) SK.bot.setState('happy');
    skSay(fill(pick(L.unlock.l), {}));
    var done = function () { SK.locked = false; closeStreak(); };
    if (window.gsap && !reduce) { gsap.to(bot, { x: 0, scale: 1, duration: .5, ease: 'power2.inOut' }); gsap.to(ov.querySelector('.sk-fw'), { opacity: 1, scale: 1, duration: .4 }); setTimeout(done, 1400); } else done();
  })();
}
