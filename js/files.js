// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright © 2026 JLMJLMJLM14159
// Saving and opening wave files (name.dial.json), so waves can be kept and shared. Files open with the Open wave button
// or by dropping one anywhere on the page. Tracks unsaved changes: a * in the tab title, and a "save first?" question
// before anything replaces a wave that has changes.
(function(D){
  var nameIn = document.getElementById('wave-name'), picker = document.getElementById('wave-file');
  var unsavedEl = document.getElementById('unsaved');
  var ask = document.getElementById('ask'), askText = document.getElementById('ask-text');

  // The wave has unsaved changes when it differs from how it was when last saved, opened or started.
  function isDirty(){ return D.waveKey() !== D.state.savedAs; }
  function markSaved(){ D.state.savedAs = D.waveKey(); D.save(); D.showUnsaved(); }
  D.showUnsaved = function(){
    var dirty = isDirty();
    document.title = (D.state.name || 'Untitled') + (dirty ? '*' : '') + ' – Dial sections';
    unsavedEl.hidden = !dirty;
  };
  D.initFiles = function(){
    nameIn.value = D.state.name || '';
    if(typeof D.state.savedAs !== 'string') markSaved();  // first visit, or saved before this existed
    D.showUnsaved();
  };
  nameIn.addEventListener('input', function(){ D.state.name = nameIn.value; D.save(); D.showUnsaved(); D.noteChange(); });

  // Ask what to do about unsaved changes before replacing the wave: 'save', 'discard' or 'cancel'.
  // With nothing unsaved there's nothing to ask.
  function askUnsaved(what){
    if(!isDirty()) return Promise.resolve('discard');
    var msg = '“' + (D.state.name || 'Untitled') + '” has changes that haven’t been saved. Save it before you ' + what + '?';
    if(!ask.showModal) return Promise.resolve(window.confirm(msg + '\n\nOK continues without saving.') ? 'discard' : 'cancel');
    return new Promise(function(resolve){
      askText.textContent = msg;
      ask.returnValue = '';
      ask.addEventListener('close', function(){ resolve(ask.returnValue || 'cancel'); }, { once: true });  // Esc counts as Cancel
      ask.showModal();
    });
  }

  // A name that is safe as a file name on every system.
  function fileName(){
    var n = (D.state.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[\s.]+|[\s.]+$/g, '');
    return (n || 'my-wave') + '.dial.json';
  }
  function saveWave(){
    var a = document.createElement('a'), name = fileName();
    a.href = URL.createObjectURL(new Blob([JSON.stringify(D.fileData(), null, 2) + '\n'], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    markSaved();
    return name;
  }
  // Nothing here shows a message when things go fine (the owner asked for that); real problems that would otherwise go
  // unnoticed get a popup.
  document.getElementById('save').addEventListener('click', function(){ saveWave(); });

  // Runs the replacing step once any unsaved changes are dealt with; returns a note about the save, if one was made.
  function afterAsking(what, replace){
    return askUnsaved(what).then(function(choice){
      if(choice === 'cancel') return;
      var saved = choice === 'save' ? ' Your previous wave was saved as ' + saveWave() + '.' : '';
      replace(saved);
    });
  }

  function openFile(file){
    if(!file) return;
    file.text().then(function(txt){
      var o = null;
      try{ o = JSON.parse(txt); }catch(e){}
      var st = o && D.fromFile(o);
      if(!st){ D.popup('That file couldn’t be opened', file.name + ' isn’t a saved wave, so nothing was opened.'); return; }
      if(!st.name) st.name = file.name.replace(/(\.dial)?\.json$/i, '');
      afterAsking('open “' + st.name + '”', function(saved){
        var r = D.loadWave(st);
        D.save(); D.render(); nameIn.value = D.state.name || ''; D.showUnsaved(); D.resetHistory();
        var warn = (r.adjusted ? 'Some values were adjusted to fit the editor’s rules. ' : '') +
          (r.newer ? 'It was saved by a newer version of this page, so some parts may be missing.' : '');
        if(warn) D.popup('Opened “' + D.state.name + '”', warn.trim());
      });
    }, function(){ D.popup('That file couldn’t be opened', 'The file couldn’t be read.'); });
  }
  document.getElementById('open').addEventListener('click', function(){ picker.click(); });

  // Presets: standard waves built from exact pieces, in the same form as a saved file. Each cycle is 4 long; all but the
  // square start on the middle line.
  function L(length, y){ return { type:'line', length: length, end:{ y: y } }; }
  function Q(smooth, y){ return { type:'sine', length: 1, end:{ y: y }, smooth: smooth }; }
  var PRESETS = {
    sine:     { name:'Sine',     start:{ y:0 }, sections:[Q('end', 1), Q('start', 0), Q('end', -1), Q('start', 0)] },
    saw:      { name:'Saw',      start:{ y:0 }, sections:[L(2, 1), L(0, -1), L(2, 0)] },
    triangle: { name:'Triangle', start:{ y:0 }, sections:[L(1, 1), L(2, -1), L(1, 0)] },
    square:   { name:'Square',   start:{ y:1 }, sections:[L(2, 1), L(0, -1), L(2, -1), L(0, 1)] }
  };
  var presetSel = document.getElementById('preset');
  presetSel.addEventListener('change', function(){
    var p = PRESETS[presetSel.value];
    presetSel.value = '';  // back to "Presets", ready for next time
    if(!p) return;
    afterAsking('open the ' + p.name + ' preset', function(saved){
      D.loadWave(D.fromFile(p));
      D.save(); D.render(); nameIn.value = D.state.name; D.showUnsaved(); D.resetHistory();
    });
  });
  picker.addEventListener('change', function(){ openFile(picker.files[0]); picker.value = ''; });

  document.getElementById('new').addEventListener('click', function(){
    afterAsking('start a new wave', function(saved){
      D.state = D.newState();
      D.state.sections.push(D.blank());
      D.render(); nameIn.value = ''; markSaved(); D.resetHistory();
    });
  });

  // Share links: the whole wave (the same data as a saved file) is compressed and put after "#w=" in the address, so no
  // server is involved and the part after # never leaves the browser. "#w=1." means compressed (deflate), "#w=0." plain;
  // the number lets the link format change later without breaking old links. A copy opened from disk links to the
  // online site, since a link to a file on one computer would be no use to anyone else.
  var ONLINE = 'https://jlmjlmjlm14159.github.io/Dial/';
  function toB64(bytes){
    var s = '', i;
    for(i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function fromB64(t){
    var s = atob(t.replace(/-/g, '+').replace(/_/g, '/')), bytes = new Uint8Array(s.length);
    for(var i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
    return bytes;
  }
  function pipe(bytes, stream){ return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer(); }
  D.makeLink = function(){
    var base = /^https?:$/.test(location.protocol) ? location.origin + location.pathname : ONLINE;
    var json = new TextEncoder().encode(JSON.stringify(D.fileData()));
    if(!window.CompressionStream) return Promise.resolve(base + '#w=0.' + toB64(json));
    return pipe(json, new CompressionStream('deflate-raw')).then(function(z){ return base + '#w=1.' + toB64(new Uint8Array(z)); });
  };
  function readLink(hash){
    var m = /^#w=([01])\.([A-Za-z0-9_-]+)$/.exec(hash);
    if(!m) return Promise.reject(new Error('bad'));
    var bytes; try{ bytes = fromB64(m[2]); }catch(e){ return Promise.reject(new Error('bad')); }  // not valid base64
    var text = m[1] === '0' ? Promise.resolve(bytes) : window.DecompressionStream ? pipe(bytes, new DecompressionStream('deflate-raw')) : Promise.reject(new Error('old'));
    return text.then(function(b){ return JSON.parse(new TextDecoder().decode(b)); });
  }
  function copyText(t){
    if(navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t).catch(function(){ return fallbackCopy(t); });
    return fallbackCopy(t);
  }
  function fallbackCopy(t){
    var ta = document.createElement('textarea'); ta.value = t; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var ok = false; try{ ok = document.execCommand('copy'); }catch(e){}
    ta.remove();
    return ok ? Promise.resolve() : Promise.reject(new Error('copy'));
  }
  document.getElementById('link').addEventListener('click', function(){
    D.makeLink().then(function(url){
      return copyText(url).catch(function(){ D.popup('Couldn’t copy the link', 'Copy it from here instead: ' + url); });
    });
  });
  // Opening a link (on start-up, or when a new link is pasted into this tab): load it like opening a file, then tidy the
  // address so a reload doesn't load it again.
  D.openFromLink = function(){
    if(location.hash.indexOf('#w=') !== 0) return;
    var hash = location.hash;
    history.replaceState(null, '', location.pathname + location.search);
    readLink(hash).then(function(o){
      var st = D.fromFile(o);
      if(!st) throw new Error('bad');
      if(!st.name) st.name = 'Shared wave';
      afterAsking('open the shared wave “' + st.name + '”', function(saved){
        var r = D.loadWave(st);
        D.save(); D.render(); nameIn.value = D.state.name || ''; D.showUnsaved(); D.resetHistory();
        var warn = (r.adjusted ? 'Some values were adjusted to fit the editor’s rules. ' : '') +
          (r.newer ? 'It was made with a newer version of this page, so some parts may be missing.' : '');
        if(warn) D.popup('Opened “' + D.state.name + '”', warn.trim());
      });
    }).catch(function(e){
      D.popup('That link couldn’t be opened', e.message === 'old' ? 'This browser is too old to open compressed share links; try an up-to-date Chrome, Edge, Firefox or Safari.'
        : 'It doesn’t contain a wave this page can open, so nothing changed.');
    });
  };
  window.addEventListener('hashchange', D.openFromLink);

  // Drag and drop a file anywhere on the page.
  function hasFiles(e){ return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0; }
  window.addEventListener('dragover', function(e){ if(hasFiles(e)){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', function(e){
    if(!hasFiles(e)) return;
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
  });
})(window.Dial = window.Dial || {});
