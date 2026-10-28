// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright © 2026 JLMJLMJLM14159
// Section cards, slider/number rows, JSON output and the page buttons.
(function(D){
  var host = document.getElementById('sections'), strip = document.getElementById('strip');
  var removeBtn = document.getElementById('remove'), symBtn = document.getElementById('sym-btn');
  var out = document.getElementById('out');
  var FIELDS = D.FIELDS, rnd = D.rnd, clamp = D.clamp;
  D.refs = {};

  function renderOut(){
    out.textContent = JSON.stringify(D.snapshot(), null, 2);
    D.drawPreview();
    if(D.waveChanged) D.waveChanged();
    if(D.showUnsaved) D.showUnsaved();
    if(D.noteChange) D.noteChange();
    if(D.harmonicsChanged) D.harmonicsChanged();
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

  // The selected section is the one shown for editing. It is kept by id, so it survives undo; if it's gone, the nearest
  // remaining section (or the first) is selected instead.
  D.selId = null;
  function selIndex(){
    var list = D.state.sections, i = list.findIndex(function(x){ return x.id === D.selId; });
    if(i < 0){ i = Math.min(Math.max(D.selIdx || 0, 0), list.length - 1); D.selId = list[i].id; }
    D.selIdx = i;
    return i;
  }
  D.select = function(i){
    if(!D.state.sections[i] || D.state.sections[i].id === D.selId) return;
    D.selId = D.state.sections[i].id; render();
  };

  // The numbered strip under the preview: one button per section, coloured like its curve.
  function buildStrip(sel){
    strip.innerHTML = '';
    D.state.sections.forEach(function(s, idx){
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = idx + 1; b.className = idx % 2 ? 'alt' : '';
      b.setAttribute('aria-pressed', idx === sel ? 'true' : 'false');
      b.title = 'Section ' + (idx + 1) + ' (' + D.TYPES.filter(function(t){ return t.key === s.type; })[0].label + ')';
      b.addEventListener('click', function(){ D.select(idx); });
      strip.appendChild(b);
    });
  }

  function render(){
    host.innerHTML = ''; D.refs = {};
    var idx = selIndex(), s = D.state.sections[idx];
    buildStrip(idx);
    removeBtn.disabled = D.state.sections.length < 2;
    symBtn.setAttribute('aria-pressed', D.isHalf() ? 'true' : 'false');
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
    sec.appendChild(head);
    var locked = s === D.lockSection();
    FIELDS.forEach(function(f){
      if(f.types.indexOf(s.type) < 0) return;
      sec.appendChild(buildRow(s, f));
      if(f.key === 'ey' && locked){
        var ln = document.createElement('p');
        ln.className = 'note cardnote'; ln.textContent = D.isHalf() ? 'Linked to the start ■ (at its opposite height, for symmetry)' : 'Linked to the start ■';
        ln.title = 'The wave loops back to the start, so this end is also the start’s height. Changing it moves the start square.';
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
    renderOut();
  }

  document.getElementById('add').addEventListener('click', function(){
    var prev = D.state.sections[D.state.sections.length - 1];
    var s = D.blank(prev ? prev.ey : D.state.start.sy);
    D.state.sections.push(s); D.selId = s.id;  // the new section is selected for editing
    D.save(); render();
  });
  // Remove the selected section (there's always at least one), then select the next one along.
  removeBtn.addEventListener('click', function(){
    var list = D.state.sections, idx = selIndex();
    if(list.length < 2) return;
    D.state.sections = list.filter(function(x, i){ return i !== idx; });
    D.selId = null; D.selIdx = Math.min(idx, D.state.sections.length - 1);
    D.refitAll(); D.save(); render();
  });
  // Half-wave symmetry is part of the wave (saved with it, and undoable), not a view setting.
  symBtn.addEventListener('click', function(){
    D.setSymmetry(!D.isHalf());
    D.save(); render();
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

  // View toggles under the preview: Snap and Ghost copies (kept per browser).
  var viewBtns = document.querySelectorAll('.viewbar .toggle');
  function showView(){ viewBtns.forEach(function(b){ b.setAttribute('aria-pressed', D.view[b.dataset.view] ? 'true' : 'false'); }); }
  function toggleView(k){ D.view[k] = !D.view[k]; D.saveView(); showView(); D.drawPreview(); }
  viewBtns.forEach(function(b){ b.addEventListener('click', function(){ toggleView(b.dataset.view); }); });
  showView();

  // A popup for things that need saying (the toolbar buttons don't use the status line at the top).
  var notice = document.getElementById('notice');
  D.popup = function(title, msg){
    document.getElementById('notice-title').textContent = title;
    document.getElementById('notice-text').textContent = msg;
    if(notice.showModal){ if(!notice.open) notice.showModal(); } else window.alert(title + '\n\n' + msg);
  };

  // The shortcut cheat sheet: ? or the ? button under the preview; Esc or Close shuts it.
  var keysHelp = document.getElementById('keys-help');
  function showKeys(){ if(keysHelp.showModal && !keysHelp.open) keysHelp.showModal(); }
  document.getElementById('keys-btn').addEventListener('click', showKeys);

  // Keyboard editing, when not typing in a box, using a slider or choosing from a menu: ← → select the previous or next
  // section, ↑ ↓ move its end (by 0.05, or 0.01 with Shift), [ ] shorten or lengthen it (by 0.1, or 0.01 with Shift),
  // Delete or Backspace removes it, and Q turns snapping on or off.
  function editKeysFree(e){
    var t = e.target;
    if(document.querySelector('dialog[open]') || !moreMenu.hidden || t.isContentEditable) return false;
    return !(t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA');
  }
  window.addEventListener('keydown', function(e){
    if(e.ctrlKey || e.metaKey || e.altKey || !editKeysFree(e)) return;
    var idx = selIndex(), s = D.state.sections[idx], n = D.state.sections.length;
    if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') D.select(Math.min(n - 1, Math.max(0, idx + (e.key === 'ArrowRight' ? 1 : -1))));
    else if(e.key === 'ArrowUp' || e.key === 'ArrowDown'){ setKey(s, 'ey', s.ey + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 0.01 : 0.05)); D.save(); renderOut(); }
    else if(e.code === 'BracketLeft' || e.code === 'BracketRight'){ setKey(s, 'length', s.length + (e.code === 'BracketRight' ? 1 : -1) * (e.shiftKey ? 0.01 : 0.1)); D.save(); renderOut(); }
    else if(e.key === 'Delete' || e.key === 'Backspace'){ if(!removeBtn.disabled) removeBtn.click(); }
    else if(e.code === 'KeyQ'){ if(e.repeat) return; toggleView('snap'); }
    else if(e.key === '?'){ showKeys(); }
    else return;
    e.preventDefault();
  });

  // ⋯ More in the toolbar: a small menu whose items each open a pop-over window (Export, Data, Help).
  var moreBtn = document.getElementById('more-btn'), moreMenu = document.getElementById('more-menu');
  function setMenu(open){
    moreMenu.hidden = !open; moreBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if(open){ var r = moreBtn.getBoundingClientRect(); moreMenu.style.top = (r.bottom + 6) + 'px'; moreMenu.style.left = Math.max(8, Math.min(window.innerWidth - moreMenu.offsetWidth - 8, r.left)) + 'px'; moreMenu.querySelector('button').focus(); }
  }
  moreBtn.addEventListener('click', function(e){ e.stopPropagation(); setMenu(moreMenu.hidden); });
  moreMenu.querySelectorAll('[data-open]').forEach(function(b){
    b.addEventListener('click', function(){ setMenu(false); document.getElementById(b.dataset.open).showModal(); });
  });
  document.addEventListener('click', function(e){ if(!moreMenu.hidden && !moreMenu.contains(e.target)) setMenu(false); });
  document.addEventListener('keydown', function(e){ if(e.key === 'Escape' && !moreMenu.hidden){ setMenu(false); moreBtn.focus(); } });
  // A click on the dimmed area around a pop-over window closes it.
  document.querySelectorAll('dialog.sheet').forEach(function(d){
    d.addEventListener('click', function(e){ if(e.target === d){ var r = d.getBoundingClientRect(); if(e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } });
  });


  D.renderOut = renderOut; D.setKey = setKey; D.render = render;
})(window.Dial = window.Dial || {});
