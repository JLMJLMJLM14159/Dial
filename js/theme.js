// Colour theme and light/dark mode, from the two menus at the end of the toolbar. Kept per browser; the saved choice is
// first applied by a small script in the page's <head>, before anything is drawn.
(function(D){
  var KEY = 'dial-theme-v1', root = document.documentElement, meta = document.querySelector('meta[name=theme-color]');
  var pal = document.getElementById('theme-pal'), mode = document.getElementById('theme-mode');
  var t = { pal: 'teal', mode: 'auto' };
  try{ var s = JSON.parse(localStorage.getItem(KEY)); if(s){ if(pal.querySelector('option[value="' + s.pal + '"]')) t.pal = s.pal; if(/^(auto|light|dark)$/.test(s.mode)) t.mode = s.mode; } }catch(e){}

  function apply(){
    if(t.pal === 'teal') root.removeAttribute('data-pal'); else root.setAttribute('data-pal', t.pal);
    if(t.mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', t.mode);
    pal.value = t.pal; mode.value = t.mode;
    if(meta) meta.setAttribute('content', getComputedStyle(root).getPropertyValue('--surface').trim());  // the phone's top bar
  }
  function change(){ t.pal = pal.value; t.mode = mode.value; try{ localStorage.setItem(KEY, JSON.stringify(t)); }catch(e){} apply(); }
  pal.addEventListener('change', change);
  mode.addEventListener('change', change);
  // In Auto, follow the device switching between light and dark.
  if(window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', apply);
  apply();
})(window.Dial = window.Dial || {});
