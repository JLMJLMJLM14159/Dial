// Section cards, slider/number rows, JSON output and the page buttons.
(function(D){
  var host = document.getElementById('sections');
  var startRows = document.getElementById('startrows');
  var out = document.getElementById('out');
  var FIELDS = D.FIELDS, START_FIELDS = D.START_FIELDS, rnd = D.rnd, clamp = D.clamp;
  D.refs = {};

  function renderOut(){
    out.textContent = JSON.stringify(D.snapshot(), null, 2);
    D.drawPreview();
  }

  // Handle x ranges depend on the section's length, so refresh them in place when it changes.
  function applyRanges(obj){
    FIELDS.forEach(function(f){
      if(f.num) return;
      var ref = D.refs[obj.id + f.key]; if(!ref) return;
      var lo = f.lo(obj), hi = f.hi(obj);
      ref.r.min = lo; ref.r.max = hi; ref.r.step = (hi - lo) / 1000 || 'any';
      ref.n.min = lo; ref.n.max = hi;
      obj[f.key] = rnd(clamp(obj[f.key], lo, hi));
      ref.r.value = obj[f.key]; ref.n.value = obj[f.key];
    });
  }

  // Set one value from outside its row (used by dragging) and keep the row in sync.
  function setKey(obj, key, v){
    var f = D.BYKEY[key];
    obj[key] = rnd(clamp(v, f.lo(obj), f.hi(obj)));
    var ref = D.refs[obj.id + key];
    if(ref){ if(ref.r) ref.r.value = obj[key]; ref.n.value = obj[key]; }
    if(key === 'length') applyRanges(obj);
  }

  function buildRow(obj, f){
    var lo = f.lo(obj), hi = f.hi(obj);
    var id = 'f-' + obj.id + '-' + f.key;
    var row = document.createElement('div');
    row.className = 'dial' + (f.gap ? ' gap' : '') + (f.num ? ' numonly' : '');

    var l = document.createElement('label'); l.htmlFor = id; l.textContent = f.label;

    var r = null;
    if(!f.num){
      r = document.createElement('input');
      r.type = 'range'; r.min = lo; r.max = hi; r.step = (hi - lo) / 1000 || 'any'; r.value = obj[f.key];
      r.setAttribute('aria-label', f.label + ' slider');
    }
    var n = document.createElement('input');
    n.type = 'number'; n.id = id; n.step = 'any'; n.min = lo; if(isFinite(hi)) n.max = hi; n.value = obj[f.key];

    function commit(v){
      obj[f.key] = rnd(clamp(v, f.lo(obj), f.hi(obj)));
      if(r) r.value = obj[f.key];
      if(f.key === 'length') applyRanges(obj);
      D.save(); renderOut();
    }
    if(r) r.addEventListener('input', function(){ commit(parseFloat(r.value)); n.value = obj[f.key]; });
    n.addEventListener('input', function(){
      var v = parseFloat(n.value);
      if(isNaN(v)) return;
      commit(v);
    });
    n.addEventListener('change', function(){ n.value = obj[f.key]; });

    D.refs[obj.id + f.key] = { r: r, n: n };
    row.appendChild(l); if(r) row.appendChild(r); row.appendChild(n);
    return row;
  }

  function render(){
    host.innerHTML = ''; startRows.innerHTML = ''; D.refs = {};
    START_FIELDS.forEach(function(f){ startRows.appendChild(buildRow(D.state.start, f)); });
    D.state.sections.forEach(function(s, idx){
      var sec = document.createElement('section');
      sec.className = 'section';

      var head = document.createElement('div');
      head.className = 'head';
      var h = document.createElement('h2');
      h.textContent = 'Section ' + (idx + 1);
      head.appendChild(h);
      if(D.state.sections.length > 1){
        var rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'remove'; rm.textContent = 'Remove';
        rm.addEventListener('click', function(){
          D.state.sections = D.state.sections.filter(function(x){ return x.id !== s.id; });
          D.save(); render();
        });
        head.appendChild(rm);
      }
      sec.appendChild(head);
      FIELDS.forEach(function(f){ sec.appendChild(buildRow(s, f)); });
      host.appendChild(sec);
    });
    renderOut();
  }

  document.getElementById('add').addEventListener('click', function(){
    var prev = D.state.sections[D.state.sections.length - 1];
    D.state.sections.push(D.blank(prev ? prev.ey : D.state.start.sy));
    D.save(); render();
    var last = host.lastElementChild;
    if(last) last.scrollIntoView({ behavior:'smooth', block:'nearest' });
  });
  document.getElementById('reset').addEventListener('click', function(){
    D.state = D.newState();
    D.state.sections.push(D.blank());
    D.save(); render();
  });
  document.getElementById('copy').addEventListener('click', function(){
    var btn = this, txt = out.textContent;
    function done(){ btn.textContent = 'Copied'; setTimeout(function(){ btn.textContent = 'Copy JSON'; }, 1200); }
    function fallback(){
      var r = document.createRange(); r.selectNodeContents(out);
      var sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
      try{ document.execCommand('copy'); done(); }catch(e){}
    }
    try{ navigator.clipboard.writeText(txt).then(done, fallback); }catch(e){ fallback(); }
  });

  D.renderOut = renderOut; D.setKey = setKey; D.render = render;
})(window.Dial = window.Dial || {});
