import numpy as np, wave, sys
SR=44100; D=25.0; N=int(SR*D); rng=np.random.default_rng(7)
L=np.zeros(N); R=np.zeros(N)
def add(sig,t,g=1.0,pan=0.0):
    i=int(t*SR); 
    if i>=N: return
    s=sig[:N-i]*g; L[i:i+len(s)]+=s*(1-max(0,pan)); R[i:i+len(s)]+=s*(1+min(0,pan))
def env(n,a=0.002,d=0.2):
    t=np.arange(n)/SR; e=np.exp(-t/d); k=int(a*SR); 
    if k>0: e[:k]*=np.linspace(0,1,k)
    return e
def lp(x,fc):
    a=np.exp(-2*np.pi*fc/SR); y=np.zeros_like(x); s=0.0
    # vectorised one-pole via lfilter-like loop in chunks
    from scipy.signal import lfilter
    return lfilter([1-a],[1,-a],x)
try:
    from scipy.signal import lfilter, butter
    HAVE=True
except: HAVE=False
def bp(x,lo,hi):
    b,a=butter(2,[lo/(SR/2),hi/(SR/2)],'band'); return lfilter(b,a,x)
def hp(x,fc):
    b,a=butter(2,fc/(SR/2),'high'); return lfilter(b,a,x)
def kick(g=1.0):
    n=int(.45*SR); t=np.arange(n)/SR; f=45+80*np.exp(-t/0.035); ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)*env(n,0.001,0.16); s+= (rng.standard_normal(n)*env(n,0,0.004))*0.3
    return np.tanh(s*1.6)*g
def clap():
    n=int(.25*SR); x=rng.standard_normal(n); x=bp(x,900,3500); e=np.zeros(n)
    for o in [0,0.011,0.022]: k=int(o*SR); e[k:]+=env(n-k,0.0005,0.012 if o<0.02 else 0.08)
    return x*e*0.9
def hat(open_=False):
    n=int((.18 if open_ else .05)*SR); x=hp(rng.standard_normal(n),7000); return x*env(n,0.0005,0.06 if open_ else 0.012)*0.35
def tick():
    n=int(.03*SR); x=hp(rng.standard_normal(n),3000)*env(n,0,0.004); t=np.arange(n)/SR; return (x*0.6+np.sin(2*np.pi*2400*t)*env(n,0,0.006)*0.5)
def whoosh(dur=.35,up=True,g=.5):
    n=int(dur*SR); x=rng.standard_normal(n); t=np.linspace(0,1,n)
    out=np.zeros(n); seg=2048
    for i in range(0,n,seg):
        p=t[i]; fc=(400+5000*p) if up else (5400-5000*p)
        out[i:i+seg]=bp(x[max(0,i-512):i+seg],max(200,fc*0.6),min(19000,fc*1.6))[-len(x[i:i+seg]):]
    e=np.sin(np.pi*t)**1.5
    return out*e*g
def boom(g=1.0):
    n=int(1.2*SR); t=np.arange(n)/SR; f=38+60*np.exp(-t/0.08); s=np.sin(2*np.pi*np.cumsum(f)/SR)*env(n,0.001,0.45)
    s+=bp(rng.standard_normal(n),200,2000)*env(n,0.001,0.06)*0.5
    return np.tanh(s*1.4)*g
def crash(g=.35):
    n=int(1.6*SR); return hp(rng.standard_normal(n),5000)*env(n,0.001,0.5)*g
def riser(dur,g=.5):
    n=int(dur*SR); t=np.linspace(0,1,n); x=rng.standard_normal(n); out=np.zeros(n); seg=2048
    for i in range(0,n,seg): fc=300+8000*t[i]**2; out[i:i+seg]=bp(x[max(0,i-512):i+seg],fc*0.7,min(19000,fc*1.4))[-len(x[i:i+seg]):]
    tone=np.sin(2*np.pi*np.cumsum(200+800*t**2)/SR)*0.25
    return (out+tone)*t**2*g
def note(f,dur,kind='bass',g=.5):
    n=int(dur*SR); t=np.arange(n)/SR
    if kind=='bass':
        s=np.sin(2*np.pi*f*t)+0.35*np.sin(4*np.pi*f*t)+0.15*np.sign(np.sin(2*np.pi*f*t))
        e=env(n,0.004,dur*0.45); s=lp(s,700)
    else:
        s=sum(np.sin(2*np.pi*f*k*t+0.0)/k**1.3 for k in range(1,7)); e=env(n,0.002,0.11)
        s=lp(s,2600)
    return s*e*g
def chord(fs,dur,g=.18):
    return sum(note(f,dur,'stab',1) for f in fs)*g
# progression: Am F C G (2 beats each? 4 beats each = 2s)
midi=lambda m:440*2**((m-69)/12)
prog=[([57,60,64,67],45),([53,57,60,64],41),([48,55,60,64],48),([55,59,62,67],43)]
B=0.5
quiet=[(2.75,3.0),(20.8,21.0)]
def q(t): return any(a<=t<b for a,b in quiet)
for k in range(50):
    t=k*B
    if t>=24.0: break
    if not q(t): add(kick(0.95 if k%2==0 else .9),t)
    if k%2==1 and t>=1.0 and not q(t): add(clap(),t,.7,.1)
    if not q(t+B/2): add(hat(True),t+B/2,.8,-.2)
    if t>=3.0:
        for s in (0.25,0.75): 
            if not q(t+s*B*2-.0): add(hat(False),t+s*B,.6,.25)
    ch,bn=prog[int(t//2)%4]
    if t>=1.5 and not q(t+B/2): add(note(midi(bn),0.22,'bass',.55),t+B/2)
    if t>=3.0 and k%2==0 and not q(t+.75*B): add(chord([midi(m) for m in ch],0.3),t+.75*B,1,(-.3 if k%4==0 else .3))

n=int(3.0*SR); tt=np.arange(n)/SR
pad=sum(np.sin(2*np.pi*midi(m)*tt) for m in [57,60,64,67,72])*np.exp(-tt/1.2)*0.06
add(pad,24.0)
# master
fade=np.ones(N); k=int(24.3*SR); fade[k:]=np.linspace(1,0,N-k)
L*=fade; R*=fade
m=max(np.abs(L).max(),np.abs(R).max()); L=np.tanh(L/m*1.5)/np.tanh(1.5)*0.89; R=np.tanh(R/m*1.5)/np.tanh(1.5)*0.89
out=(np.stack([L,R],1)*32767).astype('<i2')
with wave.open(sys.argv[1],'wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(out.tobytes())
print('ok')
