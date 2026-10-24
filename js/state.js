// Field definitions, state, persistence and geometry. No DOM access here.
(function(D){
  var KEY = 'dial-sections-v3';
  var N1 = function(){ return -1; }, P1 = function(){ return 1; };
  var HX = function(key, i){ return function(s){ return handleRange(s, key)[i]; }; };
  // Handle x fields have a fixed slider track (tlo..thi) but a narrower allowed range (lo..hi) that depends on the other handle.
  var FIELDS = [
    { key:'length', label:'Length',     lo:function(){ return 0; }, hi:function(){ return Infinity; }, num:true },
    { key:'ey',     label:'End y',      lo:N1,  hi:P1 },
    { key:'h1x',    label:'Handle 1 x', lo:HX('h1x', 0), hi:HX('h1x', 1), tlo:function(){ return 0; }, thi:function(s){ return 4 * s.length / 3; }, hx:true, gap:true },
    { key:'h1y',    label:'Handle 1 y', lo:N1,  hi:P1 },
    { key:'h2x',    label:'Handle 2 x', lo:HX('h2x', 0), hi:HX('h2x', 1), tlo:function(s){ return -s.length / 3; }, thi:function(s){ return s.length; }, hx:true, gap:true },
    { key:'h2y',    label:'Handle 2 y', lo:N1,  hi:P1 }
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

  function blank(y0){
    var y = y0 ? rnd(clamp(y0, -1, 1)) : 0, L = 5;
    return { id: Date.now() + '-' + Math.floor(Math.random() * 1e5), length: L, ey: y, h1x: rnd(L / 3), h1y: y, h2x: rnd(2 * L / 3), h2y: y };
  }
  function clampAll(){
    var state = D.state;
    state.sections.forEach(function(s){
      FIELDS.forEach(function(f){ if(!f.hx) s[f.key] = rnd(clamp(s[f.key], f.lo(s), f.hi(s))); });
      fitHandles(s);
    });
    START_FIELDS.forEach(function(f){ state.start[f.key] = rnd(clamp(state.start[f.key], f.lo(state.start), f.hi(state.start))); });
  }
  function load(){
    try{
      var s = JSON.parse(localStorage.getItem(KEY));
      if(s && Array.isArray(s.sections)) s.sections.forEach(function(x){ if(x && typeof x.ey !== 'number') x.ey = 0; });
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
      start: { x: state.start.sx, y: state.start.sy },
      sections: state.sections.map(function(s, i){
        return {
          section: i + 1, length: s.length, end: { x: s.length, y: s.ey },
          handle1: { x: s.h1x, y: s.h1y },
          handle2: { x: s.h2x, y: s.h2y }
        };
      })
    };
  }

  // x values are measured from each section's start; every y value is a height above or below the middle line (y = 0).
  function sectionGeo(){
    var X = D.state.start.sx, Y = D.state.start.sy, res = [];
    D.state.sections.forEach(function(s){
      res.push({ X:X, Y:Y, P:[[X,Y], [X+s.h1x,s.h1y], [X+s.h2x,s.h2y], [X+s.length, s.ey]] });
      X += s.length; Y = s.ey;
    });
    return res;
  }

  D.FIELDS = FIELDS; D.START_FIELDS = START_FIELDS; D.BYKEY = BYKEY;
  D.rnd = rnd; D.clamp = clamp; D.forwardOnly = forwardOnly; D.fitHandles = fitHandles;
  D.newState = newState; D.blank = blank; D.load = load; D.save = save;
  D.snapshot = snapshot; D.sectionGeo = sectionGeo;
  D.state = newState();
})(window.Dial = window.Dial || {});
