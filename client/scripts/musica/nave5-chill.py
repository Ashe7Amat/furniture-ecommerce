# Uso: python3 scripts/musica/nave5-chill.py salida.wav  (luego: ffmpeg -i salida.wav -af "highpass=f=30,lowpass=f=15000,loudnorm=I=-18:TP=-1.5" -b:a 112k public/audio/nave5-chill.mp3)
# Instrumental original estilo pop francés chill (~100 BPM). Todo sintetizado: sin derechos de terceros.
import numpy as np, wave, sys
SR=44100; BPM=100; BEAT=60/BPM; BAR=4*BEAT
rng=np.random.default_rng(7)
def n2f(n): return 440*2**((n-69)/12)
BARS=32
L=int(SR*BAR*BARS)+SR*2
mixL=np.zeros(L); mixR=np.zeros(L)
def add(sig,t,pan=0.0,g=1.0):
    i=int(t*SR); j=min(L,i+len(sig)); s=sig[:j-i]*g
    mixL[i:j]+=s*np.sqrt(0.5*(1-pan)); mixR[i:j]+=s*np.sqrt(0.5*(1+pan))
def env(n,a,d,s,r,hold):
    t=np.arange(n)/SR; e=np.ones(n)*s
    e[t<a]=t[t<a]/a
    m=(t>=a)&(t<a+d); e[m]=1-(1-s)*(t[m]-a)/d
    m=t>=hold; e[m]=s*np.exp(-(t[m]-hold)/r)
    return e
def rhodes(note,dur,vel=1.0):
    n=int(SR*(dur+1.2)); t=np.arange(n)/SR; f=n2f(note)
    idx=2.2*np.exp(-t*6)+0.3
    s=np.sin(2*np.pi*f*t+idx*np.sin(2*np.pi*f*t))
    s+=0.25*np.sin(2*np.pi*2*f*t)*np.exp(-t*3)
    s*=np.exp(-t*1.4)*(1+0.15*np.sin(2*np.pi*4.5*t))  # trémolo suave
    rel=np.ones(n); k=int(dur*SR); rel[k:]=np.exp(-(np.arange(n-k))/SR/0.15)
    return s*rel*vel*0.11
def bass(note,dur):
    n=int(SR*(dur+0.1)); t=np.arange(n)/SR; f=n2f(note)
    s=np.sin(2*np.pi*f*t)+0.3*np.sin(2*np.pi*2*f*t)+0.1*np.sin(2*np.pi*3*f*t)
    e=np.minimum(1,t/0.005)*np.exp(-t*1.5); e[int(dur*SR):]*=np.exp(-np.arange(n-int(dur*SR))/SR/0.03)
    return s*e*0.32
def kick():
    n=int(SR*0.4); t=np.arange(n)/SR
    f=45+90*np.exp(-t*30); ph=2*np.pi*np.cumsum(f)/SR
    return np.sin(ph)*np.exp(-t*9)*0.7
def snap():
    n=int(SR*0.25); t=np.arange(n)/SR; w=rng.standard_normal(n)
    w=np.diff(np.concatenate([[0],w]))  # agudo
    s=w*(np.exp(-t*35)+0.4*np.exp(-np.maximum(t-0.012,0)*35)*(t>0.012))
    return s*0.18
def hat(open_=False):
    n=int(SR*(0.2 if open_ else 0.05)); t=np.arange(n)/SR
    w=np.diff(np.concatenate([[0],rng.standard_normal(n)]))
    return w*np.exp(-t*(18 if open_ else 80))*0.05
def lead(note,dur):
    n=int(SR*(dur+0.3)); t=np.arange(n)/SR; f=n2f(note)*(1+0.004*np.sin(2*np.pi*5.5*t)*np.minimum(1,t/0.25))
    ph=2*np.pi*np.cumsum(f)/SR
    s=np.sin(ph)+0.12*np.sin(2*ph)+0.006*rng.standard_normal(n)
    e=np.minimum(1,t/0.04); k=int(dur*SR); e[k:]*=np.exp(-np.arange(n-k)/SR/0.12)
    return s*e*0.10
# Progresión: Dm9 - G13 - Cmaj9 - Am7 (dos compases cada uno → 8 compases)
chords=[[50,53,57,60,64],[43+12,53,57,59,64],[48,52,55,59,62],[45,52,55,60,64]]
roots=[38,31,36,33]
# Melodía (silbido) en dos frases de 8 compases: (compás, tiempo, nota, duración en tiempos)
mel=[(0,1,69,0.5),(0,1.5,72,0.5),(0,2,74,1),(0,3.5,72,0.5),(1,0,69,1.5),(1,2,67,1),
     (2,1,67,0.5),(2,1.5,69,0.5),(2,2,71,1),(2,3.5,69,0.5),(3,0,67,2),
     (4,1,64,0.5),(4,1.5,67,0.5),(4,2,69,1),(4,3,72,1),(5,0,71,1),(5,1,69,0.5),(5,1.5,67,2),
     (6,1,64,0.5),(6,1.5,65,0.5),(6,2,67,1),(6,3,69,0.5),(7,0,64,3)]
for bar in range(BARS):
    t0=bar*BAR; ci=(bar//2)%4; sec=bar//8  # 0 intro, 1 groove, 2 melodía, 3 melodía+
    # piano: acorde en el 1 y empuje sincopado en el "y" del 2
    for b,v in [(0,1.0),(1.5,0.7),(3,0.6)]:
        for k,nn in enumerate(chords[ci]):
            add(rhodes(nn,BEAT*1.2,v),t0+b*BEAT+k*0.006,pan=-0.3+0.15*k)
    if sec>=1:
        r=roots[ci]
        for b,nn,d in [(0,r,0.9),(1.5,r,0.4),(2,r+12,0.4),(2.75,r+7,0.4),(3.5,r,0.4)]:
            add(bass(nn,d*BEAT),t0+b*BEAT)
        for b in [0,2.5]: add(kick(),t0+b*BEAT)
        for b in [1,3]: add(snap(),t0+b*BEAT,pan=0.1)
    for i in range(8):
        sw=0.06*BEAT if i%2 else 0  # swing ligero
        if sec>=1 or i%2==0:
            add(hat(open_=(i==7 and sec>=2)),t0+i*BEAT/2+sw,pan=0.35,g=0.6+0.4*(i%2))
    if sec>=2:
        for (mb,b,nn,d) in mel:
            if mb==bar%8: add(lead(nn+(12 if sec==3 and mb>=4 else 0),d*BEAT),t0+b*BEAT,pan=-0.1)
# eco sencillo + reverb de pobre
def delay(x,dt,fb):
    d=int(dt*SR); y=x.copy()
    for k in range(1,5): y[d*k:]+=x[:-d*k]*(fb**k)
    return y
wetL=delay(mixL,BEAT*0.75,0.3); wetR=delay(mixR,BEAT*0.5,0.3)
outL=mixL*0.8+wetL*0.2; outR=mixR*0.8+wetR*0.2
end=int(SR*BAR*BARS); outL=outL[:end]; outR=outR[:end]
fade=int(SR*1.5); outL[:int(SR*0.05)]*=np.linspace(0,1,int(SR*0.05)); outR[:int(SR*0.05)]*=np.linspace(0,1,int(SR*0.05))
st=np.stack([outL,outR],1); st=np.tanh(st*1.4)/np.tanh(1.4); st/=np.max(np.abs(st))*1.12
w=wave.open(sys.argv[1],'wb'); w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
w.writeframes((st*32767).astype('<i2').tobytes()); w.close()
