const {chromium}=require('playwright');
const installer=require('./install-mock.cjs');
const assert=require('node:assert/strict');
const fs=require('node:fs');
if(process.env.PUFFER_PRIVATE_TEST!=='1')throw new Error('Opt-in required: PUFFER_PRIVATE_TEST=1 npm run test:private-room creates a private room with two test players.');
(async()=>{
 const browser=await chromium.launch({headless:true});
 let host,guest;
 const artifacts={frames:[],summary:[]};
 try{
  async function makePage(){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});await context.route('**/*',route=>['krillion.io','www.krillion.io','party.krillion.io'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());context.setDefaultTimeout(10000);await context.addInitScript({content:installer('',false)});return context.newPage();}
  host=await makePage();guest=await makePage();
  host.on('websocket',socket=>socket.on('framereceived',frame=>{try{const data=JSON.parse(String(frame.payload));if(data.t==='snap'||data.t==='patch')artifacts.frames.push(data);}catch{}}));
  await host.goto('https://krillion.io/party',{waitUntil:'domcontentloaded'});
  await host.getByPlaceholder('what the ring calls you').fill('Tab test host');
  await host.getByRole('button',{name:'PUBLIC · LISTED',exact:true}).click();
  assert(await host.getByRole('button',{name:'PRIVATE · UNLISTED',exact:true}).count() || await host.getByRole('button').filter({hasText:/private/i}).count());
  await host.getByRole('button',{name:'▼ HOST A ROOM ▼',exact:true}).click();
  await host.waitForURL(/\/party\/[A-Z]{4}/);
  const code=new URL(host.url()).pathname.split('/').pop();
  await host.getByRole('button',{name:new RegExp(`Room ${code}: private`)}).waitFor({timeout:15000});
  await guest.goto('https://krillion.io/party',{waitUntil:'domcontentloaded'});
  await guest.getByPlaceholder('what the ring calls you').fill('Tab test guest');
  await guest.getByRole('textbox',{name:'Room code',exact:true}).fill(code);
  await guest.getByRole('button',{name:'JOIN',exact:true}).click();
  await guest.waitForURL(new RegExp(`/party/${code}`));
  const start=host.getByRole('button',{name:'▼ WAKE THE PUFFER ▼',exact:true});
  await start.waitFor();for(let i=0;i<60&&await start.isDisabled();i++)await host.waitForTimeout(100);
  await start.click({force:true});
  const helper=host.locator('#krillion-io-tab-helper');
  let found=false;const seen=new Set();const deadline=Date.now()+45000;
  while(Date.now()<deadline){
    const {text,ready}=await host.evaluate(()=>{
      const cards=document.querySelectorAll('.ds-card:not(.pf-newcat) .prompt');
      const input=document.querySelector('input[aria-label="Your answer"]');
      const root=document.querySelector('#krillion-io-tab-helper')?.shadowRoot;
      return {text:cards[cards.length-1]?.textContent||'',ready:!!input&&!input.disabled&&!!root?.querySelector('.candidate')&&!root.querySelector('section').hidden};
    });
    if(text&&!seen.has(text)){seen.add(text);console.log('PRIVATE CATEGORY:',text);}
    if(ready){found=true;break;}
    await host.waitForTimeout(500);
  }
  assert(found,'No matching sampled category appeared before private game finished');
  const prompt=await host.locator('.ds-card:not(.pf-newcat) .prompt').last().textContent();
  await guest.locator('#krillion-io-tab-helper .candidate').first().waitFor();
  for(const page of [host,guest]){const input=page.getByRole('textbox',{name:'Your answer',exact:true});await input.focus();await input.press('Tab');}
  let holder;
  for(const page of [host,guest])if(await page.getByRole('button',{name:'Send answer',exact:true}).isEnabled())holder=page;
  assert(holder,'Exactly one participant must be able to submit');
  const answer=await holder.getByRole('textbox',{name:'Your answer',exact:true}).inputValue();
  console.log('TAB FILLED:',answer);
  await holder.getByRole('button',{name:'Send answer',exact:true}).click();
  await host.waitForFunction(()=>document.querySelector('#krillion-io-tab-helper').shadowRoot.querySelector('.status').textContent.includes('1 observed used'),null,{timeout:10000});
  const statuses=await Promise.all([host,guest].map(page=>page.locator('#krillion-io-tab-helper .status').textContent()));
  const learned=await host.evaluate(()=>JSON.parse(localStorage.getItem('krillion-io-tab:v2')));
  assert(Object.keys(learned.learned).length>0,'Real Puffer acceptance must be learned');
  assert(!(await helper.locator('.candidate').allTextContents()).some(text=>text.split('\n')[0]===answer),'Used candidate must no longer appear');
  const summary={prompt,answer,statuses,learned:learned.learned};artifacts.summary.push(summary);
  console.log('PASS REAL PRIVATE ROOM:',JSON.stringify(summary,null,2));
  await host.screenshot({path:'/tmp/krillion-puffer-private-verified.png'});
 }finally{
  for(const page of [guest,host])if(page){try{const leave=page.getByRole('button',{name:'Leave room',exact:true});if(await leave.count()){await leave.click({force:true,timeout:3000});await page.waitForTimeout(250);}}catch{}}
  fs.writeFileSync('/tmp/krillion-puffer-private-test.json',JSON.stringify(artifacts,null,2));
  await browser.close();
 }
})().catch(error=>{console.error(error);process.exit(1)});
