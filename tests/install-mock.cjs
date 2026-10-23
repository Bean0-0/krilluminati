const fs = require('node:fs');
const path = require('node:path');
const script = fs.readFileSync(path.join(__dirname,'../dist/krillion-io-helper.user.js'),'utf8');
module.exports = function installer(prefix='', configured=true) {
  return `${prefix}\n(() => {
    const values = new Map(${configured ? "[['openrouterKey','sk-or-v1-'+'x'.repeat(32)]]" : '[]'});
    const GM_getValue=(key,fallback)=>values.has(key)?values.get(key):fallback;
    const GM_setValue=(key,value)=>values.set(key,value);
    const GM_registerMenuCommand=()=>{};
    window.__aiTestRequests=[];
    const GM_xmlhttpRequest=details=>{
      const body=JSON.parse(details.data);
      window.__aiTestRequests.push(body);
      setTimeout(()=>details.onload({status:200,response:{choices:[{message:{content:JSON.stringify({answers:['Painite','Benitoite']})}}]}}),50);
    };
    ${script}
  })();`;
};
