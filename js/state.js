// Field definitions, state, persistence and geometry. No DOM access here.
(function(D){
  var KEY = 'dial-sections-v3';
  var N1 = function(){ return -1; }, P1 = function(){ return 1; };
  var span = function(s){ return Math.max(s.length, 1); };
  var HLO = function(s){ return -span(s); }, HHI = function(s){ return 2 * span(s); };
  var FIELDS = [
    { key:'length', label:'Length',     lo:function(){ return 0; }, hi:function(){ return Infinity; }, num:true },
    { key:'ey',     label:'End y',      lo:N1,  hi:P1 },
    { key:'h1x',    label:'Handle 1 x', lo:HLO, hi:HHI, gap:true },
    { key:'h1y',    label:'Handle 1 y', lo:N1,  hi:P1 },
    { key:'h2x',    label:'Handle 2 x', lo:HLO, hi:HHI, gap:true },
    { key:'h2y',    label:'Handle 2 y', lo:N1,  hi:P1 }
  ];
  var START_FIELDS = [ { key:'sy', label:'Start y', lo:N1, hi:P1 } ];
  var BYKEY = {};
  FIELDS.concat(START_FIELDS).forEach(function(f){ BYKEY[f.key] = f; });

  function newState(){ return { start: { id:'start', sx:0, sy:0 }, sections: [] }; }
  function rnd(v){ return Math.round(v * 10000) / 10000; }
  function clamp(v, lo, hi){ return Math.min(hi, Math.max(lo, v)); }

  function blank(y0){
    var y = y0 ? rnd(clamp(y0, -1, 1)) : 0, L = 5;
    return { id: Date.now() + '-' + Math.floor(Math.random() * 1e5), length: L, ey: y, h1x: rnd(L / 3), h1y: y, h2x: rnd(2 * L / 3), h2y: y };
  }
  function clampAll(){
    var state = D.state;
    state.sections.forEach(function(s){ FIELDS.forEach(function(f){ s[f.key] = rnd(clamp(s[f.key], f.lo(s), f.hi(s))); }); });
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
  D.rnd = rnd; D.clamp = clamp;
  D.newState = newState; D.blank = blank; D.load = load; D.save = save;
  D.snapshot = snapshot; D.sectionGeo = sectionGeo;
  D.state = newState();
})(window.Dial = window.Dial || {});
