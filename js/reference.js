// Reference trace: a WAV or another saved wave, drawn faintly behind the curves (stretched across one cycle) so a shape
// can be traced with sections. It's only a guide: kept in this browser, never part of the wave or its files.
(function(D){
  var KEY = 'dial-ref-v1', N = 1024;
  var pick = document.getElementById('ref-file'), clearBtn = document.getElementById('ref-clear'), status = document.getElementById('filestatus');
  D.reference = null;  // { name, ys: heights across one cycle }
  try{ var r = JSON.parse(localStorage.getItem(KEY)); if(r && Array.isArray(r.ys) && r.ys.length > 1) D.reference = r; }catch(e){}

  function show(){ clearBtn.hidden = !D.reference; clearBtn.title = D.reference ? 'Clear the reference (' + D.reference.name + ')' : ''; D.drawPreview(); }
  function set(name, ys){
    D.reference = { name: name, ys: Array.prototype.map.call(ys, function(v){ return Math.round(v * 10000) / 10000; }) };
    try{ localStorage.setItem(KEY, JSON.stringify(D.reference)); }catch(e){}
    show();
  }
  // Squeeze any number of samples into N points (linear interpolation).
  function resample(data){
    var out = new Float32Array(N), n = data.length;
    for(var k = 0; k < N; k++){ var x = k / N * n, i = Math.floor(x), f = x - i; out[k] = data[Math.min(i, n - 1)] * (1 - f) + data[Math.min(i + 1, n - 1)] * f; }
    return out;
  }
  // Another saved wave: sample it the same way the editor samples its own wave, without touching the current one.
  function fromWave(o){
    var st = D.fromFile(o); if(!st) return null;
    var keep = D.state; D.state = st;
    try{ D.refitAll(); return D.sampleCycle(N); } finally { D.state = keep; }
  }
  document.getElementById('ref-btn').addEventListener('click', function(){ pick.click(); });
  pick.addEventListener('change', function(){
    var file = pick.files[0]; pick.value = '';
    if(!file) return;
    var name = file.name;
    file.arrayBuffer().then(function(buf){
      if(/\.json$/i.test(name)){
        var o = null; try{ o = JSON.parse(new TextDecoder().decode(buf)); }catch(e){}
        var ys = o && fromWave(o);
        if(!ys) throw new Error('not');
        set(name, ys); status.textContent = 'Reference: ' + name + '. Trace over the faint shape; × clears it.';
        return;
      }
      return new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf).then(function(audio){
        set(name, resample(audio.getChannelData(0)));
        status.textContent = 'Reference: ' + name + (audio.duration > 0.1 ? ' (the whole ' + audio.duration.toFixed(2) + ' s file is stretched across one cycle; single-cycle WAVs work best)' : '') + '. × clears it.';
      });
    }).catch(function(){ status.textContent = name + ' couldn’t be used as a reference. Try a WAV file or a saved wave (.dial.json).'; });
  });
  clearBtn.addEventListener('click', function(){
    D.reference = null;
    try{ localStorage.removeItem(KEY); }catch(e){}
    status.textContent = ''; show();
  });
  clearBtn.hidden = !D.reference;  // the preview draws it once the wave is loaded
})(window.Dial = window.Dial || {});
