// SVG preview drawing. D.frozenVB holds the viewBox while a drag is in progress.
(function(D){
  var svg = document.getElementById('preview');
  D.svg = svg;
  D.frozenVB = null;

  // View options, kept per browser: snap to grid, ghost copies of the neighbouring cycles, and the loop arrow.
  var VKEY = 'dial-view-v1';
  D.view = { snap: false, ghosts: true, arrow: true };
  try{ var v = JSON.parse(localStorage.getItem(VKEY)); if(v) ['snap', 'ghosts', 'arrow'].forEach(function(k){ if(typeof v[k] === 'boolean') D.view[k] = v[k]; }); }catch(e){}
  D.saveView = function(){ try{ localStorage.setItem(VKEY, JSON.stringify(D.view)); }catch(e){} };
  D.GRID = { x: 0.25, y: 0.1 };  // snap steps: x across the whole wave, heights from the middle line

  // The path of one section, moved dx along x (for the ghost copies).
  function sectionPath(g, dx, start){
    var P = g.P, s = g.s, d = (start ? 'M' : ' L') + (P[0][0] + dx) + ' ' + (-P[0][1]);
    if(s.type === 'bezier') d += ' C'+(P[1][0]+dx)+' '+(-P[1][1])+' '+(P[2][0]+dx)+' '+(-P[2][1])+' '+(P[3][0]+dx)+' '+(-P[3][1]);
    else if(s.type === 'sine' || s.type === 'curve'){ for(var k = 1; k <= 64; k++) d += ' L'+(g.X + dx + s.length * k / 64)+' '+(-D.shapeY(s, g.Y, k / 64)); }
    else d += ' L'+(P[3][0]+dx)+' '+(-P[3][1]);
    return d;
  }
  // Which way the wave sets off from the start: a short step into the first section that has any length (or straight
  // up or down if it starts with a jump).
  function startDirection(segs){
    for(var i = 0; i < segs.length; i++){
      var g = segs[i], s = g.s, dx, dy;
      if(!(s.length > 0)){ if(s.ey !== g.Y) return [0, s.ey > g.Y ? 1 : -1]; continue; }
      if(s.type === 'bezier'){ var t = 0.01, u = 1 - t;
        dx = 3*u*u*t*s.h1x + 3*u*t*t*s.h2x + t*t*t*s.length; dy = u*u*u*g.Y + 3*u*u*t*s.h1y + 3*u*t*t*s.h2y + t*t*t*s.ey - g.Y; }
      else { dx = s.length * 0.01; dy = D.shapeY(s, g.Y, 0.01) - g.Y; }
      var n = Math.hypot(dx, dy); if(n > 0) return [dx / n, dy / n];
    }
    return [1, 0];
  }

  // The selected section is drawn bold with its handles; the others are faded and their handles hidden. Every curve has
  // a wide invisible outline that selects it when clicked. Hidden handles still count towards the view's size, so the
  // view doesn't jump when the selection changes.
  function drawPreview(){
    var sel = D.selIdx, pick = '', segs = D.sectionGeo(), st = D.state.start, pts = [[0,0],[0,1],[0,-1],[st.sx,st.sy]];
    segs.forEach(function(g){ (g.s.type === 'bezier' ? g.P : [g.P[0], g.P[3]]).forEach(function(p){ pts.push(p); }); });
    var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    pts.forEach(function(p){
      minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]);
      minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]);
    });
    var total = segs.length ? segs[segs.length - 1].P[3][0] - st.sx : 0;
    if(D.view.ghosts && total > 0){ minX -= total * 0.2; maxX += total * 0.2; }  // room for part of each neighbouring cycle
    var cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    var w=Math.max(maxX-minX, 1e-3), h=Math.max(maxY-minY, w*0.3);
    var pad=Math.max(w,h)*0.06; w+=2*pad; h+=2*pad;
    var vb = D.frozenVB || [cx-w/2, -cy-h/2, w, h].join(' ');
    svg.setAttribute('viewBox', vb);
    var u=parseFloat(vb.split(' ')[2])*0.012, ne=' vector-effect="non-scaling-stroke"', hits='';
    function hit(x,y,i,k){ return '<circle cx="'+x+'" cy="'+(-y)+'" r="'+(u*3)+'" fill="transparent" data-i="'+i+'" data-k="'+k+'" style="cursor:grab"/>'; }
    // The guide lines run well past the view so they reach the edges when the box is wider than the drawing.
    var vp = vb.split(' ').map(parseFloat), x1 = vp[0] - 10 * vp[2], x2 = vp[0] + 11 * vp[2];
    var html='<line x1="'+x1+'" y1="0" x2="'+x2+'" y2="0" stroke="var(--muted)" stroke-width="1" opacity=".5"'+ne+'/>';
    [1,-1].forEach(function(yy){ html+='<line x1="'+x1+'" y1="'+(-yy)+'" x2="'+x2+'" y2="'+(-yy)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"'+ne+'/>'; });
    if(D.view.snap){
      // The snap grid, faint: every 0.1 in height between -1 and 1, and every 0.25 across (every 1 if that would be crowded).
      var gx = vp[2] / D.GRID.x > 120 ? 1 : D.GRID.x, gl = ' stroke="var(--line)" stroke-width="1" opacity=".55"'+ne+'/>';
      for(var xx = Math.ceil(vp[0] / gx) * gx; xx <= vp[0] + vp[2]; xx += gx) html += '<line x1="'+xx+'" y1="-1" x2="'+xx+'" y2="1"'+gl;
      for(var yy = -10; yy <= 10; yy++) if(yy % 10) html += '<line x1="'+x1+'" y1="'+(yy / 10)+'" x2="'+x2+'" y2="'+(yy / 10)+'"'+gl;
    }
    if(D.view.ghosts && total > 0){
      // Faint copies of the whole wave just before and after it: it repeats forever.
      [-total, total].forEach(function(dx){
        html += '<path d="'+segs.map(function(g, i){ return sectionPath(g, dx, i === 0); }).join('')+'" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linejoin="round" opacity=".35"'+ne+'/>';
      });
    }
    segs.forEach(function(g, i){
      var P=g.P, s=g.s, c = i % 2 ? 'var(--c2)' : 'var(--c1)', d = 'M'+P[0][0]+' '+(-P[0][1]);
      if(s.type === 'bezier') d += ' C'+P[1][0]+' '+(-P[1][1])+' '+P[2][0]+' '+(-P[2][1])+' '+P[3][0]+' '+(-P[3][1]);
      else if(s.type === 'sine' || s.type === 'curve'){ for(var k = 1; k <= 64; k++) d += ' L'+(g.X + s.length * k / 64)+' '+(-D.shapeY(s, g.Y, k / 64)); }
      else d += ' L'+P[3][0]+' '+(-P[3][1]);
      var on = i === sel;
      html+='<path d="'+d+'" fill="none" stroke="'+c+'" stroke-width="'+(on ? 3.5 : 2.5)+'" stroke-linecap="round" stroke-linejoin="round"'+(on ? '' : ' opacity=".45"')+ne+'/>';
      pick+='<path d="'+d+'" fill="none" stroke="transparent" stroke-width="16" stroke-linecap="round" pointer-events="stroke" data-i="'+i+'" data-k="sel" style="cursor:pointer"'+ne+'/>';
      if(s.type !== 'bezier' || !on) return;
      [[P[0],P[1]],[P[3],P[2]]].forEach(function(l){
        html+='<line x1="'+l[0][0]+'" y1="'+(-l[0][1])+'" x2="'+l[1][0]+'" y2="'+(-l[1][1])+'" stroke="'+c+'" stroke-width="1" stroke-dasharray="4 3" opacity=".6"'+ne+'/>';
      });
      [P[1],P[2]].forEach(function(p){
        html+='<circle cx="'+p[0]+'" cy="'+(-p[1])+'" r="'+u+'" fill="var(--surface)" stroke="'+c+'" stroke-width="1.5"'+ne+'/>';
      });
      hits+=hit(P[1][0],P[1][1],i,'h1')+hit(P[2][0],P[2][1],i,'h2');
    });
    if(D.view.arrow && segs.length){
      // An arrow at the end, pointing the way the wave sets off again from the start.
      var dir = startDirection(segs), ex = st.sx + total, ey = st.sy, al = u * 4.5, hx = ex + dir[0] * al, hy = ey + dir[1] * al, hw = u * 1.4;
      var bx = hx - dir[0] * hw * 1.6, by = hy - dir[1] * hw * 1.6, px = -dir[1] * hw, py = dir[0] * hw;
      html += '<line x1="'+(ex + dir[0] * u * 1.4)+'" y1="'+(-(ey + dir[1] * u * 1.4))+'" x2="'+bx+'" y2="'+(-by)+'" stroke="var(--ink)" stroke-width="2" stroke-linecap="round"'+ne+'/>';
      html += '<path d="M'+hx+' '+(-hy)+' L'+(bx + px)+' '+(-(by + py))+' L'+(bx - px)+' '+(-(by - py))+' Z" fill="var(--ink)"/>';
    }
    // The start is a square that can't be dragged: it always sits at the last end's height, since the wave loops back to it.
    html+='<rect x="'+(st.sx-u)+'" y="'+(-st.sy-u)+'" width="'+(u*2)+'" height="'+(u*2)+'" fill="var(--ink)"/>';
    segs.forEach(function(g, i){
      html+='<circle cx="'+g.P[3][0]+'" cy="'+(-g.P[3][1])+'" r="'+(u*0.9)+'" fill="var(--ink)"/>';
      hits+=hit(g.P[3][0], g.P[3][1], i, 'end');
    });
    svg.innerHTML=html+pick+hits;
  }

  D.drawPreview = drawPreview;
})(window.Dial = window.Dial || {});
