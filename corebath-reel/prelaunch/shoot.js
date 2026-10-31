const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+process.argv[2]);await p.evaluate(()=>window.ready);
const keys=await p.evaluate(()=>KEYS);
for(const k of keys){const [w,h]=await p.evaluate(k=>show(k),k);await p.setViewportSize({width:w,height:h});await p.waitForTimeout(80);
 await p.screenshot({path:`${process.argv[3]}/${k}.png`,clip:{x:0,y:0,width:w,height:h}});}
await b.close();console.log(keys.length,'posts');})();
