const {chromium}=require('playwright');const {spawn}=require('child_process');
(async()=>{const dir=process.argv[2],out=process.argv[3];const FPS=30;
const b=await chromium.launch();const p=await b.newPage({viewport:{width:1080,height:1920}});
await p.goto('file://'+dir+'/reel.html');await p.waitForFunction('window.READY',null,{timeout:30000});
const N=await p.evaluate('DUR')*FPS;
const ff=spawn('ffmpeg',['-v','error','-y','-f','image2pipe','-framerate',String(FPS),'-c:v','png','-i','-','-i',dir+'/music.wav',
 '-c:v','libx264','-preset','slow','-crf','14','-profile:v','high','-level','5.2','-pix_fmt','yuv420p','-r','30',
 '-c:a','aac','-b:a','256k','-shortest','-movflags','+faststart',out],{stdio:['pipe','inherit','inherit']});
for(let i=0;i<N;i++){const d=await p.evaluate(t=>{render(t);return document.getElementById('c').toDataURL('image/png')},i/FPS);
 const buf=Buffer.from(d.slice(d.indexOf(',')+1),'base64');if(!ff.stdin.write(buf))await new Promise(r=>ff.stdin.once('drain',r));
 if(i%150===0)console.log('frame',i,'/',N);}
ff.stdin.end();await new Promise(r=>ff.on('close',r));await b.close();console.log('done');})();
