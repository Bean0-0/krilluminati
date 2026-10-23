const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const installer=require('./install-mock.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const sourceNull=`window.postMessage=(data,targetOrigin)=>{if(targetOrigin!==location.origin)return;setTimeout(()=>window.dispatchEvent(new MessageEvent('message',{data,origin:location.origin,source:null})),0);};`;
 const fastTimers=`const nativeTimeout=window.setTimeout.bind(window);window.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,ms>=60000?150:ms>=25000?65:ms>=5000?40:ms,...args);`;
 async function fixture(prefix){
  const context=await browser.newContext();context.setDefaultTimeout(2000);
  await context.route('**/*',route=>{
   if(new URL(route.request().url()).pathname==='/api/today')return route.fulfill({json:{prompts:[]}});
   return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body><div class="ds-card"><div class="rnd">CATEGORY 1</div><div class="prompt">Name a mystery test mineral</div></div><input class="ds-input" aria-label="Your answer" maxlength="60"></body></html>'});
  });
  await context.addInitScript({content:installer(prefix)});
  const page=await context.newPage();await page.goto('https://krillion.io/party/KRLP');
  return {context,page,root:page.locator('#krillion-io-tab-helper')};
 }
 async function statusContains(page,text){
  await page.waitForFunction(value=>document.querySelector('#krillion-io-tab-helper')?.shadowRoot.querySelector('.ai-status')?.textContent.includes(value),text,{timeout:2000});
 }
 try{
  // MDN: Firefox privileged extension postMessage can expose source:null.
  const normal=await fixture(sourceNull);
  await normal.root.locator('.candidate').first().waitFor();
  assert.equal(await normal.page.evaluate(()=>window.__aiTestRequests.length),1,'Firefox source:null must reach sandbox instead of staying AI loading');
  assert.match(await normal.root.locator('.candidate').first().innerText(),/Painite.*AI guess/s);
  assert.equal(await normal.root.locator('.ai').isDisabled(),false);
  console.log('PASS Firefox-style source:null request/result bridge.');
  await normal.context.close();

  const foreign=await fixture(sourceNull.replace('origin:location.origin',"origin:'https://not-krillion.invalid'")+fastTimers);
  await statusContains(foreign.page,'AI bridge did not respond');
  assert.equal(await foreign.page.evaluate(()=>window.__aiTestRequests.length),0,'Origin checks must still reject foreign messages even with source:null');
  console.log('PASS source:null exception retains exact-origin restriction.');
  await foreign.context.close();

  const lost=await fixture(fastTimers+'window.postMessage=()=>{};');
  await statusContains(lost.page,'AI bridge did not respond');
  assert.equal(await lost.root.locator('.ai').isDisabled(),false);
  assert.equal(await lost.page.evaluate(()=>window.__aiTestRequests.length),0);
  console.log('PASS lost bridge: loading ends with permission/reload error, manual retry enabled.');
  await lost.context.close();

  const stalled=await fixture(sourceNull+fastTimers+'const timed=window.setTimeout;window.setTimeout=(fn,ms,...args)=>ms===50?0:timed(fn,ms,...args);');
  await statusContains(stalled.page,'AI network timed out');
  assert.equal(await stalled.root.locator('.ai').isDisabled(),false);
  await stalled.root.locator('.ai').click();
  await stalled.page.waitForFunction(()=>window.__aiTestRequests.length===2);
  await statusContains(stalled.page,'AI network timed out');
  console.log('PASS missing GM callbacks: independent network watchdog releases queue, retry works.');
  await stalled.context.close();

  const missingReply=await fixture(sourceNull+fastTimers+`const transport=window.postMessage;window.postMessage=(data,origin)=>{if(data.from==='sandbox'&&data.kind==='result')return;transport(data,origin);};`);
  await statusContains(missingReply.page,'60 seconds including queue');
  assert.equal(await missingReply.root.locator('.ai').isDisabled(),false);
  console.log('PASS lost result after acknowledgement: final page deadline exits loading.');
  await missingReply.context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
