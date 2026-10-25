// Harmonics view: a column chart of how strong each of the first 32 harmonics of the wave is (harmonic n vibrates n times
// per cycle, so at a 220 Hz note the 3rd is at 660 Hz), as a share of the strongest one. It's only for looking: the
// sections stay as they are. Like the synth, it leaves out the average height. Worked out only while its panel is open.
(function(D){
  var H = 32, N = 2048, HEIGHT = 170, PAD = { l: 40, r: 8, t: 10, b: 24 };
  var panel = document.getElementById('panel-harm'), box = document.getElementById('harm-chart'), tip = document.getElementById('harm-tip');
  var table = document.getElementById('harm-table'), tableBtn = document.getElementById('harm-numbers'), freqN = document.getElementById('freq-n');
  var mags = [], pending = false;

  function compute(){
    var y = D.sampleCycle(N), re = new Float64Array(N), im = new Float64Array(N), m = [], max = 0, k;
    re.set(y); D.fft(re, im);
    for(k = 1; k <= H; k++){ m.push(2 * Math.hypot(re[k], im[k]) / N); max = Math.max(max, m[k - 1]); }
    return m.map(function(v){ return max > 1e-9 ? v / max : 0; });
  }
  function pct(v){ var p = v * 100; return (p >= 10 || p === 0 ? Math.round(p) : p < 0.1 ? '<0.1' : p.toFixed(1)) + '%'; }
  function freqOf(n){ var f = parseFloat(freqN.value) || 220; return Math.round(f * n) + ' Hz'; }

  // Columns at most 24px wide with a gap between them, rounded at the top and square at the baseline; hairline gridlines.
  function draw(){
    var w = box.clientWidth; if(!w) return;
    var pw = w - PAD.l - PAD.r, ph = HEIGHT - PAD.t - PAD.b, slot = pw / H, bw = Math.max(1, Math.min(24, slot - 2));
    var base = PAD.t + ph, svg = '';
    [0, 0.5, 1].forEach(function(v){
      var y = base - v * ph;
      svg += '<line x1="' + PAD.l + '" x2="' + (w - PAD.r) + '" y1="' + y + '" y2="' + y + '" stroke="var(--line)" stroke-width="1"/>';
      svg += '<text x="' + (PAD.l - 6) + '" y="' + (y + 4) + '" text-anchor="end" class="harm-axis">' + (v * 100) + '%</text>';
    });
    mags.forEach(function(v, i){
      var h = v * ph, x = PAD.l + i * slot + (slot - bw) / 2, r = Math.min(4, bw / 2, h);
      if(h >= 0.5) svg += '<path d="M' + x + ' ' + base + 'V' + (base - h + r) + 'Q' + x + ' ' + (base - h) + ' ' + (x + r) + ' ' + (base - h) +
        'H' + (x + bw - r) + 'Q' + (x + bw) + ' ' + (base - h) + ' ' + (x + bw) + ' ' + (base - h + r) + 'V' + base + 'Z" fill="var(--accent)"/>';
      if(i === 0 || (i + 1) % 8 === 0) svg += '<text x="' + (PAD.l + (i + 0.5) * slot) + '" y="' + (HEIGHT - 6) + '" text-anchor="middle" class="harm-axis">' + (i + 1) + '</text>';
      svg += '<rect class="harm-hit" x="' + (PAD.l + i * slot) + '" y="' + PAD.t + '" width="' + slot + '" height="' + ph + '" fill="transparent" data-n="' + (i + 1) + '"/>';
    });
    box.innerHTML = '<svg width="' + w + '" height="' + HEIGHT + '" role="img" aria-label="Strength of the first ' + H + ' harmonics; the table below has the numbers">' + svg + '</svg>';
    if(!table.hidden) fillTable();
  }
  function fillTable(){
    table.innerHTML = '<table><thead><tr><th>Harmonic</th><th>Frequency</th><th>Strength</th></tr></thead><tbody>' +
      mags.map(function(v, i){ return '<tr><td>' + (i + 1) + '</td><td>' + freqOf(i + 1) + '</td><td>' + pct(v) + '</td></tr>'; }).join('') + '</tbody></table>';
  }

  D.harmonicsChanged = function(){
    if(!panel.open || pending) return;
    pending = true;
    requestAnimationFrame(function(){ pending = false; mags = compute(); draw(); });
  };
  panel.addEventListener('toggle', D.harmonicsChanged);
  window.addEventListener('resize', function(){ if(panel.open && mags.length) draw(); });
  freqN.addEventListener('input', function(){ if(!table.hidden) fillTable(); });

  // Hover (or touch) a column for its number, frequency at the current pitch, and strength.
  box.addEventListener('pointermove', function(e){
    var n = e.target.getAttribute && e.target.getAttribute('data-n');
    if(!n){ tip.hidden = true; return; }
    var r = e.target.getBoundingClientRect(), wrap = box.getBoundingClientRect();
    tip.textContent = 'Harmonic ' + n + ' · ' + freqOf(+n) + ' · ' + pct(mags[n - 1]) + ' of the strongest';
    tip.hidden = false;
    var left = r.left - wrap.left + r.width / 2 - tip.offsetWidth / 2;
    tip.style.left = Math.max(0, Math.min(wrap.width - tip.offsetWidth, left)) + 'px';
  });
  box.addEventListener('pointerleave', function(){ tip.hidden = true; });
  tableBtn.addEventListener('click', function(){
    table.hidden = !table.hidden;
    tableBtn.textContent = table.hidden ? 'Show numbers' : 'Hide numbers';
    tableBtn.setAttribute('aria-expanded', table.hidden ? 'false' : 'true');
    if(!table.hidden) fillTable();
  });
})(window.Dial = window.Dial || {});
