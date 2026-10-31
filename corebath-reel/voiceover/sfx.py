# Clean SFX-only track for the Corebath BYOB reel (no music bed).
import numpy as np, wave, sys
from scipy.signal import butter, sosfilt, fftconvolve
SR=44100; D=35.9; N=int(SR*D); rng=np.random.default_rng(11)
L=np.zeros(N); R=np.zeros(N)
def add(sig,t,g=1.0,pan=0.0):
    i=int(t*SR); s=sig[:max(0,N-i)]*g
    L[i:i+len(s)]+=s*(1-max(0,pan)); R[i:i+len(s)]+=s*(1+min(0,pan))
def tt(d): return np.arange(int(d*SR))/SR
def bp(x,lo,hi): return sosfilt(butter(2,[lo/(SR/2),hi/(SR/2)],'band',output='sos'),x)
def lp(x,f): return sosfilt(butter(2,f/(SR/2),'low',output='sos'),x)
def tap():            # crisp UI tap
    t=tt(.06); return (np.sin(2*np.pi*1750*t)*.6+np.sin(2*np.pi*3500*t)*.25)*np.exp(-t/.007)
def tick():           # tiny tick for cuts / counting
    t=tt(.03); return np.sin(2*np.pi*2600*t)*np.exp(-t/.0035)*.5
def swoosh(d=.45,up=True):   # airy, filtered, smooth
    n=int(d*SR); x=rng.standard_normal(n); u=np.linspace(0,1,n); out=np.zeros(n)
    for i in range(0,n,1024):
        f=600+3400*(u[i] if up else 1-u[i]); out[i:i+1024]=bp(x[max(0,i-1024):i+1024],f*.6,f*1.5)[-len(x[i:i+1024]):]
    return lp(out,6000)*np.sin(np.pi*u)**2*.35
def thump(g=1.0):     # soft low hit for title moments
    t=tt(.5); f=48+40*np.exp(-t/.05)
    return np.sin(2*np.pi*np.cumsum(f)/SR)*(1-np.exp(-t/.004))*np.exp(-t/.16)*g
def chime(m,g=.5,d=1.2):     # soft bell
    f=440*2**((m-69)/12); t=tt(d)
    s=sum(a*np.sin(2*np.pi*f*k*t)*np.exp(-t/(d*.35/k**.5)) for k,a in [(1,1),(2,.35),(3,.12),(4.2,.05)])
    return s*(1-np.exp(-t/.003))*g
# ---- events (timed to the picture; shots after 3.0s moved +10.9s for the pain roulette)
M=lambda t: t if t<3.0 else t+10.9
_add=add
def add(sig,t,g=1.0,pan=0.0): _add(sig,M(t),g*.6,pan)
for k in range(6): add(tick(),k*.25,.7,(-.2 if k%2 else .2))          # montage cuts
add(swoosh(.4,False),1.32,.8)
add(thump(.9),3.0); add(chime(76,.22,1.6),3.2); add(chime(83,.15,1.6),3.2)   # Introducing BYOB
add(swoosh(.9,True),5.0,1.0); add(thump(.5),5.6)                     # phone rises
add(swoosh(.32,True),5.9,.7,.3); add(swoosh(.32,True),6.35,.7,.3); add(swoosh(.6,True),6.8,.9,.3)
for t0 in [8.0,8.5,9.5,10.0,10.5,11.0]: add(tap(),t0-.005,1.0)
for t0,m in [(8.0,81),(9.5,84),(10.0,88),(10.5,91)]: add(chime(m,.28,.9),t0+.02,1,.1)
add(swoosh(.5,False),11.25,.9); add(thump(.8),12.0)
add(swoosh(.65,True),13.0,.8)                                         # sketch -> photo wipe
add(thump(.8),14.5)
for k in range(1,22): add(tick(),14.62+(1-(1-k/21)**.25)*.68,.55,(-.2 if k%2 else .2))  # 21 count
add(thump(.8),16.0); add(thump(.5),16.5); add(thump(.9),17.5)
for k in range(4): add(tick(),19.0+k*.1,.7)                           # bento tiles
add(thump(.9),21.0); add(chime(72,.18,2.0),21.0)
add(tap(),22.49,1.2); add(chime(88,.35,1.4),22.52); add(chime(95,.2,1.4),22.6)   # CTA tap
add=_add
def drip(f=900):
    t=tt(.12); fr=f*(1+1.5*np.exp(-t/.01)); return np.sin(2*np.pi*np.cumsum(fr)/SR)*np.exp(-t/.03)*.35
def knock(f=180):
    t=tt(.25); return (np.sin(2*np.pi*f*t)+.4*np.sin(2*np.pi*f*2.7*t))*np.exp(-t/.05)*(1-np.exp(-t/.002))*.7
def buzz():
    t=tt(.22); return np.sign(np.sin(2*np.pi*170*t))*np.exp(-t/.12)*.08
def ratchet(t0,t1,n):   # roulette clicks slowing down
    for k in range(n):
        u=(k/n)**.5; add(tick(),t0+(t1-t0)*u,.45,(-.2 if k%2 else .2))
import wave as _w
lw=_w.open('leak.wav'); la=np.frombuffer(lw.readframes(lw.getnframes()),'<i2').reshape(-1,2).astype(float)/32767
la=la[:int(1.3*SR)]; fade=np.minimum(1,np.minimum(np.arange(len(la))/(.1*SR),(len(la)-np.arange(len(la)))/(.3*SR)))[:,None]
la=la*fade*2.2; i=int(4.2*SR); L[i:i+len(la)]+=la[:,0]; R[i:i+len(la)]+=la[:,1]
add(swoosh(.7,True),3.5,.7); ratchet(3.55,4.2,14)
for s0 in [5.5,7.2,8.5,11.0]: add(swoosh(.35,True),s0,.45,.3); ratchet(s0,s0+.35,4)
for k,t0 in enumerate([4.5,4.85,5.2]): add(drip(850+k*60),t0,.55)
for t0 in [6.05,6.25,6.45]: add(tick(),t0,.7)
for k in range(8): add(knock(1400 if k%2 else 1100),7.55+k*.1,.18)
for k in range(5): add(buzz(),8.95+k*.15,1,(-.3 if k%2 else .3))
for t0 in [11.6,11.8]: add(knock(170),t0,.7)
add(thump(.6),12.8); add(swoosh(.45,True),13.5,.7); add(thump(.5),13.9)
# ---- tiny room reverb for polish, then normalise (no distortion)
ir=rng.standard_normal(int(.35*SR))*np.exp(-np.arange(int(.35*SR))/SR/.08)*.02
L=L+fftconvolve(L,ir)[:N]*.6; R=R+fftconvolve(R,ir[::-1])[:N]*.6
m=max(np.abs(L).max(),np.abs(R).max()); L*=.7/m; R*=.7/m
with wave.open(sys.argv[1],'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.stack([L,R],1)*32767).astype('<i2').tobytes())
print('ok')
