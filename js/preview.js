// SVG preview drawing. D.frozenVB holds the viewBox while a drag is in progress.
(function(D){
  var svg = document.getElementById('preview');
  D.svg = svg;
  D.frozenVB = null;
  var coarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : { matches: false };  // a finger rather than a mouse

  // View options, kept per browser: snap to grid, and ghost copies of the neighbouring cycles.
  var VKEY = 'dial-view-v1';
  D.view = { snap: false, ghosts: true };
  try{ var v = JSON.parse(localStorage.getItem(VKEY)); if(v) ['snap', 'ghosts'].forEach(function(k){ if(typeof v[k] === 'boolean') D.view[k] = v[k]; }); }catch(e){}
  D.saveView = function(){ try{ localStorage.setItem(VKEY, JSON.stringify(D.view)); }catch(e){} };
  D.GRID = { x: 0.25, y: 0.1 };  // snap steps: x across the whole wave, heights from the middle line

  // The path of one section, moved dx along x (for the ghost copies), and upside down if flip (for the mirrored half).
  function sectionPath(g, dx, start, flip){
    var P = g.P, s = g.s, f = flip ? 1 : -1, d = (start ? 'M' : ' L') + (P[0][0] + dx) + ' ' + (f * P[0][1]);
    if(s.type === 'bezier') d += ' C'+(P[1][0]+dx)+' '+(f*P[1][1])+' '+(P[2][0]+dx)+' '+(f*P[2][1])+' '+(P[3][0]+dx)+' '+(f*P[3][1]);
    else if(s.type === 'sine' || s.type === 'curve'){ for(var k = 1; k <= 64; k++) d += ' L'+(g.X + dx + s.length * k / 64)+' '+(f * D.shapeY(s, g.Y, k / 64)); }
    else d += ' L'+(P[3][0]+dx)+' '+(f*P[3][1]);
    return d;
  }
  // The whole cycle as one path: the sections, then (with symmetry) the same sections upside down.
  function cyclePath(segs, dx, span, half){
    var d = segs.map(function(g, i){ return sectionPath(g, dx, i === 0, false); }).join('');
    if(half) d += segs.map(function(g){ return sectionPath(g, dx + span, false, true); }).join('');
    return d;
  }

  // The selected section is drawn bold with its handles; the others are faded and their handles hidden. Every curve has
  // a wide invisible outline that selects it when clicked. Hidden handles still count towards the view's size, so the
  // view doesn't jump when the selection changes.
  function drawPreview(){
    var sel = D.selIdx, pick = '', segs = D.sectionGeo(), st = D.state.start, pts = [[0,0],[0,1],[0,-1],[st.sx,st.sy]];
    segs.forEach(function(g){ (g.s.type === 'bezier' ? g.P : [g.P[0], g.P[3]]).forEach(function(p){ pts.push(p); }); });
    var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    var half = D.isHalf(), span = segs.length ? segs[segs.length - 1].P[3][0] - st.sx : 0, total = half ? 2 * span : span;
    if(half) pts.slice().forEach(function(p){ pts.push([p[0] + span, -p[1]]); });  // the mirrored half counts towards the view
    pts.forEach(function(p){ minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]); minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]); });
    if(D.view.ghosts && total > 0){ minX -= total * 0.2; maxX += total * 0.2; }  // room for part of each neighbouring cycle
    var cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    var w=Math.max(maxX-minX, 1e-3), h=Math.max(maxY-minY, w*0.3);
    var pad=Math.max(w,h)*0.06; w+=2*pad; h+=2*pad;
    var vb = D.frozenVB || [cx-w/2, -cy-h/2, w, h].join(' ');
    svg.setAttribute('viewBox', vb);
    var u=parseFloat(vb.split(' ')[2])*0.012, ne=' vector-effect="non-scaling-stroke"', hits='';
    // On touch screens, dots are at least 10px and their grab areas 30px (about a fingertip) on screen, however small
    // the preview is drawn. u is the dot size in drawing units, so convert using how big the drawing is shown.
    var box = svg.getBoundingClientRect(), vbs = vb.split(' ').map(parseFloat);
    if(coarse.matches && box.width > 0) u = Math.max(u, 10 / Math.min(box.width / vbs[2], box.height / vbs[3]));
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
    if(D.reference && total > 0){
      // The reference trace, stretched across one cycle: a wide faint line to trace over.
      var ry = D.reference.ys, rd = '';
      for(var ri = 0; ri <= ry.length; ri++) rd += (ri ? ' L' : 'M') + (st.sx + total * ri / ry.length) + ' ' + (-ry[ri % ry.length]);
      html += '<path d="'+rd+'" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linejoin="round" stroke-linecap="round" opacity=".18"'+ne+'/>';
    }
    if(D.view.ghosts && total > 0){
      // Faint copies of the whole wave just before and after it: it repeats forever.
      [-total, total].forEach(function(dx){
        html += '<path d="'+cyclePath(segs, dx, span, half)+'" fill="none" stroke="var(--muted)" stroke-width="2" stroke-linejoin="round" opacity=".35"'+ne+'/>';
      });
    }
    if(half){
      // The automatic second half: each section again, upside down, dashed to show it can't be edited directly.
      segs.forEach(function(g, i){
        html += '<path d="'+sectionPath(g, span, true, true)+'" fill="none" stroke="'+(i % 2 ? 'var(--c2)' : 'var(--c1)')+'" stroke-width="2.5" stroke-dasharray="6 4" stroke-linejoin="round" opacity=".5"'+ne+'/>';
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
