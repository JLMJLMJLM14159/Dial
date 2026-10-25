// Pointer dragging of the dots in the preview. The view is frozen while dragging and re-fits on release.
(function(D){
  var svg = D.svg, drag = null;

  function toData(e){
    var m = svg.getScreenCTM();
    if(!m) return null;
    var pt = svg.createSVGPoint(); pt.x = e.clientX; pt.y = e.clientY;
    var p = pt.matrixTransform(m.inverse());
    return { x: p.x, y: -p.y };
  }
  svg.addEventListener('pointerdown', function(e){
    var t = e.target;
    if(!t.getAttribute || t.getAttribute('data-k') === null) return;
    var i = +t.getAttribute('data-i'), k = t.getAttribute('data-k');
    D.select(i);  // clicking a curve or any of its dots selects that section
    if(k === 'sel'){ e.preventDefault(); return; }
    drag = { i: i, k: k };
    D.frozenVB = svg.getAttribute('viewBox');
    svg.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  svg.addEventListener('pointermove', function(e){
    if(!drag) return;
    var d = toData(e); if(!d) return;
    var g = D.sectionGeo()[drag.i], s = D.state.sections[drag.i];
    if(!g || !s) return;
    var rx = d.x - g.X;
    // A jump's end only moves up and down, a flat section's end only sideways.
    if(drag.k === 'end'){ if(s.type !== 'jump') D.setKey(s, 'length', rx); if(s.type !== 'flat') D.setKey(s, 'ey', d.y); }
    else if(drag.k === 'h1'){ D.setKey(s, 'h1x', rx); D.setKey(s, 'h1y', d.y); }
    else if(drag.k === 'h2'){ D.setKey(s, 'h2x', rx); D.setKey(s, 'h2y', d.y); }
    D.save(); D.renderOut();
  });
  function endDrag(){ if(!drag) return; drag = null; D.frozenVB = null; D.renderOut(); }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
})(window.Dial = window.Dial || {});
