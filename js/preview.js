// SVG preview drawing. D.frozenVB holds the viewBox while a drag is in progress.
(function(D){
  var svg = document.getElementById('preview');
  D.svg = svg;
  D.frozenVB = null;

  function drawPreview(){
    var segs = D.sectionGeo(), st = D.state.start, pts = [[0,0],[0,1],[0,-1],[st.sx,st.sy]];
    segs.forEach(function(g){ g.P.forEach(function(p){ pts.push(p); }); });
    var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
    pts.forEach(function(p){
      minX=Math.min(minX,p[0]); maxX=Math.max(maxX,p[0]);
      minY=Math.min(minY,p[1]); maxY=Math.max(maxY,p[1]);
    });
    var cx=(minX+maxX)/2, cy=(minY+maxY)/2;
    var w=Math.max(maxX-minX, 1e-3), h=Math.max(maxY-minY, w*0.3);
    var pad=Math.max(w,h)*0.06; w+=2*pad; h+=2*pad;
    var vb = D.frozenVB || [cx-w/2, -cy-h/2, w, h].join(' ');
    svg.setAttribute('viewBox', vb);
    var u=parseFloat(vb.split(' ')[2])*0.012, ne=' vector-effect="non-scaling-stroke"', hits='';
    function hit(x,y,i,k){ return '<circle cx="'+x+'" cy="'+(-y)+'" r="'+(u*3)+'" fill="transparent" data-i="'+i+'" data-k="'+k+'" style="cursor:grab"/>'; }
    var vp = vb.split(' ').map(parseFloat), x1 = vp[0], x2 = vp[0] + vp[2];
    var html='<line x1="'+x1+'" y1="0" x2="'+x2+'" y2="0" stroke="var(--muted)" stroke-width="1" opacity=".5"'+ne+'/>';
    [1,-1].forEach(function(yy){ html+='<line x1="'+x1+'" y1="'+(-yy)+'" x2="'+x2+'" y2="'+(-yy)+'" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"'+ne+'/>'; });
    html+='<line x1="0" y1="0" x2="'+st.sx+'" y2="'+(-st.sy)+'" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"'+ne+'/>';
    segs.forEach(function(g, i){
      var P=g.P, c = i % 2 ? 'var(--c2)' : 'var(--c1)';
      html+='<path d="M'+P[0][0]+' '+(-P[0][1])+' C'+P[1][0]+' '+(-P[1][1])+' '+P[2][0]+' '+(-P[2][1])+' '+P[3][0]+' '+(-P[3][1])+'" fill="none" stroke="'+c+'" stroke-width="2.5" stroke-linecap="round"'+ne+'/>';
      [[P[0],P[1]],[P[3],P[2]]].forEach(function(l){
        html+='<line x1="'+l[0][0]+'" y1="'+(-l[0][1])+'" x2="'+l[1][0]+'" y2="'+(-l[1][1])+'" stroke="'+c+'" stroke-width="1" stroke-dasharray="4 3" opacity=".6"'+ne+'/>';
      });
      [P[1],P[2]].forEach(function(p){
        html+='<circle cx="'+p[0]+'" cy="'+(-p[1])+'" r="'+u+'" fill="var(--surface)" stroke="'+c+'" stroke-width="1.5"'+ne+'/>';
      });
      hits+=hit(P[1][0],P[1][1],i,'h1')+hit(P[2][0],P[2][1],i,'h2');
    });
    var last = segs[segs.length-1].P[3], endX = last[0];
    html+='<line x1="'+endX+'" y1="'+(-last[1])+'" x2="'+endX+'" y2="'+(-st.sy)+'" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"'+ne+'/>';
    html+='<rect x="'+(endX-u*0.9)+'" y="'+(-st.sy-u*0.9)+'" width="'+(u*1.8)+'" height="'+(u*1.8)+'" fill="var(--ink)"/>';
    html+='<circle cx="'+st.sx+'" cy="'+(-st.sy)+'" r="'+(u*0.9)+'" fill="var(--ink)"/>';
    segs.forEach(function(g, i){
      html+='<circle cx="'+g.P[3][0]+'" cy="'+(-g.P[3][1])+'" r="'+(u*0.9)+'" fill="var(--ink)"/>';
      hits+=hit(g.P[3][0], g.P[3][1], i, 'end');
    });
    hits+=hit(st.sx, st.sy, 0, 'start');
    svg.innerHTML=html+hits;
  }

  D.drawPreview = drawPreview;
})(window.Dial = window.Dial || {});
