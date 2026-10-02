/* Presentation layout only. No source selection or analysis lives here. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.LinkedWorkspace=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{
'use strict';
const version='linked-workspace/1';
const defaults=Object.freeze({version,arrangement:'stacked',primaryHeight:900,companionHeight:470,primaryShare:60});
function validate(x){
 if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).some(k=>!Object.keys(defaults).includes(k)))throw Error('Unsupported workspace setting.');
 if(x.version!==version)throw Error('Unsupported workspace version.');
 if(!['stacked','side'].includes(x.arrangement))throw Error('Unsupported workspace arrangement.');
 for(const[k,min,max]of [['primaryHeight',400,1800],['companionHeight',260,1200],['primaryShare',35,75]])if(!Number.isInteger(x[k])||x[k]<min||x[k]>max)throw Error('Workspace '+k+' outside supported range.');
 return x;
}
function describe(x){validate(x);return {...x,units:{primaryHeight:'CSS px',companionHeight:'CSS px',primaryShare:'percent'},responsive_fallback:'Side layout stacks below 900 CSS px; saved panel heights remain scrollable.',resize_policy:'Native bottom-right vertical handles or explicit height controls; committed sizes are saved. No analytical changes.'};}
return Object.freeze({version,defaults,validate,describe});
});
