const {chromium}=require('playwright');const {spawn}=require('child_process');
const [,,html,mode,out,...rest]=process.argv;
(async()=>{
 const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920},deviceScaleFactor:1});
 await p.goto('file://'+html);await p.evaluate(()=>window.ready);await p.waitForTimeout(300);
 if(mode==='stills'){ for(const t of rest){await p.evaluate(t=>render(+t),t);await p.screenshot({path:`${out}/s_${t}.jpg`,type:'jpeg',quality:85});} }
 else { const fps=30,N=+rest[0]*fps;
   const ff=spawn('ffmpeg',['-y','-v','error','-f','image2pipe','-framerate','30','-c:v','mjpeg','-i','-','-c:v','libx264','-pix_fmt','yuv420p','-crf','16','-preset','medium',out],{stdio:['pipe','inherit','inherit']});
   for(let i=0;i<N;i++){await p.evaluate(t=>render(t),i/fps);const buf=await p.screenshot({type:'jpeg',quality:95});if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));if(i%60==0)console.log('frame',i);}
   ff.stdin.end();await new Promise(r=>ff.on('close',r)); }
 await b.close();})();
