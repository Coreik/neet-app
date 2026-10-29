const {chromium}=require('playwright');const {spawn}=require('child_process');
const [,,html,out,dur]=process.argv;
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:2});
 await p.goto('file://'+html);await p.evaluate(()=>window.ready);await p.waitForTimeout(500);
 const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','png','-i','-','-c:v','libx264','-profile:v','high','-level','5.2','-pix_fmt','yuv420p','-crf','14','-preset','slow','-tune','film',out],{stdio:['pipe','inherit','inherit']});
 const N=+dur*30;
 for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/30);const buf=await p.screenshot({type:'png'});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%90==0)console.log('frame',i,new Date().toISOString());}
 ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');})();
