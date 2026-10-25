// Undo and redo (Ctrl+Z, and Ctrl+Y or Ctrl+Shift+Z; ⌘ on a Mac), plus Undo and Redo buttons. A burst of changes counts as
// one step: a step is recorded once nothing has changed for half a second and no mouse button or finger is held down, so
// a whole drag or a typed number undoes in one go. Opening a wave or starting a new one starts a fresh history.
(function(D){
  var LIMIT = 200, undos = [], redos = [], current = null, timer = null, held = false;
  var undoBtn = document.getElementById('undo'), redoBtn = document.getElementById('redo');

  // The wave as text, without the record of how it was last saved, so undoing back to the saved wave clears the *.
  function snap(){ var s = JSON.parse(JSON.stringify(D.state)); delete s.savedAs; return JSON.stringify(s); }
  function showButtons(){ undoBtn.disabled = !undos.length; redoBtn.disabled = !redos.length; }

  function commit(){
    clearTimeout(timer); timer = null;
    var now = snap();
    if(now === current) return;
    undos.push(current); if(undos.length > LIMIT) undos.shift();
    redos = []; current = now;
    showButtons();
  }
  D.noteChange = function(){
    if(current === null) return;  // not started yet
    clearTimeout(timer);
    timer = setTimeout(function(){ if(!held) commit(); }, 500);
  };
  document.addEventListener('pointerdown', function(){ held = true; }, true);
  function release(){ held = false; if(timer) commit(); }
  document.addEventListener('pointerup', release, true);
  document.addEventListener('pointercancel', release, true);

  D.resetHistory = function(){ clearTimeout(timer); timer = null; undos = []; redos = []; current = snap(); showButtons(); };

  function restore(json){
    var s = JSON.parse(json);
    s.savedAs = D.state.savedAs;
    D.state = s; current = json;
    D.save(); D.render(); D.initFiles();
    showButtons();
  }
  D.undo = function(){ if(timer) commit(); if(!undos.length) return; redos.push(current); restore(undos.pop()); };
  D.redo = function(){ if(timer) commit(); if(!redos.length) return; undos.push(current); restore(redos.pop()); };
  undoBtn.addEventListener('click', D.undo);
  redoBtn.addEventListener('click', D.redo);

  // Inside a text or number box, Ctrl+Z is left to the browser so it undoes typing there as usual.
  function textEntry(t){
    return t && (t.tagName === 'TEXTAREA' || t.isContentEditable || (t.tagName === 'INPUT' && /^(text|number|search)$/.test(t.type)));
  }
  window.addEventListener('keydown', function(e){
    if(!(e.ctrlKey || e.metaKey) || e.altKey) return;
    var k = e.key.toLowerCase();
    if((k !== 'z' && k !== 'y') || textEntry(e.target) || document.getElementById('ask').open) return;
    e.preventDefault();
    if(k === 'y' || e.shiftKey) D.redo(); else D.undo();
  });
})(window.Dial = window.Dial || {});
