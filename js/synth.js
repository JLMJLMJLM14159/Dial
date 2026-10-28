// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright © 2026 JLMJLMJLM14159
// Synth: plays the line as a repeating wave through the browser's built-in oscillator, from the Play button, the computer
// keyboard or a MIDI keyboard, and downloads one cycle as a WAV file.
(function(D){
  var N = 2048;  // samples per cycle, the usual size for single-cycle waves
  var ctx = null, master = null, wave = null, dirty = true, pending = false, voices = {}, octave = 4;
  var SKEY = 'dial-synth-v1', prefs = { freq: 220, vol: 50, len: 2 };
  try{ var p = JSON.parse(localStorage.getItem(SKEY)); if(p && p.freq > 0 && p.vol >= 0) prefs = p; }catch(e){}
  if(!(prefs.len > 0)) prefs.len = 2;
  function savePrefs(){ try{ localStorage.setItem(SKEY, JSON.stringify(prefs)); }catch(e){} }

  var playBtn = document.getElementById('play');
  var freqR = document.getElementById('freq-r'), freqN = document.getElementById('freq-n'), noteName = document.getElementById('notename');
  var volR = document.getElementById('vol-r'), volN = document.getElementById('vol-n');
  var octEl = document.getElementById('oct'), midiBtn = document.getElementById('midi'), midiStatus = document.getElementById('midistatus');
  var lenN = document.getElementById('len-n'), noteBtn = document.getElementById('notewav');

  var NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
  function mtof(m){ return 440 * Math.pow(2, (m - 69) / 12); }
  function noteOf(m){ return NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1); }
  // The frequency slider is spaced like a piano, 20 Hz to 2000 Hz: every octave is the same width.
  function sliderToFreq(v){ return 20 * Math.pow(100, v / 1000); }
  function freqToSlider(f){ return 1000 * Math.log(f / 20) / Math.log(100); }
  function volGain(){ return Math.pow(prefs.vol / 100, 2); }  // squared, so the slider feels even to the ear

  function ensureCtx(){
    if(!ctx){
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = volGain();
      // A limiter, so several notes at once can't clip.
      var lim = ctx.createDynamicsCompressor();
      lim.threshold.value = -3; lim.knee.value = 0; lim.ratio.value = 20; lim.attack.value = 0.003; lim.release.value = 0.1;
      master.connect(lim); lim.connect(ctx.destination);
    }
    if(ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  // In-place radix-2 FFT of re/im (length a power of two).
  function fft(re, im){
    var n = re.length, i, j, k, len, t;
    for(i = 1, j = 0; i < n; i++){
      for(k = n >> 1; j & k; k >>= 1) j ^= k;
      j ^= k;
      if(i < j){ t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for(len = 2; len <= n; len <<= 1){
      var ang = -2 * Math.PI / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for(i = 0; i < n; i += len){
        var cr = 1, ci = 0;
        for(j = 0; j < len / 2; j++){
          var a = i + j, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
  }
  // The oscillator wants the wave as amounts of each harmonic (cos and sin parts), which an FFT of one cycle gives.
  // The browser then leaves out harmonics too high to play at each pitch, so sharp jumps don't buzz. The average height
  // (the off-centre part) is dropped, and the real size is kept rather than made louder.
  function buildWave(c){
    var y = D.sampleCycle(N), re = new Float64Array(N), im = new Float64Array(N), H = N / 2;
    re.set(y); fft(re, im);
    var real = new Float32Array(H), imag = new Float32Array(H);
    for(var k = 1; k < H; k++){ real[k] = 2 * re[k] / N; imag[k] = -2 * im[k] / N; }
    return c.createPeriodicWave(real, imag, { disableNormalization: true });
  }
  function getWave(){
    if(!wave || dirty){ wave = buildWave(ctx); dirty = false; }
    return wave;
  }
  // Edits update notes that are already sounding, at most once per frame.
  D.waveChanged = function(){
    dirty = true;
    if(!ctx || pending || !Object.keys(voices).length) return;
    pending = true;
    requestAnimationFrame(function(){
      pending = false;
      var w = getWave();
      Object.keys(voices).forEach(function(id){ voices[id].osc.setPeriodicWave(w); });
    });
  };

  // Each sounding note is its own oscillator, faded in and out quickly so it doesn't click. Notes played from keys
  // (computer, on-screen or MIDI) remember their MIDI note number, so the on-screen piano can light them up; they follow
  // the pitch-bend wheel and the sustain pedal. The Play button's note does neither.
  var sustain = false, bend = 0;  // bend in cents
  function startVoice(id, freq, level, note){
    if(voices[id]){ if(!voices[id].sustained) return; endVoice(id); }  // pressing a sustained note again restarts it
    ensureCtx();
    var now = ctx.currentTime, osc = ctx.createOscillator(), g = ctx.createGain();
    osc.setPeriodicWave(getWave()); osc.frequency.value = freq;
    if(id !== 'play') osc.detune.value = bend;
    g.gain.value = 0; g.gain.setTargetAtTime(0.5 * level, now, 0.005);
    osc.connect(g); g.connect(master); osc.start(now);
    voices[id] = { osc: osc, g: g, note: note };
    notesChanged();
  }
  function endVoice(id){
    var v = voices[id]; if(!v) return;
    delete voices[id];
    var now = ctx.currentTime;
    v.g.gain.cancelScheduledValues(now); v.g.gain.setTargetAtTime(0, now, 0.02); v.osc.stop(now + 0.25);
    notesChanged();
  }
  // Letting go of a key: with the sustain pedal down, the note keeps sounding until the pedal comes up.
  function stopVoice(id){
    var v = voices[id]; if(!v) return;
    if(sustain && id !== 'play'){ v.sustained = true; return; }
    endVoice(id);
  }
  function setSustain(on){
    sustain = on;
    if(!on) Object.keys(voices).forEach(function(id){ if(voices[id].sustained) endVoice(id); });
  }
  function setBend(cents){
    bend = cents;
    if(!ctx) return;
    Object.keys(voices).forEach(function(id){ if(id !== 'play') voices[id].osc.detune.setTargetAtTime(cents, ctx.currentTime, 0.005); });
  }
  function notesChanged(){ if(D.showPianoNotes) D.showPianoNotes(Object.keys(voices).map(function(id){ return voices[id].note; })); }

  // Play button and frequency: a held note at the chosen frequency, whose pitch follows the frequency as it changes.
  function setPlaying(on){ playBtn.textContent = on ? 'Stop' : 'Play'; playBtn.setAttribute('aria-pressed', on ? 'true' : 'false'); }
  function togglePlay(){
    if(voices.play){ stopVoice('play'); setPlaying(false); }
    else{ startVoice('play', prefs.freq, 1); setPlaying(true); }
  }
  playBtn.addEventListener('click', togglePlay);
  // Space starts and stops playing, like a DAW's transport, except while typing in a box or choosing from a menu. It
  // also takes over from a focused button (which Space would otherwise press); Enter still presses buttons.
  function spaceIsFree(e){
    var t = e.target;
    if(document.querySelector('dialog[open]') || t.isContentEditable || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT') return false;
    return !(t.tagName === 'INPUT' && /^(text|number|search)$/.test(t.type));
  }
  window.addEventListener('keydown', function(e){
    if(e.code !== 'Space' || e.ctrlKey || e.metaKey || e.altKey || !spaceIsFree(e)) return;
    e.preventDefault();
    if(!e.repeat) togglePlay();
  });
  window.addEventListener('keyup', function(e){ if(e.code === 'Space' && spaceIsFree(e)) e.preventDefault(); });
  function setFreq(f, from){
    prefs.freq = Math.round(Math.min(20000, Math.max(20, f)) * 100) / 100;
    if(from !== freqR) freqR.value = freqToSlider(Math.min(2000, prefs.freq));
    if(from !== freqN) freqN.value = prefs.freq;
    noteName.textContent = noteOf(Math.round(69 + 12 * Math.log2(prefs.freq / 440)));
    if(voices.play) voices.play.osc.frequency.setTargetAtTime(prefs.freq, ctx.currentTime, 0.01);
    savePrefs();
  }
  freqR.addEventListener('input', function(){ setFreq(sliderToFreq(+freqR.value), freqR); });
  freqN.addEventListener('input', function(){ var v = parseFloat(freqN.value); if(v > 0) setFreq(v, freqN); });
  freqN.addEventListener('change', function(){ freqN.value = prefs.freq; });
  function setVol(v, from){
    prefs.vol = Math.round(Math.min(100, Math.max(0, v)));
    if(from !== volR) volR.value = prefs.vol;
    if(from !== volN) volN.value = prefs.vol;
    if(master) master.gain.setTargetAtTime(volGain(), ctx.currentTime, 0.01);
    savePrefs();
  }
  volR.addEventListener('input', function(){ setVol(+volR.value, volR); });
  volN.addEventListener('input', function(){ var v = parseFloat(volN.value); if(!isNaN(v)) setVol(v, volN); });
  volN.addEventListener('change', function(){ volN.value = prefs.vol; });

  // Computer keyboard, laid out like piano keys (the usual DAW layout): A is C, W is C♯, S is D, and so on up to ; (E an
  // octave up). Z and X move down and up an octave. Keys are read by position, so other keyboard layouts work the same.
  var KEYS = { KeyA:0, KeyW:1, KeyS:2, KeyE:3, KeyD:4, KeyF:5, KeyT:6, KeyG:7, KeyY:8, KeyH:9, KeyU:10, KeyJ:11, KeyK:12, KeyO:13, KeyL:14, KeyP:15, Semicolon:16 };
  function typing(e){ var t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'SELECT' || t.tagName === 'TEXTAREA' || t.isContentEditable); }
  window.addEventListener('keydown', function(e){
    if(e.repeat || e.ctrlKey || e.metaKey || e.altKey || typing(e)) return;
    if(e.code === 'KeyZ' || e.code === 'KeyX'){
      octave = Math.min(8, Math.max(0, octave + (e.code === 'KeyX' ? 1 : -1)));
      setOctave(octave); e.preventDefault(); return;
    }
    if(!(e.code in KEYS)) return;
    var m = 12 * (octave + 1) + KEYS[e.code];
    startVoice('k' + e.code, mtof(m), 1, m);
    e.preventDefault();
  });
  window.addEventListener('keyup', function(e){ if(e.code in KEYS) stopVoice('k' + e.code); });
  window.addEventListener('blur', function(){ sustain = false; Object.keys(voices).forEach(function(id){ if(id !== 'play') endVoice(id); }); });

  // On-screen piano: two octaves from the current octave (the same one Z and X move), played by pressing, tapping or
  // sliding across the keys. Keys light up while their note sounds, whatever is playing it.
  var piano = document.getElementById('piano'), pianoOct = document.getElementById('piano-oct'), pianoKeys = {}, pointers = {};
  var BLACK = { 1: 1, 3: 1, 6: 1, 8: 1, 10: 1 };
  function buildPiano(){
    var lo = 12 * (octave + 1), whites = 0, html = '', i;
    for(i = 0; i <= 24; i++) if(!BLACK[i % 12]) whites++;
    var ww = 100 / whites, wi = 0;
    for(i = 0; i <= 24; i++){
      var m = lo + i, black = BLACK[i % 12], label = i % 12 === 0 ? noteOf(m) : '';
      if(black) html += '<div class="pkey black" data-m="' + m + '" style="left:' + (wi * ww - ww * 0.3) + '%;width:' + (ww * 0.6) + '%" aria-label="' + noteOf(m) + '"></div>';
      else { html += '<div class="pkey white" data-m="' + m + '" style="left:' + (wi * ww) + '%;width:' + ww + '%" aria-label="' + noteOf(m) + '"><span>' + label + '</span></div>'; wi++; }
    }
    piano.innerHTML = html;
    pianoKeys = {};
    piano.querySelectorAll('.pkey').forEach(function(k){ pianoKeys[k.dataset.m] = k; });
    pianoOct.textContent = noteOf(lo) + '–' + noteOf(lo + 24);
    notesChanged();
  }
  D.showPianoNotes = function(notes){
    Object.keys(pianoKeys).forEach(function(m){ pianoKeys[m].classList.toggle('on', notes.indexOf(+m) >= 0); });
  };
  function setOctave(o){ octave = Math.min(7, Math.max(0, o)); octEl.textContent = 'C' + octave; buildPiano(); }
  document.getElementById('oct-down').addEventListener('click', function(){ setOctave(octave - 1); });
  document.getElementById('oct-up').addEventListener('click', function(){ setOctave(octave + 1); });
  function keyAt(e){ var el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest && el.closest('.pkey'); }
  function pianoPress(e, k){
    var id = 'p' + e.pointerId, prev = pointers[e.pointerId];
    if(prev === (k && k.dataset.m)) return;
    if(prev) stopVoice(id);
    pointers[e.pointerId] = k ? k.dataset.m : null;
    if(k) startVoice(id, mtof(+k.dataset.m), 1, +k.dataset.m);
  }
  piano.addEventListener('pointerdown', function(e){ e.preventDefault(); pianoPress(e, keyAt(e)); });
  piano.addEventListener('pointermove', function(e){ if(e.pointerId in pointers) pianoPress(e, keyAt(e)); });  // slide across keys
  function pianoUp(e){ if(!(e.pointerId in pointers)) return; if(pointers[e.pointerId]) stopVoice('p' + e.pointerId); delete pointers[e.pointerId]; }
  ['pointerup', 'pointercancel'].forEach(function(t){ window.addEventListener(t, pianoUp); });
  piano.addEventListener('pointerleave', function(e){ if(e.pointerType === 'mouse') pianoUp(e); });

  // MIDI keyboards: note on starts a note (how hard it's pressed sets how loud), note off stops it, the sustain pedal
  // (controller 64) holds notes, and the pitch-bend wheel bends every key-played note by up to 2 semitones either way.
  // All channels are played.
  function onMidi(e){
    var d = e.data, cmd = d[0] & 0xf0;
    if(cmd === 0x90 && d[2] > 0) startVoice('m' + d[1], mtof(d[1]), d[2] / 127, d[1]);
    else if(cmd === 0x80 || (cmd === 0x90 && d[2] === 0)) stopVoice('m' + d[1]);
    else if(cmd === 0xB0 && d[1] === 64) setSustain(d[2] >= 64);
    else if(cmd === 0xE0) setBend((((d[2] << 7) | d[1]) - 8192) / 8192 * 200);
  }
  midiBtn.addEventListener('click', function(){
    ensureCtx();  // the click also lets the page make sound
    if(!navigator.requestMIDIAccess){ D.popup('MIDI isn’t available', 'This browser doesn’t support MIDI keyboards. Try Chrome, Edge or Firefox.'); return; }
    midiStatus.textContent = 'Connecting…';
    navigator.requestMIDIAccess().then(function(m){
      function bind(){
        var names = [];
        m.inputs.forEach(function(inp){ inp.onmidimessage = onMidi; names.push(inp.name); });
        midiStatus.textContent = names.length ? 'MIDI: ' + names.join(', ') : 'No MIDI keyboard found (plug one in and it connects by itself)';  // the connection's state, not a message
      }
      bind(); m.onstatechange = bind;
    }, function(){ midiStatus.textContent = ''; D.popup('MIDI access was blocked', 'Allow MIDI in the browser’s site settings, then press Connect MIDI again.'); });
  });

  // One cycle as a 24-bit mono WAV, 2048 samples, exactly as drawn (not centred), for loading into a wavetable synth or sampler.
  function wavBlob(y, rate){
    var n = y.length, buf = new ArrayBuffer(44 + n * 3), v = new DataView(buf), o = 0;
    function str(s){ for(var i = 0; i < s.length; i++) v.setUint8(o++, s.charCodeAt(i)); }
    function u32(x){ v.setUint32(o, x, true); o += 4; }
    function u16(x){ v.setUint16(o, x, true); o += 2; }
    str('RIFF'); u32(36 + n * 3); str('WAVE');
    str('fmt '); u32(16); u16(1); u16(1); u32(rate); u32(rate * 3); u16(3); u16(24);
    str('data'); u32(n * 3);
    for(var i = 0; i < n; i++){
      var s = Math.max(-8388608, Math.min(8388607, Math.round(y[i] * 8388607)));
      v.setUint8(o++, s & 255); v.setUint8(o++, (s >> 8) & 255); v.setUint8(o++, (s >> 16) & 255);
    }
    return new Blob([buf], { type: 'audio/wav' });
  }
  document.getElementById('wav').addEventListener('click', function(){
    var a = document.createElement('a');
    a.href = URL.createObjectURL(wavBlob(D.sampleCycle(N), 44100));
    a.download = 'dial-cycle.wav';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
  });

  // A held note as a WAV: the note at the current frequency for the chosen number of seconds, played through the same
  // oscillator (so centred and smoothed the same way) but rendered straight to a file. It fades in and out over 5 ms so the
  // clip doesn't click, ignores the volume slider, and is turned down only if its peak would go past full scale.
  var LEN_MAX = 60;
  lenN.value = prefs.len;
  lenN.addEventListener('input', function(){
    var v = parseFloat(lenN.value);
    if(v > 0){ prefs.len = Math.min(LEN_MAX, v); savePrefs(); }
  });
  lenN.addEventListener('change', function(){ lenN.value = prefs.len; });
  function renderNote(freq, secs, rate){
    var n = Math.max(2, Math.round(secs * rate)), c = new OfflineAudioContext(1, n, rate), dur = (n - 1) / rate;  // dur: time of the last sample
    var osc = c.createOscillator(), g = c.createGain(), fade = Math.min(0.005, dur / 2);
    osc.setPeriodicWave(buildWave(c)); osc.frequency.value = freq;
    g.gain.setValueAtTime(0, 0); g.gain.linearRampToValueAtTime(1, fade);
    g.gain.setValueAtTime(1, dur - fade); g.gain.linearRampToValueAtTime(0, dur);
    osc.connect(g); g.connect(c.destination); osc.start(0);
    return c.startRendering().then(function(buf){
      var y = buf.getChannelData(0), peak = 0, i;
      for(i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
      if(peak > 1) for(i = 0; i < y.length; i++) y[i] /= peak;
      return { y: y, peak: peak };
    });
  }
  noteBtn.addEventListener('click', function(){
    var freq = prefs.freq, secs = prefs.len;
    renderNote(freq, secs, 44100).then(function(r){
      var a = document.createElement('a');
      a.href = URL.createObjectURL(wavBlob(r.y, 44100));
      a.download = 'dial-note-' + noteOf(Math.round(69 + 12 * Math.log2(freq / 440))).replace('♯', 's') + '-' + freq + 'Hz-' + secs + 's.wav';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(function(){ URL.revokeObjectURL(a.href); }, 1000);
      if(r.peak > 1) D.popup('The note was turned down', 'Centred, this wave would go past full scale, so the note was turned down until its loudest point fits in the file.');
    }, function(){ D.popup('The note couldn’t be made', 'This browser couldn’t render the note. Try an up-to-date Chrome, Edge, Firefox or Safari.'); });
  });

  setFreq(prefs.freq); setVol(prefs.vol); buildPiano();
  // For tests and your own code.
  D.fft = fft;
  D.synth = { start: startVoice, stop: stopVoice, onMidi: onMidi, buildWave: buildWave, wavBlob: wavBlob, renderNote: renderNote, playing: function(){ return Object.keys(voices); },
    notes: function(){ return Object.keys(voices).map(function(id){ return voices[id].note; }); }, detunes: function(){ return Object.keys(voices).map(function(id){ return voices[id].osc.detune.value; }); } };
})(window.Dial = window.Dial || {});
