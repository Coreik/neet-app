// Render selected slides with logo and slide-number elements removed.
// usage: node shootclean.js page.html outdir scale "prefix1,prefix2" folderName
const {chromium}=require('playwright');const fs=require('fs');
const [,,html,out,scale,prefixes,folder]=process.argv;
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1350},deviceScaleFactor:+scale});
await p.goto('file://'+html);await p.evaluate(()=>window.ready);
const keys=(await p.evaluate(()=>KEYS)).filter(k=>prefixes.split(',').some(x=>k.startsWith(x)));
fs.mkdirSync(`${out}/${folder}`,{recursive:true});let n=0;
for(const k of keys){const [w,h]=await p.evaluate(k=>{const r=show(k);
  document.querySelectorAll('#c .logo,#c .pg').forEach(e=>e.remove());
  document.querySelectorAll('#c *').forEach(e=>{const t=e.textContent.trim();if(e.children.length===0&&(t==='Corebath'||/^\d+\/\d+$/.test(t)))e.remove();});
  return r},k);
 await p.setViewportSize({width:w,height:h});await p.waitForTimeout(60);n++;
 await p.screenshot({path:`${out}/${folder}/${String(n).padStart(2,'0')}.png`,clip:{x:0,y:0,width:w,height:h}});}
await b.close();console.log(folder,n);})();
