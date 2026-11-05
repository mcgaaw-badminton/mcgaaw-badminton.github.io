/* FlowerHeads: seeded procedural flowers (same idea as robot-heads: one seed → one unique character).
   FlowerHeads.svg(seed, opts) → SVG string; FlowerHeads.mount(el, opts) → { setState, el, colors }.
   States: 'bud' (closed), 'bloom' (opens with a stagger), 'idle' (gentle sway), 'happy' (spin + bounce). */
(function (g) {
  function rng(seed) { var t = (seed * 4294967296) >>> 0 || 1; return function () { t += 0x6D2B79F5; var r = Math.imul(t ^ t >>> 15, 1 | t); r ^= r + Math.imul(r ^ r >>> 7, 61 | r); return ((r ^ r >>> 14) >>> 0) / 4294967296; }; }
  // [outer petal, inner petal, center, center dots]
  var PAL = [
    ['#E0245E', '#FF8FB1', '#7A1235', '#FFD166'], ['#FF5C8A', '#FFD1DE', '#C2185B', '#FFE08A'], ['#FFB7CE', '#FFF0F5', '#E5739B', '#FFF3B0'],
    ['#F94144', '#FF9B85', '#6D1A1A', '#FFC857'], ['#FF8C42', '#FFD3A5', '#8A3B12', '#FFF1C1'], ['#FFC531', '#FFF0A8', '#6B3E12', '#3B2410'],
    ['#FFFFFF', '#FDE7F0', '#F5B700', '#FFE680', '#D98BA8'], ['#9B7BE0', '#E2D6FF', '#4B2E83', '#FFD166'], ['#5B8DEF', '#CFE0FF', '#1E3A8A', '#FFE082'],
    ['#F78FB3', '#FDE2EC', '#FFB300', '#FFF59D'], ['#C1121F', '#F25C54', '#3D0A0A', '#F4D35E'], ['#FFA8A8', '#FFE3E3', '#D6336C', '#FFF3BF']
  ];
  var KINDS = ['round', 'pointed', 'heart', 'daisy', 'layered', 'cosmos'];
  function petalPath(kind, L, W) {
    var f = function (n) { return n.toFixed(1); };
    if (kind === 'pointed') return 'M0 0C' + f(W) + ' ' + f(-L * .4) + ' ' + f(W * .5) + ' ' + f(-L * .82) + ' 0 ' + f(-L) + 'C' + f(-W * .5) + ' ' + f(-L * .82) + ' ' + f(-W) + ' ' + f(-L * .4) + ' 0 0Z';
    if (kind === 'heart') return 'M0 0C' + f(W) + ' ' + f(-L * .3) + ' ' + f(W * 1.1) + ' ' + f(-L) + ' ' + f(W * .38) + ' ' + f(-L) + 'C' + f(W * .14) + ' ' + f(-L) + ' 0 ' + f(-L * .9) + ' 0 ' + f(-L * .84) +
      'C0 ' + f(-L * .9) + ' ' + f(-W * .14) + ' ' + f(-L) + ' ' + f(-W * .38) + ' ' + f(-L) + 'C' + f(-W * 1.1) + ' ' + f(-L) + ' ' + f(-W) + ' ' + f(-L * .3) + ' 0 0Z';
    if (kind === 'cosmos') return 'M0 0C' + f(W) + ' ' + f(-L * .35) + ' ' + f(W * 1.05) + ' ' + f(-L * .9) + ' ' + f(W * .6) + ' ' + f(-L) + 'L' + f(W * .3) + ' ' + f(-L * .92) + 'L0 ' + f(-L) + 'L' + f(-W * .3) + ' ' + f(-L * .92) + 'L' + f(-W * .6) + ' ' + f(-L) +
      'C' + f(-W * 1.05) + ' ' + f(-L * .9) + ' ' + f(-W) + ' ' + f(-L * .35) + ' 0 0Z';
    return 'M0 0C' + f(W) + ' ' + f(-L * .3) + ' ' + f(W) + ' ' + f(-L) + ' 0 ' + f(-L) + 'C' + f(-W) + ' ' + f(-L) + ' ' + f(-W) + ' ' + f(-L * .3) + ' 0 0Z';
  }
  var uid = 0;
  /* the flower head centred on (0,0), radius ~ 46 (fits a 100×100 box) */
  function head(seed, o) {
    o = o || {}; var r = rng(seed), id = 'fh' + (++uid) + '_';
    var p = o.palette || PAL[Math.floor(r() * PAL.length)], kind = o.kind || KINDS[Math.floor(r() * KINDS.length)];
    var rings = kind === 'layered' ? 3 : kind === 'daisy' ? 1 : (r() < .45 ? 2 : 1);
    var n = kind === 'daisy' ? 12 + Math.floor(r() * 6) : kind === 'cosmos' ? 8 : kind === 'heart' ? 5 : kind === 'layered' ? 6 + Math.floor(r() * 2) : 5 + Math.floor(r() * 3);
    var L = kind === 'daisy' ? 44 : 42, W = kind === 'daisy' ? 6.5 : kind === 'pointed' ? 15 : kind === 'cosmos' ? 16 : 19;
    var pk = kind === 'layered' ? 'round' : kind === 'daisy' ? 'round' : kind;
    var rot0 = r() * 360, out = '';
    out += '<defs><radialGradient id="' + id + 'g" cx="0" cy="0" r="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="' + p[1] + '"/><stop offset=".85" stop-color="' + p[0] + '"/></radialGradient>' +
      '<radialGradient id="' + id + 'h" cx="0" cy="0" r="46" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="' + p[1] + '"/><stop offset="1" stop-color="' + p[0] + '" stop-opacity=".9"/></radialGradient></defs>';
    for (var k = 0; k < rings; k++) {
      var s = 1 - k * .26, off = k * (180 / n), pathD = petalPath(pk, L * s, W * s * (kind === 'layered' ? 1 + k * .1 : 1));
      out += '<g class="fh-ring" style="--d:' + (k * .12) + 's">';
      for (var i = 0; i < n; i++) {
        var a = rot0 + off + i * 360 / n + (r() * 6 - 3);
        out += '<path class="fh-p" d="' + pathD + '" transform="rotate(' + a.toFixed(1) + ')" fill="url(#' + id + (k ? 'h' : 'g') + ')" stroke="' + (p[4] || p[0]) + '" stroke-opacity="' + (p[4] ? '.8' : '.35') + '" stroke-width=".8"/>';
      }
      out += '</g>';
    }
    var cr = kind === 'daisy' ? 12 : kind === 'layered' ? 9 : 10;
    out += '<g class="fh-c"><circle r="' + cr + '" fill="' + p[2] + '"/>';
    var dots = 7 + Math.floor(r() * 6);
    for (var j = 0; j < dots; j++) { var da = j * 137.5 * Math.PI / 180, dr = Math.sqrt((j + .5) / dots) * cr * .78; out += '<circle cx="' + (Math.cos(da) * dr).toFixed(1) + '" cy="' + (Math.sin(da) * dr).toFixed(1) + '" r="' + (1.1 + r() * .7).toFixed(1) + '" fill="' + p[3] + '"/>'; }
    out += '<circle r="' + cr + '" fill="none" stroke="#000" stroke-opacity=".12"/></g>';
    return { svg: out, colors: [p[0], p[1], p[3]], kind: kind };
  }
  function svg(seed, o) {
    o = o || {}; var h = head(seed, o), sz = o.size || 64;
    return '<svg class="fh" viewBox="-50 -50 100 100" width="' + sz + '" height="' + sz + '" role="img" aria-label="Hoa">' + h.svg + '</svg>';
  }
  /* a bouquet: 5–7 heads on stems, fanned into a paper wrap in the team colours */
  function bouquet(seed, o) {
    o = o || {}; var r = rng(seed), c = o.wrap || ['#2F45F0', '#C9D1FF'], n = 5 + Math.floor(r() * 3), heads = '', stems = '', leaves = '';
    var spots = [];
    for (var i = 0; i < n; i++) {
      var t = i / (n - 1), back = i % 2 === 0, ang = (-34 + t * 68 + (r() * 8 - 4)) * Math.PI / 180, rad = back ? 62 : 46;
      spots.push({ x: 100 + Math.sin(ang) * rad, y: 92 - Math.cos(ang) * rad * .82 + (back ? 0 : 14), s: (back ? .36 : .42) + r() * .08, z: back ? 0 : 1, seed: r() });
    }
    spots.sort(function (a, b) { return a.z - b.z; });
    spots.forEach(function (p) {
      stems += '<path d="M100 170 Q' + ((p.x + 100) / 2).toFixed(1) + ' ' + ((p.y + 170) / 2 + 6).toFixed(1) + ' ' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + '" stroke="#3E8E4E" stroke-width="3" fill="none"/>';
      heads += '<g class="fh-b" transform="translate(' + p.x.toFixed(1) + ' ' + p.y.toFixed(1) + ') scale(' + p.s.toFixed(2) + ')"><g class="fh-sway" style="--sd:' + (r() * 2).toFixed(2) + 's">' + head(p.seed).svg + '</g></g>';
    });
    for (var l = 0; l < 3; l++) { var la = -50 + l * 50 + (r() * 10 - 5); leaves += '<path d="M100 140 q-8 -28 0 -50 q8 22 0 50Z" fill="#4FA25E" transform="rotate(' + la.toFixed(0) + ' 100 140)"/>'; }
    var wrap = '<path d="M46 118 Q100 136 154 118 L110 214 Q100 220 90 214 Z" fill="' + c[1] + '"/>' +
      '<path d="M46 118 Q72 132 100 136 L100 218 Q95 218 90 214 Z" fill="' + c[0] + '" opacity=".2"/>' +
      '<path d="M46 118 Q100 136 154 118" fill="none" stroke="' + c[0] + '" stroke-width="2" opacity=".45"/>' +
      '<path d="M100 172 q-18 -11 -24 2 q10 8 24 -2 q18 -11 24 2 q-10 8 -24 -2Z" fill="' + c[0] + '"/><path d="M97 174 l-10 22 M103 174 l10 22" stroke="' + c[0] + '" stroke-width="4" stroke-linecap="round"/><circle cx="100" cy="172" r="4.5" fill="' + c[0] + '"/>';
    return '<svg class="fh-bq" viewBox="0 0 200 224" width="' + (o.size || 140) + '" height="' + ((o.size || 140) * 224 / 200).toFixed(0) + '" role="img" aria-label="Bó hoa">' + leaves + stems + heads + wrap + '</svg>';
  }
  /* posy: 3 heads in a tight cluster, for small badges (tally chips) */
  function posy(seed, o) {
    o = o || {}; var r = rng(seed), sz = o.size || 22, out = '';
    [[-14, 6, .5], [14, 6, .5], [0, -10, .56]].forEach(function (q) { out += '<g transform="translate(' + q[0] + ' ' + q[1] + ') scale(' + q[2] + ')">' + head(r()).svg + '</g>'; });
    return '<svg class="fh-posy" viewBox="-42 -42 84 84" width="' + sz + '" height="' + sz + '" role="img" aria-label="Bó hoa">' + out + '</svg>';
  }
  function mount(el, o) {
    o = o || {}; var h = head(o.seed == null ? Math.random() : o.seed, o), sz = o.size || 64;
    el.innerHTML = '<svg class="fh" viewBox="-50 -50 100 100" width="' + sz + '" height="' + sz + '" role="img" aria-label="Hoa">' + h.svg + '</svg>';
    var s = el.firstChild;
    function setState(st) { s.classList.remove('bud', 'bloom', 'idle', 'happy'); void s.getBoundingClientRect(); s.classList.add(st); }
    setState(o.state || 'idle');
    return { el: s, colors: h.colors, kind: h.kind, setState: setState };
  }
  var CSS = '.fh{overflow:visible}.fh .fh-ring{transform-origin:0 0}.fh .fh-c{transform-origin:0 0}' +
    '.fh.bud .fh-ring{transform:scale(.18) rotate(-40deg)}.fh.bud .fh-c{transform:scale(.6)}' +
    '.fh.bloom .fh-ring{animation:fh-open .7s cubic-bezier(.34,1.56,.64,1) var(--d,0s) both}.fh.bloom .fh-c{animation:fh-c .5s cubic-bezier(.34,1.56,.64,1) .1s both}' +
    '.fh.idle,.fh-sway{animation:fh-sway 3.2s ease-in-out var(--sd,0s) infinite alternate;transform-origin:50% 50%}' +
    '.fh.happy{animation:fh-happy .8s cubic-bezier(.34,1.56,.64,1)}' +
    '@keyframes fh-open{from{transform:scale(.15) rotate(-60deg)}to{transform:none}}@keyframes fh-c{from{transform:scale(.4)}to{transform:none}}' +
    '@keyframes fh-sway{from{transform:rotate(-4deg)}to{transform:rotate(4deg)}}@keyframes fh-happy{0%{transform:scale(1)}40%{transform:scale(1.25) rotate(40deg)}100%{transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.fh *,.fh,.fh-sway{animation:none!important}}';
  if (typeof document !== 'undefined') { var st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st); }
  g.FlowerHeads = { svg: svg, head: head, bouquet: bouquet, posy: posy, mount: mount, palettes: PAL, kinds: KINDS };
})(typeof window !== 'undefined' ? window : this);
