import numpy as np, wave, sys
sr=48000; D=34; t=np.arange(int(sr*D))/sr
def n(m): return 440*2**((m-69)/12)
chords=[[57,60,64,69],[53,57,60,65],[48,52,55,60],[55,59,62,67]]  # Am F C G
out=np.zeros_like(t)
seg=4.25
for k in range(8):
    a=k*seg; idx=(t>=a)&(t<a+seg+1.5); tt=t[idx]-a
    env=np.minimum(tt/0.8,1)*np.exp(-np.maximum(tt-seg,0)*3)
    for m in chords[k%4]:
        f=n(m); out[idx]+=env*(np.sin(2*np.pi*f*tt)+0.25*np.sin(2*np.pi*2*f*tt+0.3))*0.05
    # soft bass
    f=n(chords[k%4][0]-12); out[idx]+=env*np.sin(2*np.pi*f*tt)*0.06
# gentle plucks every half beat (arp)
step=60/96/2
for i in range(int(D/step)):
    a=i*step; k=int(a//seg)%4; m=chords[k][[0,2,1,3][i%4]]+12
    idx=(t>=a)&(t<a+0.6); tt=t[idx]-a
    out[idx]+=np.sin(2*np.pi*n(m)*tt)*np.exp(-tt*7)*0.035
# tremolo-free lowpass-ish smoothing
out=np.convolve(out,np.ones(6)/6,'same')
fade=np.minimum(1,np.minimum(t/1.0,(D-t)/2.0)); out*=fade
out/=np.max(np.abs(out))*1.6
st=np.stack([out,np.roll(out,240)],1)
w=wave.open(sys.argv[1],'wb');w.setnchannels(2);w.setsampwidth(2);w.setframerate(sr)
w.writeframes((st*32767).astype('<i2').tobytes());w.close()
