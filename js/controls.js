// Section cards, slider/number rows, JSON output and the page buttons.
(function(D){
  var host = document.getElementById('sections');
  var out = document.getElementById('out');
  var FIELDS = D.FIELDS, rnd = D.rnd, clamp = D.clamp;
  D.refs = {};

  function renderOut(){
    out.textContent = JSON.stringify(D.snapshot(), null, 2);
    D.drawPreview();
    if(D.waveChanged) D.waveChanged();
    if(D.showUnsaved) D.showUnsaved();
  }

  // Slider tracks follow the length and each handle's allowed range depends on the rest of the section, so refresh them in place.
  function applyRanges(obj){
    FIELDS.forEach(function(f){
      if(f.num) return;
      var ref = D.refs[obj.id + f.key]; if(!ref) return;
      var lo = f.lo(obj), hi = f.hi(obj), tlo = (f.tlo || f.lo)(obj), thi = (f.thi || f.hi)(obj);
      ref.r.min = tlo; ref.r.max = thi; ref.r.step = (thi - tlo) / 1000 || 'any';
      ref.n.min = lo; ref.n.max = hi;
      obj[f.key] = rnd(clamp(obj[f.key], lo, hi));
      ref.r.value = obj[f.key];
      if(document.activeElement !== ref.n) ref.n.value = obj[f.key];  // don't overwrite a number being typed
    });
  }

  // Any change can move another section's limits (a section starts at the previous one's end), so refresh everything.
  function refreshAll(){
    D.refitAll();
    D.state.sections.forEach(applyRanges);
  }

  // Set one value from outside its row (used by dragging) and keep the row in sync.
  function setKey(obj, key, v){
    var f = D.BYKEY[key];
    obj[key] = rnd(clamp(v, f.lo(obj), f.hi(obj)));
    var ref = D.refs[obj.id + key];
    if(ref){ if(ref.r) ref.r.value = obj[key]; ref.n.value = obj[key]; }
    D.linkEnds(obj, key);
    refreshAll();
  }

  function buildRow(obj, f){
    var lo = f.lo(obj), hi = f.hi(obj), tlo = (f.tlo || f.lo)(obj), thi = (f.thi || f.hi)(obj);
    var id = 'f-' + obj.id + '-' + f.key;
    var row = document.createElement('div');
    row.className = 'dial' + (f.gap ? ' gap' : '') + (f.num ? ' numonly' : '');

    var l = document.createElement('label'); l.htmlFor = id; l.textContent = f.label;

    var r = null;
    if(!f.num){
      r = document.createElement('input');
      r.type = 'range'; r.min = tlo; r.max = thi; r.step = (thi - tlo) / 1000 || 'any'; r.value = obj[f.key];
      r.setAttribute('aria-label', f.label + ' slider');
    }
    var n = document.createElement('input');
    n.type = 'number'; n.id = id; n.step = 'any'; n.min = lo; if(isFinite(hi)) n.max = hi; n.value = obj[f.key];

    function commit(v){
      obj[f.key] = rnd(clamp(v, f.lo(obj), f.hi(obj)));
      if(r) r.value = obj[f.key];
      D.linkEnds(obj, f.key);
      refreshAll();
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

  // A drop-down (section type, or which end of a sine is smooth).
  function buildSelect(id, label, options, value, onchange){
    var sel = document.createElement('select');
    sel.id = id; sel.setAttribute('aria-label', label);
    options.forEach(function(o){
      var op = document.createElement('option'); op.value = o.key; op.textContent = o.label;
      sel.appendChild(op);
    });
    sel.value = value;
    sel.addEventListener('change', function(){ onchange(sel.value); });
    return sel;
  }

  function render(){
    host.innerHTML = ''; D.refs = {};
    D.state.sections.forEach(function(s, idx){
      var sec = document.createElement('section');
      sec.className = 'section';

      var head = document.createElement('div');
      head.className = 'head';
      var h = document.createElement('h2');
      h.textContent = 'Section ' + (idx + 1);
      head.appendChild(h);
      var typeId = 't-' + s.id;
      head.appendChild(buildSelect(typeId, 'Section ' + (idx + 1) + ' type', D.TYPES, s.type, function(v){
        D.setType(s, v); D.save(); render();
        document.getElementById(typeId).focus();
      }));
      if(D.state.sections.length > 1){
        var rm = document.createElement('button');
        rm.type = 'button'; rm.className = 'remove'; rm.textContent = 'Remove';
        rm.addEventListener('click', function(){
          D.state.sections = D.state.sections.filter(function(x){ return x.id !== s.id; });
          D.refitAll(); D.save(); render();
        });
        head.appendChild(rm);
      }
      sec.appendChild(head);
      var locked = s === D.lockSection();
      FIELDS.forEach(function(f){
        if(f.types.indexOf(s.type) < 0) return;
        sec.appendChild(buildRow(s, f));
        if(f.key === 'ey' && locked){
          var ln = document.createElement('p');
          ln.className = 'note cardnote'; ln.textContent = 'Linked to the start square: the wave loops back to the start, so this is also the start’s height.';
          sec.appendChild(ln);
        }
      });
      if(s.type === 'sine'){
        var row = document.createElement('div'), l = document.createElement('label'), smId = 's-' + s.id;
        row.className = 'dial choice'; l.htmlFor = smId; l.textContent = 'Smooth at';
        row.appendChild(l);
        row.appendChild(buildSelect(smId, 'Smooth at', D.SMOOTHS, s.smooth, function(v){ s.smooth = v; D.save(); renderOut(); }));
        sec.appendChild(row);
      }
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
  document.getElementById('fit').addEventListener('click', function(){
    D.scaleToFit();
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
