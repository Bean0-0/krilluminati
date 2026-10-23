const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const assert = require('node:assert/strict');
const {randomUUID} = require('node:crypto');
const source = fs.readFileSync(path.join(__dirname, '../src/openrouter-sandbox.js'), 'utf8');
const testKey = 'sk-or-v1-' + 'x'.repeat(32);
function harness({key=testKey,status=200,never=false,fastTimers=false,content='{"answers":["Painite"," painite ","Benitoite",3,"bad\\nword"]}',delay=0}={}) {
  const values=new Map(),requests=[],messages=[],listeners=[],injected=[];
  if(key)values.set('openrouterKey',key);
  const window={addEventListener:(type,fn)=>listeners.push(fn),postMessage:data=>messages.push(data),prompt:()=>null,alert:()=>{}};
  const ctx={window,location:{origin:'https://krillion.io'},crypto:{randomUUID},Promise,Date,Map,Set,JSON,
    setTimeout:(fn,ms)=>setTimeout(fn,fastTimers&&ms>=25000?20:ms),clearTimeout,
    CustomEvent:class {constructor(type,{detail}){this.type=type;this.detail=detail;}},
    document:{documentElement:{append:node=>injected.push(node.textContent)},createElement:()=>({textContent:'',remove(){}}),
      addEventListener:(type,fn)=>listeners.push({type,fn}),dispatchEvent:event=>messages.push({type:event.type,detail:event.detail})},
    GM_getValue:(key,fallback)=>values.has(key)?values.get(key):fallback,
    GM_setValue:(key,value)=>values.set(key,value),GM_registerMenuCommand:()=>{},
    GM_xmlhttpRequest:details=>{requests.push(details);if(!never)setTimeout(()=>details.onload({status,response:{choices:[{message:{content}}]}}),delay);return {abort(){}};},
    pageMain:function pageMain(){},MutationObserver:class {observe(){} disconnect(){}}
  };
  vm.runInNewContext(source,ctx);
  return {ctx,window,values,requests,messages,listeners,injected};
}
(async()=>{
  const h=harness();
  const first=await h.ctx.complete('Name a mineral',60);
  assert.deepEqual(Array.from(first.answers),['Painite','Benitoite']);
  const request=h.requests[0],body=JSON.parse(request.data);
  assert.equal(request.url,'https://openrouter.ai/api/v1/chat/completions');
  assert.equal(request.headers.Authorization,`Bearer ${testKey}`);
  assert.equal(body.model,'dots-studio/dots-3-note-preview:free');
  assert.deepEqual(body.reasoning,{enabled:false});
  assert.equal(body.max_tokens,1000);
  assert.deepEqual(body.provider.max_price,{prompt:0,completion:0,request:0});
  assert(!body.models&&!body.plugins);
  assert(!h.injected.join('').includes(testKey),'Key must not enter injected page code');
  assert(!JSON.stringify(h.messages).includes(testKey),'Key must not enter page messages');
  await h.ctx.complete('  NAME A MINERAL ',60);assert.equal(h.requests.length,1,'Repeated category uses cache');
  await h.ctx.complete('Name a mineral',256);assert.equal(h.requests.length,2,'Length limit participates in cache identity');
  await h.ctx.complete('Name another mineral',60);assert.equal(h.requests.length,3);
  await assert.rejects(h.ctx.complete('Name one more mineral',60),/3 AI requests per minute/);
  const queued=harness({delay:10});
  await Promise.all([queued.ctx.complete('Category A',60),queued.ctx.complete('Category B',60)]);
  assert.equal(queued.requests.length,2,'Category B queues rather than permanently failing busy');
  const missing=harness({key:''});await assert.rejects(missing.ctx.complete('Category',60),/Set OpenRouter key/);assert.equal(missing.requests.length,0);
  const malformed=harness({content:'{"answers":[]}'});await assert.rejects(malformed.ctx.complete('Category',60),/malformed or empty/);assert.equal(malformed.requests.length,1);
  const limited=harness({status:429});await assert.rejects(limited.ctx.complete('Category',60),/HTTP 429/);assert.equal(limited.requests.length,1,'No automatic upstream retries');
  const daily=harness();daily.values.set('openrouterUsage:v1',Array(40).fill(Date.now()-120000));await assert.rejects(daily.ctx.complete('Category',60),/40 AI requests/);
  const stalled=harness({never:true,fastTimers:true});
  await assert.rejects(stalled.ctx.complete('Stalled category',60),/network timed out/);
  await assert.rejects(stalled.ctx.complete('Next category',60),/network timed out/);
  assert.equal(stalled.requests.length,2,'Missing GM callbacks must not hold queue forever');
  console.log('PASS AI sandbox: free-only routing, key isolation, bounded output, caching, length isolation, queue, missing key, malformed output, 429/no retries, local limits.');
})().catch(error=>{console.error(error);process.exit(1)});
