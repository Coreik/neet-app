const {chromium}=require('playwright');const fs=require('fs');
(async()=>{const dir=process.argv[2];const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
p.on('console',m=>console.log(m.text()));p.on('pageerror',e=>console.log('ERR',e.message));
await p.goto('file://'+dir+'/reel.html');await p.waitForFunction('window.READY',null,{timeout:30000});
const ts=process.argv.slice(3).map(Number);
for(const t of ts){const d=await p.evaluate(t=>{render(t);return document.getElementById('c').toDataURL('image/jpeg',0.8)},t);
fs.writeFileSync(`${dir}/still_${t}.jpg`,Buffer.from(d.split(',')[1],'base64'));}
await b.close();})();
