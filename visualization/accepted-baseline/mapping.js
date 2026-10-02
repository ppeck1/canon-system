/* Compatibility facade only: domain and encoding implementations remain separate. */
(function(root,factory){const common=typeof module==='object'&&module.exports;const api=factory(common?require('./domain.js'):root.QueueDomain,common?require('./encoding.js'):root.SpatialEncoding);if(common)module.exports=api;if(root)root.WorkDisposition=api;})(typeof globalThis!=='undefined'?globalThis:this,function(D,V){
'use strict';
if(!D||!V)throw new Error('WorkDisposition requires QueueDomain and SpatialEncoding');
return Object.freeze({mappingVersion:D.mappingVersion,kernelVersion:V.kernelVersion,categories:V.categories,defaultBounds:V.defaultBounds,partition:D.partition,prefix:D.prefix,anchorFor:D.anchorFor,field:V.field,cropMass:V.cropMass,cropInfo:V.cropInfo,erf:V.erf});
});