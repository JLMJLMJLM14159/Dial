// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright © 2026 JLMJLMJLM14159
// Start-up: expose the values for other code, restore saved state and draw the page.
(function(D){
  window.getDialValues = D.snapshot;
  D.load();
  D.render();
  D.initFiles();
  D.resetHistory();
  D.openFromLink();  // a share link in the address

  // Offline support and installing as an app. These need the page to be served (as on GitHub Pages); a copy opened
  // straight from disk works offline anyway.
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)){
    var m = document.createElement('link'); m.rel = 'manifest'; m.href = 'manifest.webmanifest'; document.head.appendChild(m);
    navigator.serviceWorker.register('sw.js').catch(function(){});
  }
})(window.Dial = window.Dial || {});
