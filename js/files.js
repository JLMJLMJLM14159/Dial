// Saving and opening wave files (name.dial.json), so waves can be kept and shared. Files open with the Open wave button
// or by dropping one anywhere on the page.
(function(D){
  var nameIn = document.getElementById('wave-name'), picker = document.getElementById('wave-file');
  var status = document.getElementById('filestatus');

  D.showName = function(){ nameIn.value = D.state.name || ''; };
  nameIn.addEventListener('input', function(){ D.state.name = nameIn.value; D.save(); });

  // A name that is safe as a file name on every system.
  function fileName(){
    var n = (D.state.name || '').replace(/[\\/:*?"<>|\u0000-\u001f]+/g, '-').replace(/^[\s.]+|[\s.]+$/g, '');
    return (n || 'my-wave') + '.dial.json';
  }
  document.getElementById('save').addEventListener('click', function(){
    var a = document.createElement('a'), name = fileName();
    a.href = URL.createObjectURL(new Blob([JSON.stringify(D.fileData(), null, 2) + '\n'], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
    status.textContent = 'Saved as ' + name + '.';
  });

  function openFile(file){
    if(!file) return;
    file.text().then(function(txt){
      var o = null;
      try{ o = JSON.parse(txt); }catch(e){}
      var st = o && D.fromFile(o);
      if(!st){ status.textContent = file.name + ' isn’t a saved wave, so nothing was opened.'; return; }
      if(!st.name) st.name = file.name.replace(/(\.dial)?\.json$/i, '');
      if(!window.confirm('Open “' + st.name + '”? It replaces the wave you have now.')) return;
      var r = D.loadWave(st);
      D.save(); D.render(); D.showName();
      status.textContent = 'Opened “' + D.state.name + '”.' +
        (r.adjusted ? ' Some values were adjusted to fit the editor’s rules.' : '') +
        (r.newer ? ' It was saved by a newer version of this page, so some parts may be missing.' : '');
    }, function(){ status.textContent = 'That file couldn’t be read.'; });
  }
  document.getElementById('open').addEventListener('click', function(){ picker.click(); });
  picker.addEventListener('change', function(){ openFile(picker.files[0]); picker.value = ''; });

  // Drag and drop a file anywhere on the page.
  function hasFiles(e){ return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') >= 0; }
  window.addEventListener('dragover', function(e){ if(hasFiles(e)){ e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
  window.addEventListener('drop', function(e){
    if(!hasFiles(e)) return;
    e.preventDefault();
    openFile(e.dataTransfer.files[0]);
  });
})(window.Dial = window.Dial || {});
