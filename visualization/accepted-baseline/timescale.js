/* Bounded synthetic calibration CWT. Queue events and Gaussian geometry are not inputs. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.CanonTimescale=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const contractVersion='calibration-cwt/1';
  const implementationVersion='cmor-sampled-convolution/1';
  const sourceRevision='calibration-signals/1';
  const sampleRate=128, sourceCount=1024, bandwidth=1.5, center=1, scaleCount=48;
  const descriptors={
    chirp:{title:'Synthetic rising-frequency signal',equation:'x(t) = sin(2*pi*(6*t + 1.25*t*t))',structure:'Instantaneous frequency = 6 + 2.5*t Hz',fn:t=>Math.sin(2*Math.PI*(6*t+1.25*t*t))},
    sinusoid:{title:'Synthetic 12 Hz sine wave',equation:'x(t) = sin(2*pi*12*t)',structure:'12 Hz, unit amplitude',fn:t=>Math.sin(2*Math.PI*12*t)},
    constant:{title:'Synthetic constant signal',equation:'x(t) = 1',structure:'No changing component',fn:()=>1}
  };
  const frequencies=Array.from({length:scaleCount},(_,j)=>4*Math.pow(8,j/(scaleCount-1)));
  const scales=frequencies.map(f=>center*sampleRate/f);
  const kernels=scales.map(a=>{
    const radius=Math.floor(8*a),re=[],im=[],normalizer=1/Math.sqrt(Math.PI*bandwidth*a);
    for(let d=-radius;d<=radius;d++){
      const u=d/a,envelope=normalizer*Math.exp(-u*u/bandwidth),phase=2*Math.PI*center*u;
      re.push(envelope*Math.cos(phase));im.push(-envelope*Math.sin(phase));
    }
    return {radius,re,im};
  });
  function invariant(ok,message){if(!ok)throw new Error(message);}
  function makeCalibration(kind){
    invariant(Object.prototype.hasOwnProperty.call(descriptors,kind),'Unsupported calibration signal: '+kind);
    const d=descriptors[kind],times=Array.from({length:sourceCount},(_,n)=>n/sampleRate);
    return {id:kind,title:d.title,source_kind:'synthetic_calibration',source_revision:sourceRevision,channel_id:'calibration_amplitude',units:'dimensionless calibration amplitude',equation:d.equation,known_structure:d.structure,sample_rate_hz:sampleRate,sample_spacing_s:1/sampleRate,acquisition_interval_s:[0,8],missingness:'none',random_seed:'not_applicable',times_s:times,values:times.map(d.fn)};
  }
  function eligibility(source){
    if(!source||source.source_kind!=='synthetic_calibration')return {available:false,reason:'This view needs a sampled numeric signal with supported scales. This case contains a short event history. Use Over time / Relationship, or open the labeled calibration signal.'};
    if(!Object.prototype.hasOwnProperty.call(descriptors,source.id)||source.source_revision!==sourceRevision)return {available:false,reason:'Unsupported calibration signal or source revision. Open a supported labeled calibration signal.'};
    return {available:true,reason:null};
  }
  function analyze(signal,options){
    const eligible=eligibility(signal);invariant(eligible.available,eligible.reason);
    const cfg=options||{},allowed=new Set(['mode','asOfIndex','contractVersion']);
    invariant(Object.keys(cfg).every(k=>allowed.has(k)),'Unsupported calibration transform option');
    invariant(cfg.contractVersion===undefined||cfg.contractVersion===contractVersion,'Unsupported calibration transform version');
    const mode=cfg.mode||'retrospective';invariant(mode==='retrospective'||mode==='prefix','Unsupported calibration transform mode');
    invariant(Array.isArray(signal.times_s)&&Array.isArray(signal.values)&&signal.times_s.length===sourceCount&&signal.values.length===sourceCount,'Calibration requires 1024 paired native timestamps and values');
    invariant(signal.sample_rate_hz===sampleRate&&signal.sample_spacing_s===1/sampleRate,'Unsupported calibration sampling contract');
    const last=mode==='prefix'?cfg.asOfIndex:sourceCount-1;
    invariant(Number.isInteger(last)&&last>=63&&last<sourceCount,'Prefix endpoint must be an inclusive sample index from 63 through 1023');
    // Slice before validation and convolution: future sample values are not read in prefix mode.
    const times=signal.times_s.slice(0,last+1),values=signal.values.slice(0,last+1),n=values.length,dt=1/sampleRate;
    for(let i=0;i<n;i++){
      invariant(Number.isFinite(times[i])&&Number.isFinite(values[i]),'Missing or nonfinite selected calibration sample at index '+i);
      invariant(Math.abs(times[i]-i*dt)<=Math.max(1e-12,dt*1e-9),'Calibration timestamps must retain native uniform spacing and origin');
      if(i)invariant(times[i]>times[i-1]&&Math.abs(times[i]-times[i-1]-dt)<=Math.max(1e-12,dt*1e-9),'Duplicate, unordered, or irregular calibration timestamps');
    }
    const real=[],imag=[],magnitude=[],edgeAffected=[];let maximum=0;
    for(let j=0;j<scaleCount;j++){
      const k=kernels[j],r=k.radius,realRow=new Array(n),imagRow=new Array(n),magRow=new Array(n),edgeRow=new Array(n),edgeRadius=Math.sqrt(bandwidth)*scales[j];
      for(let b=0;b<n;b++){
        let re=0,im=0;const low=Math.max(-r,-b),high=Math.min(r,n-1-b);
        for(let d=low;d<=high;d++){const x=values[b+d],q=d+r;re+=x*k.re[q];im+=x*k.im[q];}
        const mag=Math.hypot(re,im);realRow[b]=re;imagRow[b]=im;magRow[b]=mag;edgeRow[b]=Math.min(b,n-1-b)<edgeRadius;if(mag>maximum)maximum=mag;
      }
      real.push(realRow);imag.push(imagRow);magnitude.push(magRow);edgeAffected.push(edgeRow);
    }
    return {
      contract_version:contractVersion,implementation_version:implementationVersion,signal_id:signal.id,title:signal.title,
      source:{id:signal.id,kind:signal.source_kind,revision:signal.source_revision,channel_id:signal.channel_id,equation:signal.equation,known_structure:signal.known_structure,random_seed:'not_applicable'},
      sampling:{sample_rate_hz:sampleRate,sample_spacing_s:dt,count:n,source_count:sourceCount,missingness:'none',resampling:'none',anti_aliasing:'none applied; analytic calibration sampled at declared rate'},
      mode,as_of_index:mode==='prefix'?last:null,times_s:times,values,
      frequencies_hz:frequencies.slice(),scales:scales.slice(),real,imag,magnitude,edge_affected:edgeAffected,
      wavelet:{name:'cmor1.5-1.0',family:'complex Morlet',bandwidth,center_frequency:center,scale_unit:'samples',scale_frequency_conversion:'frequency_hz = center_frequency / (scale * sample_spacing_s)'},
      normalization:'sample-normalized discrete sum: sum(x[n] * conjugate(psi((n-b)/a))) / sqrt(a); no dt factor',
      units:{time:'s',frequency:'Hz',signal:'dimensionless calibration amplitude',coefficient:'sample-normalized calibration units',display:'complex coefficient magnitude'},
      interval:{first_sample_index:0,last_sample_index:last,start_s:times[0],end_sample_s:times[n-1],sample_bin_end_exclusive_s:times[n-1]+dt,source_acquisition_interval_s:[0,8]},
      support_policy:{kernel_support_normalized:[-8,8],integer_radius:'floor(8*scale)',padding:'zero',preprocessing:'none',detrending:'none',edge_radius:'sqrt(bandwidth)*scale samples; amplitude envelope 1/e convention',edge_is_significance_test:false,centered:true,future_samples_permitted:mode==='retrospective'?'up to the full record end':'only up to the selected as-of endpoint'},
      display:{magnitude_min:0,magnitude_max:maximum,magnitude_label:'CWT coefficient magnitude (sample-normalized calibration units)',color_bounds_basis:'permitted transform result; share bounds for like-for-like comparisons',frequency_axis:'logarithmic; center-frequency labels'},
      limitations:['Synthetic calibration only; not queue evidence or CANON efficacy','Magnitude omits complex phase; finite scales omit other frequencies','Zero extension, finite kernel support, and sampling affect the result','Edge overlay is a convention, not a significance or reliability guarantee','Centered coefficients use a supporting window; prefix mode is not a causal streaming filter','No generic inverse or exact ridge recovery claim']
    };
  }
  function coefficientSupport(result,scaleIndex,sampleIndex){
    invariant(result&&result.contract_version===contractVersion&&result.implementation_version===implementationVersion,'Unsupported calibration result');
    invariant(Number.isInteger(scaleIndex)&&scaleIndex>=0&&scaleIndex<result.scales.length,'Invalid scale index');
    invariant(Number.isInteger(sampleIndex)&&sampleIndex>=0&&sampleIndex<result.times_s.length,'Invalid sample index');
    const scale=result.scales[scaleIndex],radius=Math.floor(8*scale),n=result.times_s.length;
    const first=Math.max(0,sampleIndex-radius),last=Math.min(n-1,sampleIndex+radius),requestedFirst=sampleIndex-radius,requestedLast=sampleIndex+radius;
    const left=Math.max(0,-requestedFirst),right=Math.max(0,requestedLast-(n-1));
    return {
      source_id:result.source.id,source_revision:result.source.revision,channel_id:result.source.channel_id,contract_version:contractVersion,implementation_version:implementationVersion,
      mode:result.mode,as_of_index:result.as_of_index,scale_index:scaleIndex,sample_index:sampleIndex,center_time_s:result.times_s[sampleIndex],frequency_hz:result.frequencies_hz[scaleIndex],scale,
      real:result.real[scaleIndex][sampleIndex],imag:result.imag[scaleIndex][sampleIndex],magnitude:result.magnitude[scaleIndex][sampleIndex],
      observed_sample_range:[first,last],observed_time_range_s:[result.times_s[first],result.times_s[last]],observed_sample_count:last-first+1,
      requested_sample_range:[requestedFirst,requestedLast],requested_time_range_s:[requestedFirst/sampleRate,requestedLast/sampleRate],
      zero_padding_contributed:left+right>0,padding_samples:{left,right},edge_affected:result.edge_affected[scaleIndex][sampleIndex],edge_radius_s:Math.sqrt(bandwidth)*scale/sampleRate,
      interpretation:'Observed support contains unequal kernel weights. Edge-risk overlay is narrower than finite computational support; neither is a significance test.'
    };
  }
  const kernelInspectionVersion='calibration-kernel-inspection/1';
  function kernelRadius(scaleIndex){invariant(Number.isInteger(scaleIndex)&&scaleIndex>=0&&scaleIndex<kernels.length,'Invalid scale index');return kernels[scaleIndex].radius;}
  function inspectKernel(result,scaleIndex,sampleIndex){
    const support=coefficientSupport(result,scaleIndex,sampleIndex),k=kernels[scaleIndex];
    invariant(result.scales[scaleIndex]===scales[scaleIndex]&&result.frequencies_hz[scaleIndex]===frequencies[scaleIndex],'Selected scale does not match the declared original kernel');
    invariant(Array.isArray(result.values)&&result.values.length===result.times_s.length,'Kernel inspection requires the permitted source samples from this result');
    const offsets=[],offsetSeconds=[],terms=[];let sumReal=0,sumImag=0;
    for(let d=-k.radius;d<=k.radius;d++){
      const q=d+k.radius,index=sampleIndex+d,permitted=index>=0&&index<result.values.length;
      const value=permitted?result.values[index]:0;
      invariant(!permitted||Number.isFinite(value),'Nonfinite permitted sample in kernel inspection');
      const real=value*k.re[q],imag=value*k.im[q];
      // This is the same multiplication order and exact stored kernel used above.
      // Padding terms are shown, but the analyzer's sum skips them entirely.
      if(permitted){sumReal+=real;sumImag+=imag;}
      offsets.push(d);offsetSeconds.push(d/sampleRate);
      terms.push(Object.freeze({kernel_index:q,offset_samples:d,offset_s:d/sampleRate,source_sample_index:index,
        source_time_s:permitted?result.times_s[index]:null,requested_time_s:index/sampleRate,
        status:permitted?'permitted_sample':'zero_padding',source_value:permitted?value:null,padded_value:permitted?null:0,
        kernel_real:k.re[q],kernel_imag:k.im[q],contribution_real:real,contribution_imag:imag}));
    }
    return Object.freeze({version:kernelInspectionVersion,source:result.source,support,
      kernel:Object.freeze({implementation_version:implementationVersion,scale_index:scaleIndex,scale:scales[scaleIndex],radius_samples:k.radius,
        offsets_samples:Object.freeze(offsets),offsets_s:Object.freeze(offsetSeconds),real:Object.freeze(k.re.slice()),imag:Object.freeze(k.im.slice()),
        array_authority:'Copies of the exact private kernels[scaleIndex].re/im arrays used by analyze(); not a reconstructed illustrative curve.',
        convention:'Conjugated analyzing kernel: coefficient = sum(permitted x[b+d] * (kernel_real[d] + i*kernel_imag[d])).',
        weight_units:'sample-normalized kernel multiplier',finite_support_samples:[-k.radius,k.radius]}),
      terms:Object.freeze(terms),reconstructed:Object.freeze({real:sumReal,imag:sumImag,magnitude:Math.hypot(sumReal,sumImag),
        difference_real:sumReal-support.real,difference_imag:sumImag-support.imag,
        exactly_matches_complex_coefficient:sumReal===support.real&&sumImag===support.imag}),
      interpretation:'Inspection of the existing convolution. Zero padding is not an observed zero sample. Magnitude omits complex phase; the kernel and contributions expose it.'});
  }
  return {version:contractVersion,implementationVersion,sourceRevision,kernelInspectionVersion,makeCalibration,eligibility,analyze,coefficientSupport,kernelRadius,inspectKernel};
});
