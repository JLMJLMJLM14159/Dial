// Start-up: expose the values for other code, restore saved state and draw the page.
(function(D){
  window.getDialValues = D.snapshot;
  D.load();
  D.render();
  D.initFiles();
  D.resetHistory();
})(window.Dial = window.Dial || {});
