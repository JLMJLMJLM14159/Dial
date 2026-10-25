// Saving and opening wave files (name.dial.json), so waves can be kept and shared. Files open with the Open wave button
// or by dropping one anywhere on the page. Tracks unsaved changes: a * in the tab title, and a "save first?" question
// before anything replaces a wave that has changes.
(function(D){
  var nameIn = document.getElementById('wave-name'), picker = document.getElementById('wave-file');
  var status = document.getElementById('filestatus'), unsavedEl = document.getElementById('unsaved');
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
  document.getElementById('save').addEventListener('click', function(){ status.textContent = 'Saved as ' + saveWave() + '.'; });

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
      if(!st){ status.textContent = file.name + ' isn’t a saved wave, so nothing was opened.'; return; }
      if(!st.name) st.name = file.name.replace(/(\.dial)?\.json$/i, '');
      afterAsking('open “' + st.name + '”', function(saved){
        var r = D.loadWave(st);
        D.save(); D.render(); nameIn.value = D.state.name || ''; D.showUnsaved(); D.resetHistory();
        status.textContent = 'Opened “' + D.state.name + '”.' + saved +
          (r.adjusted ? ' Some values were adjusted to fit the editor’s rules.' : '') +
          (r.newer ? ' It was saved by a newer version of this page, so some parts may be missing.' : '');
      });
    }, function(){ status.textContent = 'That file couldn’t be read.'; });
  }
  document.getElementById('open').addEventListener('click', function(){ picker.click(); });
  picker.addEventListener('change', function(){ openFile(picker.files[0]); picker.value = ''; });

  document.getElementById('new').addEventListener('click', function(){
    afterAsking('start a new wave', function(saved){
      D.state = D.newState();
      D.state.sections.push(D.blank());
      D.render(); nameIn.value = ''; markSaved(); D.resetHistory();
      status.textContent = 'Started a new wave.' + saved;
    });
  });

  // Drag and drop a file anywhere on the page.
  function hasFiles(e){ return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0; }
  window.addEventListener('dragover', function(e){ if(hasFiles(e)){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', function(e){
    if(!hasFiles(e)) return;
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
  });
})(window.Dial = window.Dial || {});
