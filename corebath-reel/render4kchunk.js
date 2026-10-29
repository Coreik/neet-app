const {chromium}=require('playwright');const {spawn}=require('child_process');
const [,,html,out,a,b]=process.argv;
(async()=>{
 const br=await chromium.launch();const p=await br.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:2});
 await p.goto('file://'+html);await p.evaluate(()=>window.ready);await p.waitForTimeout(500);
 const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','png','-i','-','-c:v','libx264','-profile:v','high','-level','5.2','-pix_fmt','yuv420p','-crf','14','-preset','medium','-tune','film',out],{stdio:['pipe','inherit','inherit']});
 for(let i=+a;i<+b;i++){await p.evaluate(t=>render(t),i/30);const buf=await p.screenshot({type:'png'});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await br.close();console.log('chunk done',a,b);})();
