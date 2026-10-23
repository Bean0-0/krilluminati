const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const installer=require('./install-mock.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true});
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
  const normal=await fixture(`window.postMessage=()=>{throw new Error('window messaging unavailable');};window.__domMessages=[];const send=document.dispatchEvent.bind(document);document.dispatchEvent=event=>{if(event.type.startsWith('krillion-ai-'))window.__domMessages.push({type:event.type,detail:event.detail});return send(event);};`);
  await normal.root.locator('.candidate').first().waitFor();
  assert.equal(await normal.page.evaluate(()=>window.__aiTestRequests.length),1);
  assert.match(await normal.root.locator('.candidate').first().innerText(),/Painite.*AI guess/s);
  assert.equal(await normal.root.locator('.ai').isDisabled(),false);
  const messages=await normal.page.evaluate(()=>window.__domMessages);
  assert(messages.length>=3&&messages.every(message=>typeof message.detail==='string'),'Only JSON strings cross DOM boundary');
  await normal.page.evaluate(()=>{
    const request=window.__domMessages.find(item=>JSON.parse(item.detail).from==='page');
    const data=JSON.parse(request.detail);
    document.dispatchEvent(new CustomEvent(request.type,{detail:data}));
    document.dispatchEvent(new CustomEvent(request.type,{detail:'not json'}));
    document.dispatchEvent(new CustomEvent(request.type,{detail:JSON.stringify({...data,channel:'wrong-channel',id:'other'})}));
  });
  await normal.page.waitForTimeout(80);
  assert.equal(await normal.page.evaluate(()=>window.__aiTestRequests.length),1,'Reject object details, malformed JSON and wrong channels');
  console.log('PASS string-only DOM bridge with window.postMessage unavailable; malformed/object/channel validation.');
  await normal.context.close();

  const lost=await fixture(fastTimers+`const send=document.dispatchEvent.bind(document);document.dispatchEvent=event=>event.type.startsWith('krillion-ai-')?true:send(event);`);
  await statusContains(lost.page,'AI bridge did not respond');
  assert.equal(await lost.root.locator('.ai').isDisabled(),false);
  assert.equal(await lost.page.evaluate(()=>window.__aiTestRequests.length),0);
  console.log('PASS lost bridge: loading ends with permission/reload error, manual retry enabled.');
  await lost.context.close();

  const stalled=await fixture(fastTimers+'const timed=window.setTimeout;window.setTimeout=(fn,ms,...args)=>ms===50?0:timed(fn,ms,...args);');
  await statusContains(stalled.page,'AI network timed out');
  assert.equal(await stalled.root.locator('.ai').isDisabled(),false);
  await stalled.root.locator('.ai').click();
  await stalled.page.waitForFunction(()=>window.__aiTestRequests.length===2);
  await statusContains(stalled.page,'AI network timed out');
  console.log('PASS missing GM callbacks: independent network watchdog releases queue, retry works.');
  await stalled.context.close();

  const missingReply=await fixture(fastTimers+`const send=document.dispatchEvent.bind(document);document.dispatchEvent=event=>{if(event.type.startsWith('krillion-ai-')&&typeof event.detail==='string'&&JSON.parse(event.detail).kind==='result')return true;return send(event);};`);
  await statusContains(missingReply.page,'60 seconds including queue');
  assert.equal(await missingReply.root.locator('.ai').isDisabled(),false);
  console.log('PASS lost result after acknowledgement: final page deadline exits loading.');
  await missingReply.context.close();
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1)});
