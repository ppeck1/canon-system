/* Display geometry for an existing coefficient matrix. No transform runs here. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.TimescaleLandscape=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){
  'use strict';
  const version='timescale-landscape/1';
  const defaultCamera=Object.freeze({yaw:-.62,pitch:.72,zoom:1,panX:0,panY:0,projection:'orthographic'});
  const cameraLimits=Object.freeze({pitch:Object.freeze([.08,Math.PI/2]),zoom:Object.freeze([.25,3]),projection:Object.freeze(['orthographic'])});
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const fmt=v=>Number(v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
  function check(ok,message){if(!ok)throw Error(message);}
  function validateCamera(camera){
    for(const k of ['yaw','pitch','zoom','panX','panY'])check(typeof camera?.[k]==='number'&&Number.isFinite(camera[k]),'Landscape camera '+k+' must be finite.');
    for(const k of ['pitch','zoom'])check(camera[k]>=cameraLimits[k][0]&&camera[k]<=cameraLimits[k][1],'Landscape camera '+k+' is outside supported bounds.');
    check(camera.projection==='orthographic','Landscape supports orthographic projection only.');
    return {yaw:camera.yaw,pitch:camera.pitch,zoom:camera.zoom,panX:camera.panX,panY:camera.panY,projection:camera.projection};
  }
  function colorForMagnitude(value,maximum){const v=maximum>0?clamp(value/maximum,0,1):0;return `hsl(${245-v*210} ${45+v*40}% ${15+v*53}%)`;}
  function makeGeometry(result){
    check(result?.contract_version==='calibration-cwt/1'&&result.implementation_version==='cmor-sampled-convolution/1','Unsupported coefficient result for landscape.');
    const n=result.times_s.length,m=result.frequencies_hz.length,maximum=result.display.magnitude_max;
    check(n>=2&&m>=2&&Number.isFinite(maximum)&&maximum>=0,'Invalid landscape dimensions or magnitude bounds.');
    const t0=result.times_s[0],t1=result.times_s[n-1],f0=result.frequencies_hz[0],f1=result.frequencies_hz[m-1];
    check(t1>t0&&f1>f0&&f0>0,'Landscape requires ordered native time and positive frequency bounds.');
    const points=new Float64Array(n*m*3),colors=new Array(n*m);
    for(let j=0;j<m;j++){
      check(result.magnitude[j]?.length===n,'Coefficient row length mismatch.');
      for(let k=0;k<n;k++){
        const value=result.magnitude[j][k],i=(j*n+k)*3;
        check(Number.isFinite(value)&&value>=0&&value<=maximum+Math.max(1e-12,maximum*1e-12),'Invalid coefficient or inconsistent shared magnitude bound.');
        points[i]=-3.3+6.6*(result.times_s[k]-t0)/(t1-t0);
        points[i+1]=-2.2+4.4*Math.log(result.frequencies_hz[j]/f0)/Math.log(f1/f0);
        points[i+2]=maximum>0?3.2*value/maximum:0;
        colors[j*n+k]=colorForMagnitude(value,maximum);
      }
    }
    return {result,rows:m,samples:n,points,colors,maximum,timeBounds:[t0,t1],frequencyBounds:[f0,f1],
      vertex(row,sample){check(Number.isInteger(row)&&row>=0&&row<m&&Number.isInteger(sample)&&sample>=0&&sample<n,'Invalid landscape vertex.');const i=(row*n+sample)*3;return {row,sample,time_s:result.times_s[sample],frequency_hz:result.frequencies_hz[row],magnitude:result.magnitude[row][sample],x:points[i],y:points[i+1],z:points[i+2]};}};
  }
  function triangleContains(px,py,a,b,c){const s=(u,v,w)=>(px-w.x)*(v.y-w.y)-(v.x-w.x)*(py-w.y),d1=s(a,b,c),d2=s(b,c,a),d3=s(c,a,b);return !((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0));}
  function renderingRecord(result,{camera=defaultCamera,row=0,sample=0,viewport=null}={}){
    check(result?.contract_version==='calibration-cwt/1','A supported transform result is required for the rendering record.');
    const c=validateCamera(camera),m=result.frequencies_hz.length,n=result.times_s.length;
    check(Number.isInteger(row)&&row>=0&&row<m&&Number.isInteger(sample)&&sample>=0&&sample<n,'Invalid selected coefficient for rendering record.');
    return {version,analysis_recomputed:false,coefficient_authority:'the same result.magnitude[row][sample] matrix used by the 2D map',selection:{row,sample,time_s:result.times_s[sample],frequency_hz:result.frequencies_hz[row],magnitude:result.magnitude[row][sample]},camera:c,camera_limits:cameraLimits,source_revision:result.source.revision,transform_version:result.contract_version,implementation_version:result.implementation_version,matrix_shape:[m,n],vertices:m*n,spatial_decimation:'none: every coefficient is a mesh vertex',color_range:[0,result.display.magnitude_max],height_range:[0,result.display.magnitude_max],units:result.units.coefficient,coordinate_transforms:{x:'-3.3 + 6.6*(native_time-first_time)/(last_time-first_time)',y:'-2.2 + 4.4*log(frequency/first_frequency)/log(last_frequency/first_frequency)',z:'3.2 * existing coefficient magnitude / shared maximum; flat zero when maximum=0'},surface:'projected quadrilateral faces joining adjacent coefficient samples; not new analytical coefficients',color:'same linear magnitude color function as 2D; each face uses its lower-index existing coefficient',edge_overlay:'same existing edge_affected flag as 2D, white alpha 0.25; a convention, not significance',projection:{type:'orthographic',scale:'min(canvas_width/10.6,canvas_height/7.5)*zoom',center_z:.8,pan_units:'CSS pixels'},viewport,clipping:'canvas clips projected geometry at its bounds; Home restores standard view',cursor:'one exact original row/sample; face hit selects its nearest projected original vertex'};
  }
  class Scene{
    constructor(canvas,{onSelect,onCameraChange,onCameraCommit}={}){
      check(canvas?.getContext,'Landscape Scene requires a canvas.');this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera={...defaultCamera};this.onSelect=onSelect;this.onCameraChange=onCameraChange;this.onCameraCommit=onCameraCommit;this.geometry=null;this.config=null;this.drag=null;this.destroyed=false;this.faces=[];this.projected=[];
      canvas.style.touchAction='none';canvas.style.cursor='grab';
      this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:e=>this.up(e),wheel:e=>this.wheel(e),contextmenu:e=>e.preventDefault()};
      for(const[k,fn]of Object.entries(this.handlers))canvas.addEventListener(k,fn,{passive:false});
      this.observer=typeof root.ResizeObserver==='function'?new root.ResizeObserver(()=>this.draw()):null;this.observer?.observe(canvas);
    }
    render(config){check(config?.result,'Landscape requires the shared transform result.');const n=config.result.times_s.length,m=config.result.frequencies_hz.length;check(Number.isInteger(config.row)&&config.row>=0&&config.row<m&&Number.isInteger(config.sample)&&config.sample>=0&&config.sample<n,'Landscape selection is outside the coefficient matrix.');if(this.geometry?.result!==config.result)this.geometry=makeGeometry(config.result);if(config.camera)this.camera=validateCamera(config.camera);this.config=config;this.draw();return this;}
    setCamera(camera){this.camera=validateCamera({...this.camera,...camera});this.draw();this.onCameraChange?.(this.getCamera());this.onCameraCommit?.(this.getCamera());return this;}
    getCamera(){return {...this.camera};}
    home(){return this.setCamera(defaultCamera);}
    fit(){const b=this.canvas.getBoundingClientRect(),w=Math.max(1,b.width||800),h=Math.max(1,b.height||340),dpr=Math.min(root.devicePixelRatio||1,2);if(w!==this.width||h!==this.height||dpr!==this.dpr){this.width=w;this.height=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}this.ctx.setTransform(dpr,0,0,dpr,0,0);}
    projector(){const c=this.camera,ca=Math.cos(c.yaw),sa=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch),scale=Math.min(this.width/10.6,this.height/7.5)*c.zoom,cx=this.width/2+c.panX,cy=this.height*.5+c.panY;return(x,y,z)=>{const xx=x*ca-y*sa,yy=x*sa+y*ca,zz=z-.8;return{x:cx+xx*scale,y:cy-(zz*cp-yy*sp)*scale,depth:yy*cp+zz*sp};};}
    line(points,color,width=1,dash=[]){const c=this.ctx;if(!points.length)return;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
    text(s,x,y,align='left',color='#526960',size=12){const c=this.ctx;c.font=`${size}px Segoe UI, system-ui, sans-serif`;c.textAlign=align;c.textBaseline='middle';c.fillStyle=color;c.fillText(s,x,y);}
    draw(){
      if(this.destroyed)return;this.fit();const c=this.ctx,w=this.width,h=this.height;c.clearRect(0,0,w,h);c.fillStyle='#f9fcf9';c.fillRect(0,0,w,h);if(!this.geometry||!this.config)return;
      const g=this.geometry,r=g.result,n=g.samples,m=g.rows,p=this.projector();this.projected=new Array(n*m);
      for(let id=0;id<n*m;id++)this.projected[id]=p(g.points[id*3],g.points[id*3+1],g.points[id*3+2]);
      c.beginPath();const floor=[p(-3.3,-2.2,0),p(3.3,-2.2,0),p(3.3,2.2,0),p(-3.3,2.2,0)];floor.forEach((v,i)=>i?c.lineTo(v.x,v.y):c.moveTo(v.x,v.y));c.closePath();c.fillStyle='#e9efea';c.fill();c.strokeStyle='#c8d5cc';c.stroke();
      const faces=[];for(let j=0;j<m-1;j++)for(let k=0;k<n-1;k++){const a=j*n+k,b=a+1,d=(j+1)*n+k,e=d+1;faces.push({ids:[a,b,e,d],depth:(this.projected[a].depth+this.projected[b].depth+this.projected[e].depth+this.projected[d].depth)/4,row:j,sample:k});}faces.sort((a,b)=>a.depth-b.depth);this.faces=faces;
      for(const f of faces){const ids=f.ids;c.beginPath();c.moveTo(this.projected[ids[0]].x,this.projected[ids[0]].y);for(let q=1;q<4;q++)c.lineTo(this.projected[ids[q]].x,this.projected[ids[q]].y);c.closePath();c.fillStyle=g.colors[ids[0]];c.fill();if(r.edge_affected[f.row][f.sample]){c.fillStyle='rgba(255,255,255,.25)';c.fill();}}
      const row=this.config.row,sample=this.config.sample;
      this.line(Array.from({length:n},(_,k)=>this.projected[row*n+k]),'rgba(255,255,255,.88)',1.25);
      this.line(Array.from({length:m},(_,j)=>this.projected[j*n+sample]),'rgba(255,236,207,.94)',1.6);
      const chosen=this.projected[row*n+sample];c.beginPath();c.arc(chosen.x,chosen.y,4.4,0,Math.PI*2);c.fillStyle='#cf315e';c.fill();c.strokeStyle='white';c.lineWidth=1.7;c.stroke();
      const t0=g.timeBounds[0],t1=g.timeBounds[1],f0=g.frequencyBounds[0],f1=g.frequencyBounds[1];
      for(let q=0;q<=4;q++){const u=-3.3+6.6*q/4,pt=p(u,-2.35,0);this.text(fmt(t0+(t1-t0)*q/4),pt.x,pt.y+9,'center');}
      for(const f of [4,8,16,32].filter(f=>f>=f0&&f<=f1)){const v=-2.2+4.4*Math.log(f/f0)/Math.log(f1/f0),pt=p(3.48,v,0);this.text(String(f),pt.x+5,pt.y,'left');}
      this.line([p(-3.55,-2.2,0),p(-3.55,-2.2,3.2)],'#9baca1',1);
      for(const q of [0,.5,1]){const pt=p(-3.55,-2.2,3.2*q);this.text(fmt(g.maximum*q),pt.x-5,pt.y,'right');}
      this.text('Magnitude |W|',15,15);this.text('Time (s) × log frequency (Hz)',w-15,w<460?33:15,'right');
      if(w<520){this.text('Drag orbit · Shift-drag pan',w/2,h-29,'center','#718279');this.text('Wheel zoom · Click a coefficient',w/2,h-13,'center','#718279');}
      else this.text('Drag orbit · Shift-drag pan · Wheel zoom · Click a coefficient',w/2,h-13,'center','#718279');
      this.canvas.dataset.selection=JSON.stringify({row,sample,time_s:r.times_s[sample],frequency_hz:r.frequencies_hz[row],magnitude:r.magnitude[row][sample]});
      this.canvas.dataset.camera=JSON.stringify(this.camera);
    }
    pick(x,y){
      if(!this.geometry)return null;let id=null;
      for(let q=this.faces.length-1;q>=0;q--){const f=this.faces[q],v=f.ids.map(i=>this.projected[i]);if(triangleContains(x,y,v[0],v[1],v[2])||triangleContains(x,y,v[0],v[2],v[3])){id=f.ids.reduce((best,i)=>Math.hypot(this.projected[i].x-x,this.projected[i].y-y)<Math.hypot(this.projected[best].x-x,this.projected[best].y-y)?i:best,f.ids[0]);break;}}
      if(id===null){let d=15;for(let i=0;i<this.projected.length;i++){const v=this.projected[i],distance=Math.hypot(v.x-x,v.y-y);if(distance<d){d=distance;id=i;}}}
      if(id===null)return null;return {row:Math.floor(id/this.geometry.samples),sample:id%this.geometry.samples};
    }
    down(e){if(e.button!==0&&e.button!==2)return;e.preventDefault();this.canvas.setPointerCapture?.(e.pointerId);this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,pan:e.shiftKey||e.button===2,moved:false};this.canvas.style.cursor='grabbing';}
    move(e){if(!this.drag)return;e.preventDefault();const d=this.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;d.moved ||= Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>3;if(d.pan){this.camera.panX+=dx;this.camera.panY+=dy;}else{this.camera.yaw+=dx*.008;this.camera.pitch=clamp(this.camera.pitch+dy*.007,...cameraLimits.pitch);}d.x=e.clientX;d.y=e.clientY;this.draw();this.onCameraChange?.(this.getCamera());}
    up(e){if(!this.drag)return;const d=this.drag;this.drag=null;this.canvas.style.cursor='grab';this.canvas.releasePointerCapture?.(e.pointerId);if(!d.moved&&e.type!=='pointercancel'){const b=this.canvas.getBoundingClientRect(),selected=this.pick(e.clientX-b.left,e.clientY-b.top);if(selected)this.onSelect?.(selected.row,selected.sample);}else this.onCameraCommit?.(this.getCamera());}
    wheel(e){e.preventDefault();this.camera.zoom=clamp(this.camera.zoom*Math.exp(-e.deltaY*.001),...cameraLimits.zoom);this.draw();this.onCameraChange?.(this.getCamera());if(this.wheelTimer)clearTimeout(this.wheelTimer);this.wheelTimer=setTimeout(()=>this.onCameraCommit?.(this.getCamera()),120);}
    manifest(){return this.config?renderingRecord(this.geometry.result,{camera:this.getCamera(),row:this.config.row,sample:this.config.sample,viewport:{width:this.width,height:this.height,pixel_ratio:this.dpr}}):null;}
    destroy(){this.destroyed=true;this.observer?.disconnect();for(const[k,fn]of Object.entries(this.handlers))this.canvas.removeEventListener(k,fn);if(this.wheelTimer)clearTimeout(this.wheelTimer);}
  }
  return Object.freeze({version,defaultCamera,cameraLimits,validateCamera,colorForMagnitude,makeGeometry,renderingRecord,Scene});
});
