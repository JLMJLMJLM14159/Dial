// Reference trace: a WAV or another saved wave, drawn faintly behind the curves (stretched across one cycle) so a shape
// can be traced with sections. It's only a guide: kept in this browser, never part of the wave or its files.
(function(D){
  var KEY = 'dial-ref-v1', N = 1024, MAX = 4096;  // a WAV must be one cycle: at most 4096 samples (2048 is the usual size)
  var pick = document.getElementById('ref-file'), clearBtn = document.getElementById('ref-clear'), status = document.getElementById('filestatus');
  D.reference = null;  // { name, ys: heights across one cycle }
  try{ var r = JSON.parse(localStorage.getItem(KEY)); if(r && Array.isArray(r.ys) && r.ys.length > 1) D.reference = r; }catch(e){}

  function show(){ clearBtn.hidden = !D.reference; clearBtn.title = D.reference ? 'Clear the reference (' + D.reference.name + ')' : ''; D.drawPreview(); }
  function set(name, ys){
    D.reference = { name: name, ys: Array.prototype.map.call(ys, function(v){ return Math.round(v * 10000) / 10000; }) };
    try{ localStorage.setItem(KEY, JSON.stringify(D.reference)); }catch(e){}
    show();
  }
  // How many samples a WAV holds, read from its own header (so the file's sample rate doesn't matter): the data chunk's
  // size divided by the bytes per sample frame. Returns null if it isn't a WAV.
  function wavFrames(buf){
    var v = new DataView(buf), tag = function(o){ return String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3)); };
    if(buf.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') return null;
    var align = 0;
    for(var o = 12; o + 8 <= buf.byteLength; o += 8 + v.getUint32(o + 4, true) + (v.getUint32(o + 4, true) & 1)){
      if(tag(o) === 'fmt ') align = v.getUint16(o + 20, true);
      else if(tag(o) === 'data') return align ? Math.floor(v.getUint32(o + 4, true) / align) : null;
    }
    return null;
  }
  var notice = document.getElementById('notice'), noticeText = document.getElementById('notice-text');
  function popup(msg){ noticeText.textContent = msg; if(notice.showModal) notice.showModal(); else window.alert(msg); }
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
      var frames = wavFrames(buf);
      if(frames === null) throw new Error('not');
      if(frames > MAX){
        popup(name + ' is ' + frames.toLocaleString() + ' samples long, which is more than one cycle. A reference WAV must be a single cycle of at most ' + MAX.toLocaleString() + ' samples (2,048 is the usual size). Please shorten it to one cycle first, for example in an audio editor, then load it again.');
        status.textContent = '';
        return;
      }
      return new OfflineAudioContext(1, 1, 44100).decodeAudioData(buf).then(function(audio){
        set(name, resample(audio.getChannelData(0)));
        status.textContent = 'Reference: ' + name + ' (' + frames.toLocaleString() + ' samples). Trace over the faint shape; × clears it.';
      });
    }).catch(function(){ status.textContent = name + ' couldn’t be used as a reference. Use a single-cycle WAV file or a saved wave (.dial.json).'; });
  });
  clearBtn.addEventListener('click', function(){
    D.reference = null;
    try{ localStorage.removeItem(KEY); }catch(e){}
    status.textContent = ''; show();
  });
  clearBtn.hidden = !D.reference;  // the preview draws it once the wave is loaded
})(window.Dial = window.Dial || {});
