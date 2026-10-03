/* Artificial display geometry for two retained native channels. No analytical transform. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.ObservatoryForm=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const version='observatory-form/1';
  const defaultCamera=Object.freeze({yaw:-.55,pitch:.42,zoom:1,panX:0,panY:0,projection:'orthographic'});
  const meshSpec=Object.freeze({envelope:{latitude_intervals:20,longitude_segments:40},gaussian:{x_intervals:28,y_intervals:28}});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const unit=v=>{const m=Math.hypot(...v);return v.map(x=>x/m);};
  const directions=Object.freeze([Object.freeze(unit([.85,.15,.5])),Object.freeze(unit([-.4,-.75,.55]))]);
  const gaussianCenters=Object.freeze([Object.freeze([[-1,-.85],[-1,.85]]),Object.freeze([[1,-.85],[1,.85]])]);
  const dot=(a,b)=>a.reduce((s,x,i)=>s+x*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const fmt=x=>Number(x).toPrecision(5).replace(/(\.\d*?[1-9])0+(e|$)/,'$1$2').replace(/\.0+(e|$)/,'$1');
  function check(ok,message){if(!ok)throw Error(message);}
  function validateCalibration(calibration){
    check(Array.isArray(calibration)&&calibration.length===2,'The form requires exactly two explicitly calibrated numeric channels.');
    const seen=new Set();return calibration.map(c=>{check(c&&typeof c.key==='string'&&c.key&&!seen.has(c.key),'Calibration keys must be distinct nonempty strings.');check(typeof c.label==='string'&&typeof c.unit==='string','Every channel needs a readable label and a native unit.');check(typeof c.scale==='number'&&Number.isFinite(c.scale)&&c.scale>0,'Each shared display scale must be positive and finite.');seen.add(c.key);return {key:c.key,label:c.label,unit:c.unit,scale:c.scale};});
  }
  function normalizeChannels(channels,calibration){
    const cs=validateCalibration(calibration),entries=Array.isArray(channels)?Object.fromEntries(channels.map(c=>[c.key,c.value])):channels;
    check(entries&&typeof entries==='object','Native channel values are required.');
    return cs.map((c,index)=>{const value=entries[c.key];check(typeof value==='number'&&Number.isFinite(value),'Missing or nonfinite native channel: '+c.key);return {...c,index,value,ratio:value/c.scale,displayContribution:Math.tanh(value/c.scale)};});
  }
  function validateCamera(camera){
    const c={...camera};for(const k of ['yaw','pitch','zoom','panX','panY'])check(typeof c[k]==='number'&&Number.isFinite(c[k]),'Camera '+k+' must be finite.');
    check(c.pitch>=.06&&c.pitch<=1.48,'Camera pitch is outside the supported range.');check(c.zoom>=.4&&c.zoom<=3,'Camera zoom is outside the supported range.');check(c.projection==='orthographic','Only orthographic projection is supported.');
    return {yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,panX:c.panX,panY:c.panY,projection:c.projection};
  }
  function describe({encoding='envelope',camera=defaultCamera,calibration}={}){
    check(['envelope','gaussian'].includes(encoding),'Unsupported form encoding.');const cs=validateCalibration(calibration),c=validateCamera(camera);
    return {version,encoding,calibration:cs,camera:c,authority:'Retained native values and units remain authoritative; this is an explicit display mapping, not physical geometry or newly inferred information.',shared_calibration:'Both series use the same ordered channels, positive scales, contribution formula, mesh, coordinates, projection and camera.',contribution:'q_i = tanh(native_value_i / shared_scale_i); signed, bounded display compression only. Native values remain unchanged and inspectable.',omissions:'Unselected channels are not encoded; no source fields are deleted. The surface does not encode source uncertainty, density, probability or an inferred lifecycle.',mesh:meshSpec[encoding],geometry:encoding==='envelope'?{formula:'r(n) = 1.2 * (1 + 0.32 * sum_i(q_i * exp(4 * (dot(n, direction_i) - 1)))); point = [r*n_x, r*n_y, 2.2 + r*n_z]',directions,radial_bounds:[.432,1.968],topology:'One closed shell with unique poles, periodic longitude and no mirrored second signal; tessellated display surface.',baseline:'Radius 1.2 at zero contributions, centered 2.2 display units above the reference plane.',sign:'Positive values produce a bulge; negative values produce an indentation in the same fixed channel direction.'}:{formula:'z(x,y) = 0.04 + 1.6 * sum_i(sum_s(max(s*q_i,0) * exp(-distance_to_center_i_s_squared / (2*0.52^2))))',centers:{channel_0:{positive:gaussianCenters[0][0],negative:gaussianCenters[0][1]},channel_1:{positive:gaussianCenters[1][0],negative:gaussianCenters[1][1]}},domain:{x:[-2.65,2.65],y:[-2.65,2.65]},sign:'Positive and negative lobes are a display decomposition of the same two signed contributions, not additional measurements.',smoothing_sigma:.52,topology:'Finite open height surface over the reference plane.'},projection:{type:'orthographic',rotation:'yaw about vertical followed by elevation pitch',center_z:1.7,scale:'min(canvas_css_width / 7.4, canvas_css_height / 3.8) * camera.zoom',pan_units:'CSS pixels',viewport_capture:'Runtime canvas dimensions affect presentation only; no automatic recalibration or analysis.'},reference_plane:{z:0,units:'artificial display coordinates'},trail:'Optional retained frames rendered independently as faint wire contours. No interpolated temporal observations.'};
  }
  function makeGeometry({channels,calibration,encoding='envelope'}={}){
    const contributions=normalizeChannels(channels,calibration),contract=describe({encoding,calibration}),points=[],faces=[],wires=[],markers=[];
    const values=contributions.map(c=>c.displayContribution);
    function radial(n){return 1.2*(1+.32*values.reduce((s,q,i)=>s+q*Math.exp(4*(dot(n,directions[i])-1)),0));}
    function surface(n){const r=radial(n);return [n[0]*r,n[1]*r,2.2+n[2]*r];}
    function face(ids){const p=ids.map(i=>points[i]),normal=unit(cross(sub(p[1],p[0]),sub(p[2],p[0]))),center=p[0].map((v,j)=>(v+p[1][j]+p[2][j])/3);faces.push({ids,normal,center});}
    if(encoding==='envelope'){
      const {latitude_intervals:rings,longitude_segments:segments}=meshSpec.envelope;
      points.push(surface([0,0,1]));
      for(let j=1;j<rings;j++){const theta=Math.PI*j/rings;for(let k=0;k<segments;k++){const phi=2*Math.PI*k/segments;points.push(surface([Math.sin(theta)*Math.cos(phi),Math.sin(theta)*Math.sin(phi),Math.cos(theta)]));}}
      const south=points.length;points.push(surface([0,0,-1]));const id=(j,k)=>1+(j-1)*segments+((k+segments)%segments);
      for(let k=0;k<segments;k++){face([0,id(1,k),id(1,k+1)]);face([south,id(rings-1,k+1),id(rings-1,k)]);}
      for(let j=1;j<rings-1;j++)for(let k=0;k<segments;k++){face([id(j,k),id(j+1,k),id(j+1,k+1)]);face([id(j,k),id(j+1,k+1),id(j,k+1)]);}
      // Closed, sparse contours clarify shape without inventing another channel.
      for(let j=5;j<rings;j+=5)wires.push(Array.from({length:segments+1},(_,k)=>id(j,k)));
      for(let k=0;k<segments;k+=10)wires.push([0,...Array.from({length:rings-1},(_,j)=>id(j+1,k)),south]);
      contributions.forEach((c,i)=>markers.push({...c,position:surface(directions[i]),direction:directions[i]}));
    }else{
      const nx=meshSpec.gaussian.x_intervals,ny=meshSpec.gaussian.y_intervals;
      const height=(x,y)=>.04+1.6*values.reduce((s,q,i)=>s+gaussianCenters[i].reduce((total,p,sign)=>total+Math.max((sign===0?1:-1)*q,0)*Math.exp(-((x-p[0])**2+(y-p[1])**2)/(2*.52**2)),0),0);
      for(let j=0;j<=ny;j++)for(let k=0;k<=nx;k++){const x=-2.65+5.3*k/nx,y=-2.65+5.3*j/ny;points.push([x,y,height(x,y)]);}
      const id=(j,k)=>j*(nx+1)+k;for(let j=0;j<ny;j++)for(let k=0;k<nx;k++){face([id(j,k),id(j,k+1),id(j+1,k+1)]);face([id(j,k),id(j+1,k+1),id(j+1,k)]);}
      for(let j=0;j<=ny;j+=7)wires.push(Array.from({length:nx+1},(_,k)=>id(j,k)));for(let k=0;k<=nx;k+=7)wires.push(Array.from({length:ny+1},(_,j)=>id(j,k)));
      contributions.forEach((c,i)=>{const p=gaussianCenters[i][c.displayContribution<0?1:0];markers.push({...c,position:[...p,height(...p)],displayDecomposition:c.displayContribution<0?'negative lobe':'positive lobe'});});
    }
    return {version,encoding,points,faces,wires,markers,contributions,contract};
  }
  class Scene{
    constructor(canvas,{onCameraChange,onPick}={}){
      check(canvas?.getContext,'A canvas is required.');this.canvas=canvas;this.ctx=canvas.getContext('2d');this.onCameraChange=onCameraChange;this.onPick=onPick;this.camera={...defaultCamera};this.config=null;this.geometries=null;this.drag=null;this.hitTargets=[];this.destroyed=false;
      canvas.style.touchAction='none';canvas.style.cursor='grab';
      this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:e=>this.up(e),wheel:e=>this.wheel(e),contextmenu:e=>e.preventDefault()};
      for(const [name,fn]of Object.entries(this.handlers))canvas.addEventListener(name,fn,{passive:false});this.observer=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>this.draw()):null;this.observer?.observe(canvas);
    }
    render(config){
      check(config&&config.a,'At least reference series A is required.');const calibration=validateCalibration(config.calibration),encoding=config.encoding||'envelope';if(config.camera)this.camera=validateCamera(config.camera);
      const key=JSON.stringify([encoding,calibration,config.a.channels,config.b?.channels,config.trail?.map(t=>t.channels)]);
      if(this.geometryKey!==key){this.geometries={a:makeGeometry({channels:config.a.channels,calibration,encoding}),b:config.b?makeGeometry({channels:config.b.channels,calibration,encoding}):null,trail:(config.trail||[]).slice(-8).map(t=>makeGeometry({channels:t.channels,calibration,encoding}))};this.geometryKey=key;}
      this.config={...config,calibration,encoding};this.draw();return this;
    }
    getCamera(){return {...this.camera};}
    setCamera(change){this.camera=validateCamera({...this.camera,...change});this.draw();this.onCameraChange?.(this.getCamera());return this;}
    home(){return this.setCamera(defaultCamera);}
    fit(){const b=this.canvas.getBoundingClientRect(),w=Math.max(1,b.width||900),h=Math.max(1,b.height||640),dpr=Math.min(root.devicePixelRatio||1,2);if(w!==this.width||h!==this.height||dpr!==this.dpr){this.width=w;this.height=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}this.ctx.setTransform(dpr,0,0,dpr,0,0);}
    projector(){const c=this.camera,ca=Math.cos(c.yaw),sa=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),scale=Math.min(this.width/7.4,this.height/3.8)*c.zoom;return point=>{const [x,y,z]=point,xx=x*ca-y*sa,yy=x*sa+y*ca,zz=z-1.7;return {x:this.width/2+c.panX+xx*scale,y:this.height*.5+c.panY-(zz*cp-yy*sp)*scale,depth:yy*cp+zz*sp};};}
    line(points,color,width=1,dash=[]){if(points.length<2)return;const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);points.slice(1).forEach(p=>c.lineTo(p.x,p.y));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
    text(text,x,y,color='#90a8b8',align='left',size=12){const c=this.ctx;c.font=`${size}px Segoe UI, sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(text,x,y);}
    plane(p){const c=this.ctx,edge=3.15,corners=[[-edge,-edge,0],[edge,-edge,0],[edge,edge,0],[-edge,edge,0]].map(p);c.beginPath();corners.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fillStyle='rgba(48,72,91,.10)';c.fill();c.strokeStyle='rgba(111,148,169,.22)';c.lineWidth=1;c.stroke();for(let n=-3;n<=3;n++){this.line([p([n,-3,0]),p([n,3,0])],'rgba(91,124,147,.10)');this.line([p([-3,n,0]),p([3,n,0])],'rgba(91,124,147,.10)');}
      const base=p([0,0,0]);c.save();c.translate(base.x,base.y);c.scale(1,.22);const grad=c.createRadialGradient(0,0,0,0,0,Math.min(this.width,this.height)*.22*this.camera.zoom);grad.addColorStop(0,'rgba(0,0,0,.25)');grad.addColorStop(1,'rgba(0,0,0,0)');c.fillStyle=grad;c.beginPath();c.arc(0,0,Math.min(this.width,this.height)*.22*this.camera.zoom,0,2*Math.PI);c.fill();c.restore();
      const label=p([3.1,3.1,0]);this.text('REFERENCE PLANE',label.x,label.y+16,'#627c90','center',10);
    }
    filled(g,p,side){const c=this.ctx,projected=g.points.map(p),view=[Math.sin(this.camera.yaw)*Math.cos(this.camera.pitch),Math.cos(this.camera.yaw)*Math.cos(this.camera.pitch),Math.sin(this.camera.pitch)],light=unit([-.5,-.7,.9]),faces=g.faces.map(f=>({...f,depth:p(f.center).depth})).sort((a,b)=>a.depth-b.depth);
      for(const f of faces){const facing=dot(f.normal,view);if(g.encoding==='envelope'&&facing<=0)continue;const intensity=.35+.65*Math.max(0,dot(f.normal,light)),rim=(1-Math.abs(facing))**3,shine=Math.max(0,dot(f.normal,unit(sub(unit([-.5,-.7,.9]),view.map(x=>-x)))))**24,lightness=side==='B'?22+intensity*23+rim*10+shine*13:24+intensity*22+rim*8;
        c.beginPath();f.ids.forEach((id,i)=>i?c.lineTo(projected[id].x,projected[id].y):c.moveTo(projected[id].x,projected[id].y));c.closePath();c.fillStyle=`hsla(${side==='B'?187:36},${side==='B'?65:64}%,${lightness}%,.91)`;c.fill();}
      return projected;
    }
    wire(g,p,color,alpha=1){const projected=g.points.map(p);for(const ids of g.wires){const pts=ids.map(i=>projected[i]);this.line(pts,color.replace('ALPHA',String(alpha)),.8);}return projected;}
    markers(g,p,side){
      const c=this.ctx,color=side==='A'?'#f3bc70':'#69e6ef',chipW=38,chipH=26;
      g.markers.forEach(m=>{
        const point=p(m.position),direction=side==='A'?-1:1,label=side+(m.index+1);
        let x=clamp(point.x+direction*42,chipW/2+12,this.width-chipW/2-12),y=clamp(point.y+(side==='A'?-20:20),chipH/2+16,this.height-chipH/2-44);
        for(let step=0;step<12&&this.hitTargets.some(t=>Math.abs(t.screen.x-x)<chipW+10&&Math.abs(t.screen.y-y)<chipH+8);step++)y=clamp(y+(side==='A'?-1:1)*(chipH+10),chipH/2+16,this.height-chipH/2-44);
        // If the vertical edge constrained a chip, a horizontal lane still keeps it separate.
        for(let step=0;step<8&&this.hitTargets.some(t=>Math.abs(t.screen.x-x)<chipW+10&&Math.abs(t.screen.y-y)<chipH+8);step++)x=clamp(x+direction*(chipW+12),chipW/2+12,this.width-chipW/2-12);
        this.line([point,{x:x-direction*chipW/2,y}],color+'a0',1);
        c.beginPath();c.arc(point.x,point.y,3.5,0,2*Math.PI);c.fillStyle=color;c.fill();c.strokeStyle='#0a1520';c.lineWidth=1.2;c.stroke();
        c.fillStyle='#101e2bea';c.strokeStyle=color+'b0';c.lineWidth=1;c.fillRect(x-chipW/2,y-chipH/2,chipW,chipH);c.strokeRect(x-chipW/2,y-chipH/2,chipW,chipH);this.text(label,x,y,color,'center',12);
        this.hitTargets.push({...m,side,markerLabel:label,seriesLabel:this.config[side.toLowerCase()]?.label||side,screen:{x,y},nativeScreen:point,hitBounds:{left:x-chipW/2,right:x+chipW/2,top:y-chipH/2,bottom:y+chipH/2},encoding:g.encoding});
      });
    }
    draw(){if(this.destroyed)return;this.fit();const c=this.ctx,w=this.width,h=this.height;c.clearRect(0,0,w,h);const background=c.createLinearGradient(0,0,w,h);background.addColorStop(0,'#0b1522');background.addColorStop(1,'#111f2c');c.fillStyle=background;c.fillRect(0,0,w,h);if(!this.config||!this.geometries)return;const p=this.projector();this.plane(p);const g=this.geometries;g.trail.forEach((t,i)=>this.wire(t,p,'rgba(100,168,188,ALPHA)',.035+.08*(i+1)/g.trail.length));
      if(g.b){this.filled(g.b,p,'B');this.wire(g.a,p,'rgba(244,181,94,ALPHA)',.38);}else{this.filled(g.a,p,'A');this.wire(g.a,p,'rgba(244,201,130,ALPHA)',.12);}
      this.hitTargets=[];this.markers(g.a,p,'A');if(g.b)this.markers(g.b,p,'B');
      const shortNames=this.config.calibration.map(c=>({position:'Position',velocity:'Velocity',left:'Left',right:'Right'}[c.key]||c.label.split(' · ')[0]));
      this.text('1 '+shortNames[0]+' · 2 '+shortNames[1]+' · select a marker to inspect',w/2,h-20,'#9db3c4','center',12);
      this.canvas.dataset.encoding=this.config.encoding;this.canvas.dataset.camera=JSON.stringify(this.camera);this.canvas.dataset.contributions=JSON.stringify({a:g.a.contributions,b:g.b?.contributions||null});this.canvas.setAttribute?.('aria-label',(this.config.encoding==='envelope'?'Closed signed-channel envelope':'Gaussian height display')+'. '+g.a.contributions.map(v=>v.label+' '+v.value+' '+v.unit).join('; ')+(g.b?'. Candidate: '+g.b.contributions.map(v=>v.label+' '+v.value+' '+v.unit).join('; '):'')+'. Drag to orbit. Geometry is a display mapping, not a physical measurement.');
    }
    pick(x,y){const target=this.hitTargets.find(m=>x>=m.hitBounds.left&&x<=m.hitBounds.right&&y>=m.hitBounds.top&&y<=m.hitBounds.bottom);return target?{...target,distance:Math.hypot(target.screen.x-x,target.screen.y-y)}:null;}
    down(e){if(e.button!==0&&e.button!==2)return;e.preventDefault();this.canvas.setPointerCapture?.(e.pointerId);this.drag={startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,pan:e.shiftKey||e.button===2,moved:false};this.canvas.style.cursor='grabbing';}
    move(e){if(!this.drag)return;e.preventDefault();const d=this.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;d.moved||=Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>3;if(d.pan){this.camera.panX+=dx;this.camera.panY+=dy;}else{this.camera.yaw+=dx*.008;this.camera.pitch=clamp(this.camera.pitch+dy*.007,.06,1.48);}d.x=e.clientX;d.y=e.clientY;this.draw();this.onCameraChange?.(this.getCamera());}
    up(e){if(!this.drag)return;const d=this.drag;this.drag=null;this.canvas.style.cursor='grab';this.canvas.releasePointerCapture?.(e.pointerId);if(!d.moved&&e.type!=='pointercancel'){const b=this.canvas.getBoundingClientRect(),picked=this.pick(e.clientX-b.left,e.clientY-b.top);if(picked)this.onPick?.(picked);}}
    wheel(e){e.preventDefault();this.camera.zoom=clamp(this.camera.zoom*Math.exp(-e.deltaY*.001),.4,3);this.draw();this.onCameraChange?.(this.getCamera());}
    manifest(){return this.config?{...describe({...this.config,camera:this.camera}),viewport:{width:this.width,height:this.height,pixel_ratio:this.dpr},contributions:{a:this.geometries.a.contributions,b:this.geometries.b?.contributions||null},trails_shown:this.geometries.trail.length}:null;}
    destroy(){this.destroyed=true;this.observer?.disconnect();for(const [name,fn]of Object.entries(this.handlers))this.canvas.removeEventListener(name,fn);}
  }
  return Object.freeze({version,defaultCamera,meshSpec,directions,validateCalibration,normalizeChannels,validateCamera,describe,makeGeometry,Scene});
});
