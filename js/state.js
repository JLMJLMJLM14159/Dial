// Field definitions, state, persistence and geometry. No DOM access here.
(function(D){
  var KEY = 'dial-sections-v3';
  var N1 = function(){ return -1; }, P1 = function(){ return 1; };
  var HX = function(key, i){ return function(s){ return handleRange(s, key)[i]; }; };
  var HY = function(key, i){ return function(s){ return handleYRange(s, key)[i]; }; };
  // 5 is as far as a handle's height can ever go with the curve still inside -1..1: heights -1, 5, -5, 1 (and mirrored)
  // give the cubic Chebyshev curve, which touches -1 and 1 four times.
  var HYT = 5, NT = function(){ return -HYT; }, PT = function(){ return HYT; };
  // Each section has a type. Sine, flat and jump sections have no handles and can never go backwards or leave -1..1.
  var TYPES = [ { key:'bezier', label:'Bézier' }, { key:'sine', label:'Sine' }, { key:'flat', label:'Flat' }, { key:'jump', label:'Jump' } ];
  var SMOOTHS = [ { key:'both', label:'Both ends' }, { key:'end', label:'End only' }, { key:'start', label:'Start only' } ];
  var HAS = function(list, key){ return list.some(function(o){ return o.key === key; }); };
  // Handle fields have a fixed slider track (tlo..thi) but a narrower allowed range (lo..hi) that depends on the rest of the section.
  // types lists the section types that show the field.
  var FIELDS = [
    { key:'length', label:'Length',     lo:function(){ return 0; }, hi:function(){ return Infinity; }, num:true, types:['bezier', 'sine', 'flat'] },
    { key:'ey',     label:'End y',      lo:N1,  hi:P1, types:['bezier', 'sine', 'jump'] },
    { key:'h1x',    label:'Handle 1 x', lo:HX('h1x', 0), hi:HX('h1x', 1), tlo:function(){ return 0; }, thi:function(s){ return 4 * s.length / 3; }, hx:true, gap:true, types:['bezier'] },
    { key:'h1y',    label:'Handle 1 y', lo:HY('h1y', 0), hi:HY('h1y', 1), tlo:NT, thi:PT, hy:true, types:['bezier'] },
    { key:'h2x',    label:'Handle 2 x', lo:HX('h2x', 0), hi:HX('h2x', 1), tlo:function(s){ return -s.length / 3; }, thi:function(s){ return s.length; }, hx:true, gap:true, types:['bezier'] },
    { key:'h2y',    label:'Handle 2 y', lo:HY('h2y', 0), hi:HY('h2y', 1), tlo:NT, thi:PT, hy:true, types:['bezier'] }
  ];
  var START_FIELDS = [ { key:'sy', label:'Start y', lo:N1, hi:P1 } ];
  var BYKEY = {};
  FIELDS.concat(START_FIELDS).forEach(function(f){ BYKEY[f.key] = f; });

  function newState(){ return { start: { id:'start', sx:0, sy:0 }, sections: [] }; }
  function rnd(v){ return Math.round(v * 10000) / 10000 + 0; }  // + 0 turns -0 into 0
  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }

  // A section never goes backwards (x never decreases along it) exactly when, with a = h1x and d = length - h2x,
  // a >= 0, d >= 0 and a + d - sqrt(a*d) <= length. This is x'(t) >= 0, a quadratic Bézier in a, length - a - d and d.
  function forwardOnly(h1x, h2x, L){
    var a = h1x, d = L - h2x;
    return a >= 0 && d >= 0 && a + d - Math.sqrt(a * d) <= L;
  }
  // Allowed values of a (or d) given the other: its square root lies between (sqrt(other) ± sqrt(4L - 3·other)) / 2.
  function coefRange(other, L){
    var r = Math.sqrt(Math.max(0, other)), q = Math.sqrt(Math.max(0, 4 * L - 3 * other));
    var lo = Math.max(0, (r - q) / 2), hi = (r + q) / 2;
    return [lo * lo, hi * hi];
  }
  // Range for one handle's x given the other, rounded inwards to 4 decimals so every stored value passes forwardOnly.
  function handleRange(s, key){
    var L = s.length, isH1 = key === 'h1x', cur = s[key], c, lo, hi, i;
    if(isH1){ c = coefRange(L - s.h2x, L); lo = c[0]; hi = c[1]; }
    else{ c = coefRange(s.h1x, L); lo = L - c[1]; hi = L - c[0]; }
    function ok(v){ return isH1 ? forwardOnly(v, s.h2x, L) : forwardOnly(s.h1x, v, L); }
    lo = rnd(Math.ceil(lo * 10000 - 1e-6) / 10000); hi = rnd(Math.floor(hi * 10000 + 1e-6) / 10000);
    for(i = 0; i < 10 && lo < hi && !ok(lo); i++) lo = rnd(lo + 1e-4);
    for(i = 0; i < 10 && hi > lo && !ok(hi); i++) hi = rnd(hi - 1e-4);
    if(!ok(lo)) lo = cur;
    if(!ok(hi)) hi = cur;
    return [Math.min(lo, cur), Math.max(hi, cur)];
  }
  // Bring the handles back inside the allowed region (after a length change, or on load): keep a, d >= 0, then
  // scale (a, d) towards the start so a + d - sqrt(a*d) = length. Handles that already fit don't move.
  function fitHandles(s){
    var L = s.length, a = Math.max(0, s.h1x), d = Math.max(0, L - s.h2x), f = a + d - Math.sqrt(a * d);
    var k = f > L ? L / f : 1;
    for(var i = 0; i < 50; i++, k *= 0.999){
      var h1 = rnd(a * k), h2 = rnd(L - d * k);
      if(forwardOnly(h1, h2, L)){ s.h1x = h1; s.h2x = h2; return; }
    }
    s.h1x = 0; s.h2x = L;
  }

  // Heights of a Bézier's turning points strictly inside the section: the roots of y'(t), a quadratic Bézier in
  // p1 - y0, p2 - p1 and y3 - p2.
  function turningYs(y0, p1, p2, y3){
    var d0 = p1 - y0, d1 = p2 - p1, d2 = y3 - p2, a = d0 - 2 * d1 + d2, b = 2 * (d1 - d0), c = d0, ts = [];
    if(Math.abs(a) < 1e-12){ if(b !== 0) ts.push(-c / b); }
    else{ var disc = b * b - 4 * a * c; if(disc >= 0){ var q = Math.sqrt(disc); ts.push((-b - q) / (2 * a), (-b + q) / (2 * a)); } }
    return ts.filter(function(t){ return t > 0 && t < 1; }).map(function(t){
      var u = 1 - t;
      return u * u * u * y0 + 3 * u * u * t * p1 + 3 * u * t * t * p2 + t * t * t * y3;
    });
  }
  // Does the curve with these heights (start, handle 1, handle 2, end) stay within -1..1? Start and end are already in the band,
  // so only the turning points inside the section matter.
  function inBand(y0, p1, p2, y3){
    return turningYs(y0, p1, p2, y3).every(function(y){ return Math.abs(y) <= 1 + 1e-9; });
  }
  function startYOf(s){
    var y = D.state.start.sy, list = D.state.sections;
    for(var i = 0; i < list.length && list[i] !== s; i++) y = list[i].ey;
    return y;
  }
  // Range for one handle's height given the rest of the section. The allowed values form one interval (each moment t
  // limits the height linearly), so find each edge by halving, then round inwards to 4 decimals.
  function handleYRange(s, key){
    var y0 = startYOf(s), cur = s[key], isH1 = key === 'h1y';
    function ok(v){ return isH1 ? inBand(y0, v, s.h2y, s.ey) : inBand(y0, s.h1y, v, s.ey); }
    if(!ok(cur)) return [cur, cur];
    function edge(dir){
      var a = cur, b = cur + dir * 2 * HYT, i, e;
      for(i = 0; i < 50; i++){ var m = (a + b) / 2; if(ok(m)) a = m; else b = m; }
      e = rnd(dir > 0 ? Math.floor(a * 10000 + 1e-6) / 10000 : Math.ceil(a * 10000 - 1e-6) / 10000);
      for(i = 0; i < 10 && !ok(e); i++) e = rnd(e - dir * 1e-4);
      if(!ok(e)) return cur;
      return dir > 0 ? Math.max(e, cur) : Math.min(e, cur);
    }
    return [edge(-1), edge(1)];
  }
  // If a start or end height change pushes the curve out of -1..1, move both handle heights towards the straight line
  // from start to end (which always fits) just far enough. Handles that already fit don't move.
  function fitY(s, y0){
    if(inBand(y0, s.h1y, s.h2y, s.ey)) return;
    var r1 = y0 + (s.ey - y0) / 3, r2 = y0 + 2 * (s.ey - y0) / 3, lo = 0, hi = 1, i;
    for(i = 0; i < 40; i++){ var k = (lo + hi) / 2; if(inBand(y0, r1 + k * (s.h1y - r1), r2 + k * (s.h2y - r2), s.ey)) lo = k; else hi = k; }
    for(i = 0; i < 50; i++, lo *= 0.999){
      var a = rnd(r1 + lo * (s.h1y - r1)), b = rnd(r2 + lo * (s.h2y - r2));
      if(inBand(y0, a, b, s.ey)){ s.h1y = a; s.h2y = b; return; }
    }
    s.h1y = rnd(r1); s.h2y = rnd(r2);
  }
  // The wave ends at the first point's height so it repeats without a jump. That end height is set by the last section
  // that isn't Flat, since a Flat section just carries the height before it along.
  function lockSection(){
    var list = D.state.sections;
    for(var i = list.length - 1; i >= 0; i--) if(list[i].type !== 'flat') return list[i];
    return null;
  }
  // After a height is changed: the locked end and the first point are one value, so moving the end moves the start.
  // (Moving the start moves the end through refitAll.)
  function linkEnds(obj, key){
    if(key === 'ey' && obj === lockSection()) D.state.start.sy = obj.ey;
  }

  // Re-check every section after any change: a section's start height is the previous section's end height.
  // A jump always has length 0, a flat section always ends at its start height, and the locked end matches the first point.
  function refitAll(){
    var y = D.state.start.sy, lk = lockSection();
    if(lk) lk.ey = y;
    D.state.sections.forEach(function(s){
      if(s.type === 'jump') s.length = 0;
      if(s.type === 'flat') s.ey = y;
      fitHandles(s); fitY(s, y); y = s.ey;
    });
  }

  // Height along a sine or flat section, u = 0..1 across its length. The sine shapes are parts of a sine wave stretched
  // between the start and end heights (half a cycle, or a quarter that is smooth at one end), so chained ones give an exact sine.
  function shapeY(s, y0, u){
    var k;
    if(s.type === 'flat') return y0;
    if(s.smooth === 'end') k = Math.sin(Math.PI * u / 2);
    else if(s.smooth === 'start') k = 1 - Math.cos(Math.PI * u / 2);
    else k = (1 - Math.cos(Math.PI * u)) / 2;
    return y0 + (s.ey - y0) * k;
  }
  // Handles that make a Bézier copy the section's current shape, used when switching a section to Bézier.
  // The sine ones are the closest cubic fits (within about 0.0002 of the height change); the rest are a straight line.
  function matchHandles(s, y0){
    var L = s.length, dy = s.ey - y0, a = 0.326, b = 0.638, k = 0.36435, h;
    if(s.type === 'sine' && s.smooth === 'both') h = [k, 0, 1 - k, 1];
    else if(s.type === 'sine' && s.smooth === 'end') h = [a, a * Math.PI / 2, b, 1];
    else if(s.type === 'sine') h = [1 - b, 0, 1 - a, 1 - a * Math.PI / 2];
    else h = [1 / 3, 1 / 3, 2 / 3, 2 / 3];
    s.h1x = rnd(h[0] * L); s.h1y = rnd(y0 + h[1] * dy); s.h2x = rnd(h[2] * L); s.h2y = rnd(y0 + h[3] * dy);
  }
  // A jump remembers the length it had, so switching back restores it.
  function setType(s, type){
    if(s.type === type) return;
    if(type === 'jump') s.lastLength = s.length;
    else if(s.type === 'jump') s.length = s.lastLength > 0 ? s.lastLength : 5;
    if(type === 'bezier') matchHandles(s, startYOf(s));
    s.type = type;
    refitAll();
  }

  // Shift every height so the first point sits on the middle line, then stretch or shrink them so the curve is as large as
  // fits: its furthest point from the middle line reaches 1 or -1. Every section type is built from its heights in a
  // straight-line way, so this keeps each shape exactly (apart from rounding to 4 decimals).
  function scaleToFit(){
    var st = D.state, y = st.start.sy, lo = y, hi = y;
    st.sections.forEach(function(s){
      var ys = [s.ey];
      if(s.type === 'bezier') ys = ys.concat(turningYs(y, s.h1y, s.h2y, s.ey));
      ys.forEach(function(v){ lo = Math.min(lo, v); hi = Math.max(hi, v); });
      y = s.ey;
    });
    var y0 = st.start.sy, reach = Math.max(hi - y0, y0 - lo);
    function f(v){ return reach > 1e-9 ? (v - y0) / reach : v - y0; }  // a flat line just moves onto the middle line
    st.start.sy = rnd(clamp(f(st.start.sy), -1, 1));
    st.sections.forEach(function(s){ s.ey = rnd(clamp(f(s.ey), -1, 1)); s.h1y = rnd(f(s.h1y)); s.h2y = rnd(f(s.h2y)); });
    refitAll();
  }

  // One cycle of the wave as N evenly spaced heights. x runs from the first point to the last end, so jumps fall between
  // samples, and after the last end the wave jumps back to the first point's height to repeat. A Bézier is read by finding
  // the t where x(t) reaches each sample's x, which has exactly one answer because sections never go backwards.
  function sampleCycle(N){
    var geo = sectionGeo(), out = new Float32Array(N), total = 0, i = 0;
    geo.forEach(function(g){ total += g.s.length; });
    if(!(total > 0)) return out;  // no length at all: silence
    for(var k = 0; k < N; k++){
      var x = k / N * total;
      while(i < geo.length - 1 && !(geo[i].s.length > 0 && x < geo[i].X + geo[i].s.length)) i++;
      var g = geo[i], s = g.s, rx = x - g.X;
      if(s.type !== 'bezier'){ out[k] = shapeY(s, g.Y, rx / s.length); continue; }
      var lo = 0, hi = 1, t, u;
      for(var j = 0; j < 40; j++){
        t = (lo + hi) / 2; u = 1 - t;
        if(3 * u * u * t * s.h1x + 3 * u * t * t * s.h2x + t * t * t * s.length < rx) lo = t; else hi = t;
      }
      t = (lo + hi) / 2; u = 1 - t;
      out[k] = u * u * u * g.Y + 3 * u * u * t * s.h1y + 3 * u * t * t * s.h2y + t * t * t * s.ey;
    }
    return out;
  }

  function blank(y0){
    var y = y0 ? rnd(clamp(y0, -1, 1)) : 0, L = 5;
    return { id: Date.now() + '-' + Math.floor(Math.random() * 1e5), type: 'bezier', smooth: 'both', length: L, ey: y, h1x: rnd(L / 3), h1y: y, h2x: rnd(2 * L / 3), h2y: y };
  }
  function clampAll(){
    var state = D.state;
    state.sections.forEach(function(s){
      FIELDS.forEach(function(f){ if(!f.hx && !f.hy) s[f.key] = rnd(clamp(s[f.key], f.lo(s), f.hi(s))); });
    });
    START_FIELDS.forEach(function(f){ state.start[f.key] = rnd(clamp(state.start[f.key], f.lo(state.start), f.hi(state.start))); });
    refitAll();
  }
  function load(){
    try{
      var s = JSON.parse(localStorage.getItem(KEY));
      if(s && Array.isArray(s.sections)) s.sections.forEach(function(x){
        if(!x) return;
        if(typeof x.ey !== 'number') x.ey = 0;
        if(!HAS(TYPES, x.type)) x.type = 'bezier';
        if(!HAS(SMOOTHS, x.smooth)) x.smooth = 'both';
      });
      if(s && Array.isArray(s.sections) && s.sections.length &&
         s.sections.every(function(x){ return FIELDS.every(function(f){ return typeof x[f.key] === 'number'; }); })){
        if(!s.start || typeof s.start.sy !== 'number') s.start = { sx:0, sy:0 };
        s.start.id = 'start'; s.start.sx = 0;
        delete s.max;
        D.state = s;
        clampAll();
        return;
      }
    }catch(e){}
    D.state.sections.push(blank());
  }
  function save(){
    try{ localStorage.setItem(KEY, JSON.stringify(D.state)); }catch(e){}
  }

  function snapshot(){
    var state = D.state;
    return {
      start: { y: state.start.sy },
      sections: state.sections.map(function(s, i){
        // Only what the type uses: a jump has no length, a flat section's end height is its start height.
        var o = { section: i + 1, type: s.type };
        if(s.type !== 'jump') o.length = s.length;
        if(s.type !== 'flat') o.end = { y: s.ey };
        if(s.type === 'sine') o.smooth = s.smooth;
        if(s.type === 'bezier'){ o.handle1 = { x: s.h1x, y: s.h1y }; o.handle2 = { x: s.h2x, y: s.h2y }; }
        return o;
      })
    };
  }

  // x values are measured from each section's start; every y value is a height above or below the middle line (y = 0).
  function sectionGeo(){
    var X = D.state.start.sx, Y = D.state.start.sy, res = [];
    D.state.sections.forEach(function(s){
      res.push({ s:s, X:X, Y:Y, P:[[X,Y], [X+s.h1x,s.h1y], [X+s.h2x,s.h2y], [X+s.length, s.ey]] });
      X += s.length; Y = s.ey;
    });
    return res;
  }

  D.FIELDS = FIELDS; D.START_FIELDS = START_FIELDS; D.BYKEY = BYKEY; D.TYPES = TYPES; D.SMOOTHS = SMOOTHS;
  D.shapeY = shapeY; D.setType = setType; D.lockSection = lockSection; D.linkEnds = linkEnds; D.scaleToFit = scaleToFit; D.sampleCycle = sampleCycle;
  D.rnd = rnd; D.clamp = clamp; D.forwardOnly = forwardOnly; D.inBand = inBand; D.refitAll = refitAll;
  D.newState = newState; D.blank = blank; D.load = load; D.save = save;
  D.snapshot = snapshot; D.sectionGeo = sectionGeo;
  D.state = newState();
})(window.Dial = window.Dial || {});
