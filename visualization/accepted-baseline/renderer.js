/* CANON visual instrument renderer v2.0.0
 * The caller supplies the versioned encoding, categories and spatial field.
 * This module owns projection, mesh sampling, camera, materials and drawing.
 * It does not partition source records or implement an analytical kernel.
 */
(() => {
  'use strict';
  const VERSION = 'state-body-renderer/2.0.0';
  const DEFAULT_CAMERA = Object.freeze({yaw:-0.68,pitch:0.69,zoom:1,panX:0,panY:0,projection:'orthographic'});
  const CLAMP = (x,a,b)=>Math.min(b,Math.max(a,x));
  const CAMERA_LIMITS=Object.freeze({pitch:Object.freeze({min:.02,max:Math.PI/2}),zoom:Object.freeze({min:.025,max:5}),projection:Object.freeze(['orthographic','perspective']),programmatic_behavior:'reject nonfinite or out-of-range values; never silently clamp',gesture_behavior:'pitch and zoom are clamped at the published limits'});
  const finite = (x,fallback)=>Number.isFinite(Number(x))?Number(x):fallback;
  const short = n => Number.isInteger(n) ? String(n) : Number(n).toFixed(2).replace(/0+$/,'').replace(/\.$/,'');
  const COL = {a:[65,156,144], b:[179,111,32], ink:'#264b4c', muted:'#708788', grid:'#d9e4e1',paper:'#f5f8f5'};
  function validateCamera(c){
    for(const key of['yaw','pitch','zoom','panX','panY'])if(typeof c?.[key]!=='number'||!Number.isFinite(c[key]))throw new Error('Camera '+key+' must be a finite number.');
    for(const key of['pitch','zoom'])if(c[key]<CAMERA_LIMITS[key].min||c[key]>CAMERA_LIMITS[key].max)throw new Error('Camera '+key+' is outside published bounds.');
    if(!CAMERA_LIMITS.projection.includes(c.projection))throw new Error('Unknown camera projection.');
    return {yaw:c.yaw,pitch:c.pitch,zoom:c.zoom,panX:c.panX,panY:c.panY,projection:c.projection};
  }
  function validateEncoding(e){
    if(!e||typeof e.id!=='string'||typeof e.version!=='string'||typeof e.kernelVersion!=='string'||typeof e.field!=='function'||!Array.isArray(e.categories)||!e.categories.length)throw new Error('A versioned encoding with categories and field() is required.');
    const seen=new Set();for(const c of e.categories){if(typeof c.key!=='string'||!c.key||seen.has(c.key)||typeof c.label!=='string'||!Number.isFinite(c.u)||!Number.isFinite(c.v))throw new Error('Encoding categories require unique keys, labels and finite display coordinates.');seen.add(c.key);}return e;
  }
  function lanesFor(e){return e.categories.map((_,i)=>e.categories.length===1?0:-2.4+4.8*i/(e.categories.length-1));}
  function calibrationFor(config){return {halfExtent:3.6,h:.6,valueGain:1.35,...config.calibration};}
  function fieldValue(e,u,v,weights,h){const value=e.field(u,v,weights,h);if(typeof value!=='number'||!Number.isFinite(value)||value<0)throw new Error('Encoding field() must return a finite nonnegative value.');return value;}
  function rounded(ctx,x,y,w,h,r=5){
    ctx.beginPath();ctx.moveTo(x+r,y);ctx.arcTo(x+w,y,x+w,y+h,r);ctx.arcTo(x+w,y+h,x,y+h,r);
    ctx.arcTo(x,y+h,x,y,r);ctx.arcTo(x,y,x+w,y,r);ctx.closePath();
  }
  function rgb(c,a=1){return `rgba(${c.map(Math.round).join(',')},${a})`;}
  function describe(config={},camera=DEFAULT_CAMERA,viewport=null){
    const e=config.encoding,calibration=calibrationFor(config),hist=config.history;
    const solo=config.mode==='soloA'||config.mode==='soloB'||config.mode==='side';
    return {renderer_version:VERSION,geometry:'sampled 3D height mesh projected to Canvas2D',
      encoding:e?{id:e.id,version:e.version,kernel_version:e.kernelVersion,categories:e.categories.map(c=>({...c})),field_authority:'supplied encoding.field(), no renderer analytical-kernel implementation',field_formula:e.fieldFormula||null}:null,
      coordinate_roles:config.perspective==='history'?{u:'categorical named lanes',v:'caller-supplied display_time_s on the shared time span',z:'native weight multiplied by shared history display gain'}:{u:'encoding-supplied display coordinate',v:'encoding-supplied display coordinate',z:'encoding.field() value multiplied by shared display gain'},
      calibration,exact_values:'supplied category weights are authoritative; rendered peaks are not exact category weights',
      finite_domain:{u:[-calibration.halfExtent,calibration.halfExtent],v:[-calibration.halfExtent,calibration.halfExtent],crop_semantics:e?.cropSemantics||'Field sampled only inside the declared square; outside values are not shown.'},
      mesh:{intervals_per_axis:52,vertices_per_axis:53,spatial_interpolation:'projected quadrilateral faces between field samples',temporal_interpolation:'none',surface_face_culling:'omit face only when all sampled vertex values < 0.004',wire_culling:'break wire where sampled value < 0.009'},
      geometry_cache:{key_fields:['encoding id','encoding version','kernel version','categories','field function identity','calibration','weights'],source_independent:true,reason:'identical deterministic spatial field inputs reuse geometry; source identities and provenance remain in caller records, never in the geometry cache'},
      contours:{levels:[.125,.25,.5,1,1.5,2,3,4,6,8,12],units:e?.fieldUnit||'supplied field units',algorithm:'linear marching squares at sampled field values',surface_offset:0.009},
      style:{mode:solo?'equal-material inspection':'distinguishable overlay',A:'teal filled surface',B:solo?'same teal filled surface':'amber wireframe and contours',solo_material:'same teal base color, fill opacity, lighting, contour and section style for A and B; labels carry identity',filled_opacity:'0.94 * (1 - exp(-mean_face_field_value / 0.11))',edge_opacity:'0.25 * the same decorative tail fade',opacity_purpose:'spatial near-zero fade, never uncertainty or probability',wire_opacity:.46,wire_stride_vertices:3,lighting:'fixed decorative diffuse light',contour_visibility:'contours drawn over surfaces; possible through-surface visibility is a presentation cue'},
      camera:{...camera},camera_limits:CAMERA_LIMITS,projection:{world_center_z:1.05,pixels_per_world_unit:'min(panel_width/10.6, panel_height/7.9) * camera.zoom',screen_center:'(panel_x + 0.5*width + panX, panel_y + 0.47*height + panY)',yaw:'xx=u*cos(yaw)-v*sin(yaw); yy=u*sin(yaw)+v*cos(yaw)',pitch:'screen_vertical=(z-1.05)*cos(pitch)-yy*sin(pitch)',depth:'yy*cos(pitch)+(z-1.05)*sin(pitch)',perspective_distance:12,perspective_multiplier:'12/max(3,12-depth); orthographic multiplier=1',pan_units:'CSS pixels',viewport},
      shared_calibration:'A and B share encoding, kernel, gains, camera and coordinate roles. Side panes have equal dimensions.',
      fit_policy:'Explicit Fit both only. Union of configured A+B, including hidden comparison in solo, plus reference plane, sampled geometry, axis and margin; changes only shared camera zoom/pan.',
      viewport_clipping:'Reported separately by Scene.getClippingStatus(); no per-frame normalization or automatic fit.',
      layer_choices:{surface:true,contours:true,exact:true,...config.layers},corner_legend:config.showLegend!==false,mode:config.mode||'overlay',perspective:config.perspective||'now',slice:config.slice||null,
      history:hist?{axis:hist.axis,span:hist.span,windows:hist.windows||hist.per_side_windows||null,countGain:hist.countGain??.42,lane_positions:e?lanesFor(e):[],depth_display_range:[-2.8,2.8],rendered_time_field:'display_time_s only',native_time_field:'time_s preserved by caller; never overwritten',carry_in:'row_kind=carry_in: caller-selected state at display_time_s=window start, shown as a dashed boundary without an event marker; native time remains explicit',per_side_records:Object.fromEntries(['a','b'].map(k=>[k.toUpperCase(),(hist[k]||[]).map(r=>({record_id:r.recordId||r.id,native_time_s:r.time_s,display_time_s:r.display_time_s,event_index:r.event_index,row_kind:r.row_kind||'event'}))])),state_between_events:'held between supplied ordered records only',same_time_events:'same display coordinate; event order retained',nowA:hist.nowA,nowB:hist.nowB}:null};
  }
  class Scene {
    constructor(canvas,{onCameraChange,onPick}={}){
      if(!canvas?.getContext)throw new Error('BodyRenderer.Scene requires a canvas.');
      this.canvas=canvas;this.ctx=canvas.getContext('2d');this.camera={...DEFAULT_CAMERA};this.config=null;
      this.onCameraChange=onCameraChange;this.onPick=onPick;this.labels=[];this.meshCache=new Map();
      this.width=0;this.height=0;this.drag=null;this.destroyed=false;
      canvas.style.touchAction='none';canvas.style.cursor='grab';
      this.handlers={pointerdown:e=>this.down(e),pointermove:e=>this.move(e),pointerup:e=>this.up(e),pointercancel:e=>this.up(e),wheel:e=>this.wheel(e),contextmenu:e=>e.preventDefault()};
      for(const [name,fn] of Object.entries(this.handlers))canvas.addEventListener(name,fn,{passive:false});
      this.resizeObserver=typeof ResizeObserver==='function'?new ResizeObserver(()=>this.draw()):null;
      this.resizeObserver?.observe(canvas);this.windowResize=()=>this.draw();window.addEventListener('resize',this.windowResize);
    }
    render(config){
      const encoding=validateEncoding(config.encoding),keys=new Set(encoding.categories.map(c=>c.key));
      const validateWeights=(weights,where)=>{for(const key of keys)if(typeof weights?.[key]!=='number'||!Number.isFinite(weights[key])||weights[key]<0)throw new Error(where+'.'+key+' requires an explicit finite nonnegative weight.');for(const key of Object.keys(weights||{}))if(!keys.has(key))throw new Error('Weight '+key+' is not declared by the selected encoding.');};
      for(const id of ['a','b'])if(config[id])validateWeights(config[id].weights,id);
      const cal=calibrationFor(config);for(const key of ['halfExtent','h','valueGain'])if(typeof cal[key]!=='number'||!Number.isFinite(cal[key])||cal[key]<=0)throw new Error('Calibration '+key+' must be positive.');
      if(config.history){const h=config.history;if(!Array.isArray(h.span)||h.span.length!==2||!h.span.every(Number.isFinite)||h.span[1]<h.span[0])throw new Error('History span must be a finite ordered pair.');if(h.countGain!==undefined&&(!(h.countGain>0)||!Number.isFinite(h.countGain)))throw new Error('History countGain must be positive.');for(const id of ['a','b'])for(const r of h[id]||[]){if(typeof r.display_time_s!=='number'||!Number.isFinite(r.display_time_s))throw new Error('History records require explicit display_time_s.');validateWeights(r.weights,'history '+id);}}
      const nextCamera=config.camera?this.cleanCamera({...this.camera,...config.camera}):this.getCamera();
      this.config=config;this.camera=nextCamera;this.draw();return this;
    }
    cleanCamera(c){return validateCamera(c);}
    setCamera(camera){this.camera=this.cleanCamera({...this.camera,...camera});this.draw();this.onCameraChange?.(this.getCamera());return this;}
    getCamera(){return {...this.camera};}
    categories(){return this.config.encoding.categories;}
    field(u,v,weights,h){return fieldValue(this.config.encoding,u,v,weights,h);}
    manifest(){return {...describe(this.config||{},this.getCamera(),{width:this.width,height:this.height,pixel_ratio:this.dpr}),actual_bounds:this.getClippingStatus(),last_shared_fit:this.lastFit||null};}
    home(){return this.setCamera(DEFAULT_CAMERA);}
    getClippingStatus(){
      if(!this.config)return {clipped:false,outOfFrame:false,reason:'No rendered configuration',panels:[]};
      const panels=this.config.mode==='side'&&this.config.b?[{id:'A',view:{x:0,y:0,w:this.width/2,h:this.height},ids:['A']},{id:'B',view:{x:this.width/2,y:0,w:this.width/2,h:this.height},ids:['B']}]:[{id:'shared',view:{x:0,y:0,w:this.width,h:this.height},ids:['A',...(this.config.b?['B']:[])]}];
      const reports=panels.map(panel=>{
        const p=this.projector(panel.view),groups=this.geometryGroups(panel.ids),results=[];
        for(const group of groups){const points=group.points.map(x=>p(...x)),b=this.bounds(points),v=panel.view;const overflow={left:Math.max(0,v.x-b.minX),right:Math.max(0,b.maxX-v.x-v.w),top:Math.max(0,v.y-b.minY),bottom:Math.max(0,b.maxY-v.y-v.h)};results.push({name:group.name,kind:group.kind,projected_bounds:b,overflow_px:overflow,clipped:Object.values(overflow).some(n=>n>.5)});}
        const all=results.flatMap(r=>[{x:r.projected_bounds.minX,y:r.projected_bounds.minY},{x:r.projected_bounds.maxX,y:r.projected_bounds.maxY}]);
        return {id:panel.id,viewport:panel.view,projected_bounds:this.bounds(all),groups:results,clipped:results.some(r=>r.clipped)};
      });
      const labels=this.labels.filter(l=>l.x<0||l.y<0||l.x+l.w>this.width||l.y+l.h>this.height).map(l=>l.key);
      const clipped=reports.some(p=>p.clipped)||labels.length>0;
      return {clipped,outOfFrame:clipped,mode:this.config.mode||'overlay',perspective:this.config.perspective||'now',scope:'configured A+B, including hidden solo comparison; side panels use their assigned body',panels:reports,clipped_labels:labels,finite_field_crop:calibrationFor(this.config).halfExtent,near_zero_render_culling:'See mesh manifest; viewport clipping is a separate issue.'};
    }
    fitBoth({margin=60}={}){
      if(!this.config)throw new Error('Render a configuration before fitting.');
      if(!Number.isFinite(margin)||margin<0)throw new Error('Fit margin must be nonnegative.');
      this.fit();const side=this.config.mode==='side'&&this.config.b,view={x:0,y:0,w:side?this.width/2:this.width,h:this.height};
      const base={...this.camera,zoom:1,panX:0,panY:0},p=this.projector(view,base);
      const groups=this.geometryGroups(['A',...(this.config.b?['B']:[])]),points=groups.flatMap(g=>g.points.map(x=>p(...x))),b=this.bounds(points);
      const actualMargin=Math.min(margin,view.w*.24,view.h*.24),availableW=Math.max(1,view.w-2*actualMargin),availableH=Math.max(1,view.h-2*actualMargin);
      const wanted=Math.min(availableW/Math.max(1e-9,b.maxX-b.minX),availableH/Math.max(1e-9,b.maxY-b.minY));
      const zoom=CLAMP(wanted,CAMERA_LIMITS.zoom.min,CAMERA_LIMITS.zoom.max),cx=view.w*.5,cy=view.h*.47;
      const panX=view.w/2-(cx+((b.minX+b.maxX)/2-cx)*zoom),panY=view.h/2-(cy+((b.minY+b.maxY)/2-cy)*zoom);
      this.camera=this.cleanCamera({...this.camera,zoom,panX,panY});
      this.lastFit={scope:'union of configured A and B even in solo',margin_requested_px:margin,margin_applied_px:actualMargin,viewport_per_panel:view,unit_zoom_union_bounds:b,requested_zoom:wanted,applied_zoom:zoom,limited_by_camera_bounds:zoom!==wanted,geometry_groups:groups.map(g=>g.name),changes:['shared camera zoom','shared camera panX','shared camera panY'],unchanged:['encoding','weights','kernel','calibration','source records','camera yaw','camera pitch','projection']};
      this.draw();this.onCameraChange?.(this.getCamera());return this.getClippingStatus();
    }
    bounds(points){if(!points.length)return {minX:0,minY:0,maxX:0,maxY:0};return {minX:Math.min(...points.map(p=>p.x)),minY:Math.min(...points.map(p=>p.y)),maxX:Math.max(...points.map(p=>p.x)),maxY:Math.max(...points.map(p=>p.y))};}
    geometryGroups(ids){
      const cfg=this.config,cal=calibrationFor(cfg),e=cal.halfExtent;
      const groups=[{name:'reference_plane',kind:'reference',points:[[-e,-e,0],[e,-e,0],[e,e,0],[-e,e,0]]}];
      if(cfg.perspective==='history'&&cfg.history){
        const h=cfg.history,min=h.span[0],max=h.span[1],range=Math.max(1e-9,max-min),lanes=lanesFor(cfg.encoding),gain=h.countGain??.42,depth=t=>-2.8+5.6*(t-min)/range;
        groups.push({name:'history_axes',kind:'reference',points:[[-3.25,2.8,0],[-3.25,2.8,8*gain],[-2.8,-3.12,0],[3,2.8,0]]});
        for(const id of ids){const list=h[id.toLowerCase()]||[],points=[];for(const r of list){if(r.display_time_s<min||r.display_time_s>max)continue;for(let k=0;k<lanes.length;k++){const z=r.weights[cfg.encoding.categories[k].key]*gain,v=depth(r.display_time_s);points.push([lanes[k]-.19,v,z],[lanes[k]+.19,v,z],[lanes[k],v,0]);}}if(points.length)groups.push({name:id,kind:'history',points});}
      }else{
        groups.push({name:'density_axis',kind:'reference',points:[[-e,-e,0],[-e,-e,3*cal.valueGain],[e+.22,0,0],[0,e+.2,0]]});
        for(const id of ids){const data=cfg[id.toLowerCase()];if(!data)continue;const mesh=this.mesh({data},cal),points=[];for(const row of mesh.rows)for(const v of row)points.push([v.u,v.v,v.z]);for(const c of cfg.encoding.categories)points.push([c.u,c.v,0],[c.u,c.v,this.field(c.u,c.v,data.weights,cal.h)*cal.valueGain]);groups.push({name:id,kind:'sampled_mesh',points});}
      }return groups;
    }
    destroy(){this.destroyed=true;this.resizeObserver?.disconnect();window.removeEventListener('resize',this.windowResize);for(const[n,f]of Object.entries(this.handlers))this.canvas.removeEventListener(n,f);}
    down(e){if(e.button!==0&&e.button!==2)return;e.preventDefault();this.canvas.setPointerCapture?.(e.pointerId);this.drag={x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,camera:this.getCamera(),pan:e.shiftKey||e.button===2,moved:false};this.canvas.style.cursor=this.drag.pan?'move':'grabbing';}
    move(e){if(!this.drag){const r=this.canvas.getBoundingClientRect();const hit=this.labels.find(l=>e.clientX-r.left>=l.x&&e.clientX-r.left<=l.x+l.w&&e.clientY-r.top>=l.y&&e.clientY-r.top<=l.y+l.h);this.canvas.style.cursor=hit?'pointer':'grab';return;}e.preventDefault();const d=this.drag,dx=e.clientX-d.x,dy=e.clientY-d.y;d.moved ||= Math.hypot(e.clientX-d.startX,e.clientY-d.startY)>3;if(d.pan){this.camera.panX+=dx;this.camera.panY+=dy;}else{this.camera.yaw+=dx*.008;this.camera.pitch=CLAMP(this.camera.pitch+dy*.007,CAMERA_LIMITS.pitch.min,CAMERA_LIMITS.pitch.max);}d.x=e.clientX;d.y=e.clientY;this.draw();this.onCameraChange?.(this.getCamera());}
    up(e){if(!this.drag)return;const d=this.drag;this.drag=null;this.canvas.style.cursor='grab';if(!d.moved){const r=this.canvas.getBoundingClientRect(),x=e.clientX-r.left,y=e.clientY-r.top;const hit=this.labels.find(l=>x>=l.x&&x<=l.x+l.w&&y>=l.y&&y<=l.y+l.h);if(hit)this.onPick?.({key:hit.key,body:hit.object==='B'?'B':'A',category:hit.key,object:hit.object,recordId:hit.recordId});}this.canvas.releasePointerCapture?.(e.pointerId);}
    wheel(e){e.preventDefault();this.camera.zoom=CLAMP(this.camera.zoom*Math.exp(-e.deltaY*.001),CAMERA_LIMITS.zoom.min,CAMERA_LIMITS.zoom.max);this.draw();this.onCameraChange?.(this.getCamera());}
    fit(){const box=this.canvas.getBoundingClientRect();const w=Math.max(1,box.width||this.canvas.clientWidth||900),h=Math.max(1,box.height||this.canvas.clientHeight||600);const dpr=Math.min(window.devicePixelRatio||1,2);if(this.width!==w||this.height!==h||this.dpr!==dpr){this.width=w;this.height=h;this.dpr=dpr;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);}this.ctx.setTransform(dpr,0,0,dpr,0,0);}
    projector(view,camera=this.camera){const c=camera,ca=Math.cos(c.yaw),sa=Math.sin(c.yaw),cp=Math.cos(c.pitch),sp=Math.sin(c.pitch);const scale=Math.min(view.w/10.6,view.h/7.9)*c.zoom;const cx=view.x+view.w*.5+c.panX,cy=view.y+view.h*.47+c.panY;return (u,v,z=0)=>{const xx=u*ca-v*sa,yy=u*sa+v*ca,zz=z-1.05;const sy=zz*cp-yy*sp,depth=yy*cp+zz*sp;const perspective=c.projection==='perspective'?12/Math.max(3,12-depth):1;return {x:cx+xx*scale*perspective,y:cy-sy*scale*perspective,depth,scale:scale*perspective};};}
    poly(points,{fill,stroke,width=1,dash}={}){if(!points.length)return;const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.closePath();if(fill){c.fillStyle=fill;c.fill();}if(stroke){c.strokeStyle=stroke;c.lineWidth=width;c.setLineDash(dash||[]);c.stroke();c.setLineDash([]);}}
    line(points,color,width=1,dash=[]){if(!points.length)return;const c=this.ctx;c.beginPath();c.moveTo(points[0].x,points[0].y);for(let i=1;i<points.length;i++)c.lineTo(points[i].x,points[i].y);c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);}
    text(text,x,y,{size=11,color=COL.muted,align='left',weight=400}={}){const c=this.ctx;c.font=`${weight} ${size}px system-ui, -apple-system, Segoe UI, sans-serif`;c.fillStyle=color;c.textAlign=align;c.textBaseline='middle';c.fillText(text,x,y);}
    draw(){if(this.destroyed)return;this.fit();const c=this.ctx,w=this.width,h=this.height;c.clearRect(0,0,w,h);const gradient=c.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#fbfcf9');gradient.addColorStop(1,'#edf3ef');c.fillStyle=gradient;c.fillRect(0,0,w,h);this.labels=[];if(!this.config)return;
      const cfg=this.config;
      if(cfg.mode==='side'&&cfg.b){this.scene({x:0,y:0,w:w/2,h},{...cfg,mode:'soloA',b:null},'A');this.scene({x:w/2,y:0,w:w/2,h},{...cfg,mode:'soloB',a:null},'B');this.line([{x:w/2,y:24},{x:w/2,y:h-24}],'#d6e1dd',1);}
      else this.scene({x:0,y:0,w,h},cfg,null);
      this.text('DRAG orbit  ·  SHIFT + DRAG pan  ·  WHEEL zoom',w/2,h-15,{size:10,color:'#829390',align:'center'});
    }
    scene(view,cfg,side){const ctx=this.ctx;ctx.save();ctx.beginPath();ctx.rect(view.x,view.y,view.w,view.h);ctx.clip();const p=this.projector(view),cal=calibrationFor(cfg),layers={surface:true,contours:true,exact:true,...cfg.layers};this.floor(p,cal,view,cfg.perspective!=='history');
      const objects=[];if(cfg.a&&cfg.mode!=='soloB')objects.push({data:cfg.a,id:'A',style:'surface',color:COL.a});if(cfg.b&&cfg.mode!=='soloA')objects.push({data:cfg.b,id:'B',style:cfg.mode==='overlay'?'wire':'surface',color:cfg.mode==='overlay'?COL.b:COL.a});
      if(cfg.perspective==='history'&&cfg.history){this.history(p,cfg,objects,cal,layers,view);}else{
        if(layers.surface)for(const o of objects)if(o.style==='surface')this.surface(p,o,cal);
        if(layers.contours)for(const o of objects)if(o.style==='wire')this.wire(p,o,cal);
        if(layers.contours)for(const o of objects)this.contours(p,o,cal);
        if(cfg.slice&&cfg.slice.visible!==false)this.slice(p,cfg.slice,objects,cal);
        if(layers.exact)this.exact(p,objects,cal,view);
        this.axes(p,cal,view,cfg.showLegend!==false);
      }
      if(side)this.text(`${side}  ${side==='A'?cfg.a?.label||'Primary':cfg.b?.label||'Comparison'}`,view.x+24,view.y+27,{size:12,color:side==='A'?'#28776d':'#9b6222',weight:650});
      ctx.restore();
    }
    floor(p,cal,view,anchors=true){const e=cal.halfExtent;this.poly([p(-e,-e),p(e,-e),p(e,e),p(-e,e)],{fill:'#edf2ec',stroke:'#d0ded8',width:1});for(let t=-3;t<=3;t++){this.line([p(t,-e),p(t,e)],t===0?'#c0d0c9':'#d8e2da',t===0?1.1:.7);this.line([p(-e,t),p(e,t)],t===0?'#c0d0c9':'#d8e2da',t===0?1.1:.7);}if(anchors)for(const a of this.categories()){const q=p(a.u,a.v);this.ctx.beginPath();this.ctx.arc(q.x,q.y,3,0,Math.PI*2);this.ctx.fillStyle='#8fa9a0';this.ctx.fill();}}
    axes(p,cal,view,showLegend=true){const e=cal.halfExtent;const u=p(e+.22,0),v=p(0,e+.2);this.text('u',u.x,u.y,{size:12,weight:650,color:'#738d83',align:'center'});this.text('v',v.x,v.y,{size:12,weight:650,color:'#738d83',align:'center'});const x=-e,y=-e;this.line([p(x,y,0),p(x,y,3*cal.valueGain)],'#a7bbb2',1);for(const f of[0,1,2,3]){const q=p(x,y,f*cal.valueGain);const r=p(x+.07,y,f*cal.valueGain);this.line([q,r],'#8fa89c',1);this.text(String(f),CLAMP(q.x-7,view.x+15,view.x+view.w-10),q.y,{size:10,align:'right',color:'#7e9489'});}const top=p(x,y,0);this.text('jobs / area',CLAMP(top.x,view.x+34,view.x+view.w-34),top.y+15,{size:9,color:'#7e9489',align:'center'});if(showLegend){this.text('height = supplied field × display gain',view.x+18,view.y+17,{size:10,color:'#8a9b91'});this.text('u / v: categorical display coordinates',view.x+18,view.y+34,{size:10,color:'#8a9b91'});}}
    mesh(o,cal){const encoding=this.config.encoding;if(!this.fieldIds){this.fieldIds=new WeakMap();this.nextFieldId=1;}if(!this.fieldIds.has(encoding.field))this.fieldIds.set(encoding.field,this.nextFieldId++);const key=JSON.stringify([encoding.id,encoding.version,encoding.kernelVersion,encoding.categories,this.fieldIds.get(encoding.field),cal,o.data.weights]);if(this.meshCache.has(key))return this.meshCache.get(key);const e=cal.halfExtent,N=52,step=2*e/N,rows=[];for(let i=0;i<=N;i++){const row=[];for(let j=0;j<=N;j++){const u=-e+j*step,v=-e+i*step,F=this.field(u,v,o.data.weights,cal.h);row.push({u,v,F,z:F*cal.valueGain});}rows.push(row);}const result={rows,N,step};this.meshCache.set(key,result);if(this.meshCache.size>24)this.meshCache.delete(this.meshCache.keys().next().value);return result;}
    surface(p,o,cal){const{rows,N,step}=this.mesh(o,cal),quads=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++){const verts=[rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]],max=Math.max(...verts.map(v=>v.F));if(max<.004)continue;const ps=verts.map(v=>p(v.u,v.v,v.z));const dzdu=(verts[1].z+verts[2].z-verts[0].z-verts[3].z)/(2*step),dzdv=(verts[2].z+verts[3].z-verts[0].z-verts[1].z)/(2*step);const norm=Math.hypot(dzdu,dzdv,1),light=CLAMP((-dzdu*.36-dzdv*.42+.83)/norm,.03,1);const shade=.62+light*.38;const color=o.color.map((v,k)=>v*shade+(k===0?35:46));const density=verts.reduce((s,v)=>s+v.F,0)/4,fade=1-Math.exp(-density/.11);quads.push({ps,depth:ps.reduce((s,v)=>s+v.depth,0)/4,color,fade});}quads.sort((a,b)=>a.depth-b.depth);for(const q of quads)this.poly(q.ps,{fill:rgb(q.color,.94*q.fade),stroke:rgb(q.color,.25*q.fade),width:.42});}
    wire(p,o,cal){const{rows,N}=this.mesh(o,cal);for(let axis=0;axis<2;axis++)for(let i=0;i<=N;i+=3){let pts=[];for(let j=0;j<=N;j++){const v=axis?rows[j][i]:rows[i][j];if(v.F<.009){if(pts.length>1)this.line(pts,rgb(o.color,.46),.85);pts=[];}else pts.push(p(v.u,v.v,v.z));}if(pts.length>1)this.line(pts,rgb(o.color,.46),.85);} }
    contours(p,o,cal){const{rows,N}=this.mesh(o,cal);const levels=[.125,.25,.5,1,1.5,2,3,4,6,8,12];for(const level of levels){const lines=[];for(let i=0;i<N;i++)for(let j=0;j<N;j++){const v=[rows[i][j],rows[i][j+1],rows[i+1][j+1],rows[i+1][j]],cross=[];for(let e=0;e<4;e++){const a=v[e],b=v[(e+1)%4];if((a.F<level&&b.F>=level)||(b.F<level&&a.F>=level)){const t=(level-a.F)/(b.F-a.F);cross.push(p(a.u+t*(b.u-a.u),a.v+t*(b.v-a.v),level*cal.valueGain+.009));}}if(cross.length>=2)lines.push([cross[0],cross[1]]);if(cross.length===4)lines.push([cross[2],cross[3]]);}const ctx=this.ctx;ctx.beginPath();for(const[a,b]of lines){ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);}ctx.strokeStyle=o.style==='surface'?'rgba(29,105,99,.24)':'rgba(164,99,25,.82)';ctx.lineWidth=o.style==='surface'?.75:1.05;ctx.stroke();}}
    exact(p,objects,cal,view){if(!objects.length)return;const center=p(0,0);const nodes=this.categories().map(a=>{const q=p(a.u,a.v),f=objects.reduce((n,o)=>Math.max(n,this.field(a.u,a.v,o.data.weights,cal.h)),0),top=p(a.u,a.v,f*cal.valueGain);return {a,q,top,depth:q.depth};}).sort((a,b)=>a.depth-b.depth);for(const{a,q,top}of nodes){this.line([q,top],'rgba(44,100,88,.34)',1,[2,3]);this.ctx.beginPath();this.ctx.arc(q.x,q.y,4.3,0,Math.PI*2);this.ctx.fillStyle='#f8fcf8';this.ctx.fill();this.ctx.strokeStyle='#608e80';this.ctx.lineWidth=1.4;this.ctx.stroke();const dx=q.x-center.x,dy=q.y-center.y,len=Math.max(1,Math.hypot(dx,dy));const sign=dx>=0?1:-1;const textA=objects.map(o=>`${o.id} ${short(Number(o.data.weights?.[a.key]||0))}`).join('   ');const boxW=Math.max(100,28+textA.length*7),boxH=44;let x=q.x+dx/len*20+(sign>0?0:-boxW),y=q.y+dy/len*14-boxH/2;x=CLAMP(x,view.x+8,view.x+view.w-boxW-8);y=CLAMP(y,view.y+50,view.y+view.h-boxH-36);this.line([q,{x:sign>0?x:x+boxW,y:y+boxH/2}],'#a9bfb3',.8);this.ctx.shadowColor='rgba(48,73,62,.09)';this.ctx.shadowBlur=9;this.ctx.shadowOffsetY=3;rounded(this.ctx,x,y,boxW,boxH,7);this.ctx.fillStyle='rgba(253,255,250,.96)';this.ctx.fill();this.ctx.shadowBlur=0;this.ctx.shadowOffsetY=0;this.ctx.strokeStyle='#cfded4';this.ctx.lineWidth=.8;this.ctx.stroke();this.text(a.label.toUpperCase(),x+10,y+12,{size:9,color:'#71867a',weight:650});let cx=x+10;for(const o of objects){const t=`${o.id} ${short(Number(o.data.weights?.[a.key]||0))}`;this.text(t,cx,y+29,{size:14,color:o.id==='A'?'#246b62':'#9b641f',weight:650});cx+=t.length*8+14;}this.labels.push({x,y,w:boxW,h:boxH,key:a.key,object:objects.length===1?objects[0].id:'both',recordId:objects.map(o=>o.data.recordId)});}}
    slice(p,slice,objects,cal){const axis=slice.axis==='v'?'v':'u',offset=finite(slice.offset,0),e=cal.halfExtent;const a=axis==='u'?p(-e,offset):p(offset,-e),b=axis==='u'?p(e,offset):p(offset,e);this.line([a,b],'rgba(107,110,142,.40)',1,[4,4]);for(const o of objects){const pts=[];for(let j=0;j<=144;j++){const t=-e+2*e*j/144,u=axis==='u'?t:offset,v=axis==='u'?offset:t;pts.push(p(u,v,this.field(u,v,o.data.weights,cal.h)*cal.valueGain+.017));}this.line(pts,o.style==='surface'?'rgba(49,78,112,.60)':'rgba(193,103,27,.75)',1.4,[3,3]);}}
    history(p,cfg,objects,cal,layers,view){
      const hist=cfg.history,span=hist.span||[0,1],min=Number(span[0]),max=Number(span[1]);
      const width=Math.max(1e-9,max-min),lanes=lanesFor(cfg.encoding);
      const time=r=>r.display_time_s;
      const depth=t=>-2.8+5.6*(t-min)/width,gain=hist.countGain??.42;
      const jobs=objects.map(o=>({o,list:(o.id==='A'?hist.a:hist.b)||[]}));
      const quads=[],edges=[],ribs=[];
      for(const{o,list}of jobs){
        for(let k=0;k<cfg.encoding.categories.length;k++){
          const key=cfg.encoding.categories[k].key,u=lanes[k];
          for(let i=0;i<list.length;i++){
            const r=list[i],t=time(r),z=Number(r.weights[key])*gain;
            if(t>=min&&t<=max)ribs.push({o,carry:r.row_kind==='carry_in',points:[p(u,depth(t),0),p(u,depth(t),z)]});
            if(i+1<list.length){
              const next=list[i+1],nextTime=time(next),t1=Math.max(min,t),t2=Math.min(max,nextTime);
              if(t2>t1){
                const pts=[p(u-.19,depth(t1),z),p(u+.19,depth(t1),z),p(u+.19,depth(t2),z),p(u-.19,depth(t2),z)];
                quads.push({pts,o,depth:pts.reduce((s,x)=>s+x.depth,0)/4});
                edges.push({o,points:[p(u,depth(t1),z),p(u,depth(t2),z)]});
              }
              if(nextTime>=min&&nextTime<=max&&nextTime>=t){
                const z2=Number(next.weights[key])*gain;
                edges.push({o,points:[p(u,depth(nextTime),z),p(u,depth(nextTime),z2)]});
              }
            }
          }
        }
      }
      quads.sort((a,b)=>a.depth-b.depth);
      if(layers.surface)for(const q of quads)this.poly(q.pts,{fill:rgb(q.o.color,q.o.style==='surface'?.35:.09),stroke:rgb(q.o.color,.55),width:.65});
      for(const x of edges)this.line(x.points,rgb(x.o.color,.78),1.5);
      for(const x of ribs){this.line(x.points,rgb(x.o.color,.58),1.15,x.carry?[3,3]:[]);if(!x.carry){const end=x.points[1];this.ctx.beginPath();this.ctx.arc(end.x,end.y,2.6,0,2*Math.PI);this.ctx.fillStyle=rgb(x.o.color,.92);this.ctx.fill();}}
      for(let k=0;k<cfg.encoding.categories.length;k++){const q=p(lanes[k],-3.12);this.text(cfg.encoding.categories[k].label,q.x,q.y,{size:10,color:'#4f6b60',align:'center',weight:600});}
      for(const{o,list}of jobs){
        const byTime=new Map();
        for(const r of list){const t=time(r);if(t<min||t>max)continue;if(!byTime.has(t))byTime.set(t,[]);byTime.get(t).push(r);}
        for(const[t,records]of byTime){
          const v=depth(t);this.line([p(-2.8,v),p(2.8,v)],rgb(o.color,.2),.7,[2,3]);
          const carry=records.find(r=>r.row_kind==='carry_in'),events=records.filter(r=>r.row_kind!=='carry_in');
          if(carry){const q=p(-3.05,v);this.text(`${o.id} carry from ${short(carry.time_s)} native s`,q.x-7,q.y+(o.id==='B'?13:0),{size:9,color:rgb(o.color,.9),align:'right'});}
          if(events.length>1){const q=p(-3.05,v);this.text(`${o.id} events ${events.map(r=>r.event_index).join(' → ')}`,q.x-7,q.y+(o.id==='B'?13:0)+(carry?13:0),{size:9,color:rgb(o.color,.9),align:'right'});}
        }
        const now=Number(o.id==='A'?hist.nowA:hist.nowB);
        if(Number.isFinite(now)&&now>=min&&now<=max){const v=depth(now);this.line([p(-2.9,v),p(2.9,v)],rgb(o.color,.85),2.2);const q=p(2.95,v);this.text(`${o.id} NOW`,q.x+8,q.y-13,{size:10,color:rgb(o.color,1),weight:650});}
      }
      this.line([p(-3.25,2.8,0),p(-3.25,2.8,8*gain)],'#a4b7ac',1);
      for(const n of[0,2,4,6,8]){const q=p(-3.25,2.8,n*gain);this.text(String(n),q.x-7,q.y,{size:10,color:'#738b7b',align:'right'});}
      if(cfg.showLegend!==false)this.text(`history · ${hist.axis==='aligned'?'aligned':'native'} seconds along depth · native category weight vertically`,view.x+18,view.y+18,{size:10,color:'#72887a'});
      for(const t of [...new Set([min,(min+max)/2,max])]){const q=p(3,depth(t));this.text(`${short(t)} s`,q.x,q.y,{size:10,color:'#72887a'});}
      if(cfg.showLegend!==false)this.text('Event ribs; states held only between supplied ordered records.',view.x+18,view.y+35,{size:10,color:'#8a9b91'});
    }
  }
  const api=Object.freeze({Scene,defaultCamera:{...DEFAULT_CAMERA},cameraLimits:CAMERA_LIMITS,validateCamera,describe,version:VERSION});
  if(typeof module==='object'&&module.exports)module.exports=api;
  if(typeof window!=='undefined')window.BodyRenderer=api;
})();
