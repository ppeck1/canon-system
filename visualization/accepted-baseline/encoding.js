/* A named spatial encoding; it consumes domain weights, not queue source facts. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.SpatialEncoding=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const version='spatial-encoding/1',encodingVersion='required-work-disposition-gaussian/1',mappingVersion='required-work-disposition/1',kernelVersion='normalized-isotropic-gaussian-count-density/1';
  const categories=Object.freeze([
    Object.freeze({key:'ready',label:'Ready',u:-1.2,v:-1.1}),Object.freeze({key:'backup_only',label:'Backup only',u:1.2,v:-1.1}),
    Object.freeze({key:'absent',label:'Absent',u:1.2,v:1.1}),Object.freeze({key:'completed',label:'Completed',u:-1.2,v:1.1})]);
  const defaultBounds=Object.freeze([-3.6,3.6,-3.6,3.6]);
  function invariant(ok,message){if(!ok)throw new Error(message);}
  function validateWeights(weights) {
    invariant(weights && typeof weights==='object', 'Category weights required');
    for (const k of categories) invariant(Number.isFinite(weights[k.key]) && weights[k.key]>=0, 'Finite nonnegative count required: '+k.key);
  }
  function validateWidth(h) { invariant(Number.isFinite(h) && h>0, 'Kernel width must be finite and positive'); }
  function field(u,v,weights,h) {
    invariant(Number.isFinite(u) && Number.isFinite(v), 'Finite display coordinates required');
    validateWeights(weights); validateWidth(h);
    let density=0;
    for (const k of categories) density+=weights[k.key]*Math.exp(-((u-k.u)**2+(v-k.v)**2)/(2*h*h))/(2*Math.PI*h*h);
    return density;
  }
  // Abramowitz-Stegun 7.1.26: max absolute erf error <= 1.5e-7.
  // Exact Gaussian integral formula below uses this declared numerical approximation.
  function erf(x) {
    if (x===0) return 0;
    if (x===Infinity) return 1;
    if (x===-Infinity) return -1;
    invariant(Number.isFinite(x), 'Finite erf input required');
    const sign=x<0?-1:1, a=Math.abs(x), t=1/(1+0.3275911*a);
    const p=(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-0.284496736)*t+0.254829592)*t;
    return sign*(1-p*Math.exp(-a*a));
  }
  function normalizedBounds(bounds) {
    // Array [uMin,uMax,vMin,vMax], or symmetric square [min,max].
    const b=Array.isArray(bounds) ? (bounds.length===2?[bounds[0],bounds[1],bounds[0],bounds[1]]:bounds.slice()) : defaultBounds.slice();
    invariant(b.length===4 && b.every(Number.isFinite) && b[0]<b[1] && b[2]<b[3], 'Crop bounds require [uMin,uMax,vMin,vMax]');
    return b;
  }
  function cropMass(weights,h,bounds=defaultBounds) {
    validateWeights(weights); validateWidth(h);
    const b=normalizedBounds(bounds), d=Math.SQRT2*h;
    return categories.reduce((sum,k)=>sum+weights[k.key]*
      .5*(erf((b[1]-k.u)/d)-erf((b[0]-k.u)/d))*
      .5*(erf((b[3]-k.v)/d)-erf((b[2]-k.v)/d)),0);
  }
  function cropInfo(weights,h,bounds=defaultBounds) {
    const total=categories.reduce((sum,k)=>sum+weights[k.key],0), inside=cropMass(weights,h,bounds);
    return {bounds:normalizedBounds(bounds),total_exact_count:total,inside_mass_approx:inside,
      outside_mass_approx:total-inside,inside_fraction:total?inside/total:null,
      numerical_method:'separable Gaussian rectangle integral; erf approximation AS 7.1.26',
      absolute_error_bound:total*(3e-7+2.25e-14),
      authoritative_quantity:'exact partition counts, never cropped volume or peak height'};
  }

  function contract({inputRef=null,weights,h,bounds=defaultBounds,gain=1}={}) {
    validateWeights(weights);validateWidth(h);invariant(Number.isFinite(gain)&&gain>0,'Positive shared height gain required');
    return {id:encodingVersion,implementation_version:version,kernel_version:kernelVersion,
      input_refs:inputRef?[inputRef]:[],output_ref:{kind:'spatial_field',encoding_version:encodingVersion,input_ref:inputRef},
      parameters:{categories:categories.map(c=>({...c})),h,bounds:normalizedBounds(bounds),shared_height_gain:gain},
      composition:['consume exact category weights','normalized Gaussian kernels at fixed categorical anchors','sum kernels','crop finite display area','shared explicit height gain'],
      preconditions:['finite nonnegative count weights for named preset categories','finite positive spatial kernel width','identical calibration for overlaid bodies'],
      missing_value_behavior:'reject absent/nonfinite weights; never replace missing data by zero',
      units:{u:'artificial categorical display length',v:'artificial categorical display length',height:'required identity count per artificial display area times shared height gain'},
      uncertainty_effect:'none; softness/opacity is not probability or uncertainty',
      reversibility:{status:'lossy_visual_encoding',reason:'Finite samples/crop and superposed kernels do not promise recovery of category membership or all source facts.',source_recoverability:'exact weights, identities and source records remain independent of geometry'},
      crop:cropInfo(weights,h,bounds),
      known_limitations:['Artificial positions are not physical topology','No temporal smoothing or new states','Neither a probability model nor a universal CANON coordinate system']};
  }
  return Object.freeze({version,encodingVersion,mappingVersion,kernelVersion,categories,defaultBounds,field,cropMass,cropInfo,erf,contract});
});
