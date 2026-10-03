"""Create one original, fully annotated stereo demonstration; no imported recording."""
from pathlib import Path
import hashlib, json, math, struct, wave
ROOT = Path(__file__).resolve().parent
SR, BPM, BARS = 22050, 120, 8
DURATION = BARS * 4 * 60 / BPM

def build():
    # Supplied composition, with a varied second phrase. These are annotations,
    # not detected beats, phrases or evidence of feedback regulation.
    melody = [[60,64,67,64],[62,65,69,65],[64,67,71,67],[62,65,67,62],
              [60,64,67,72],[69,65,62,65],[67,64,60,64],[62,59,60,60]]
    bass = [48,50,52,43,48,41,43,48]
    notes=[]
    for bar in range(BARS):
        for beat,pitch in enumerate(melody[bar]):
            notes.append(dict(id=f'm{bar+1}-{beat+1}',part='melody',midi=pitch,start_s=bar*2+beat*.5,duration_s=.44,pan=(-.3 if bar<4 else .3),amplitude=.19))
        notes.append(dict(id=f'b{bar+1}',part='bass',midi=bass[bar],start_s=bar*2,duration_s=1.8,pan=.45,amplitude=.13))
        notes.append(dict(id=f'h{bar+1}',part='harmony',midi=bass[bar]+19,start_s=bar*2+.5,duration_s=1.25,pan=-.6,amplitude=.08))
    frames=int(SR*DURATION); left=[0.0]*frames; right=[0.0]*frames
    for n in notes:
        f=440*2**((n['midi']-69)/12);start=round(n['start_s']*SR);length=round(n['duration_s']*SR)
        angle=(n['pan']+1)*math.pi/4
        for i in range(length):
            t=i/SR; envelope=min(1,t/.012)*min(1,(n['duration_s']-t)/.055)*math.exp(-1.7*t)
            v=n['amplitude']*envelope*(math.sin(2*math.pi*f*t)+.22*math.sin(4*math.pi*f*t)+.08*math.sin(6*math.pi*f*t))
            left[start+i]+=v*math.cos(angle);right[start+i]+=v*math.sin(angle)
    assert max(map(abs,left+right))<1
    raw=b''.join(struct.pack('<hh',round(l*32767),round(r*32767)) for l,r in zip(left,right))
    path=ROOT/'data/music.wav'
    with wave.open(str(path),'wb') as w:w.setnchannels(2);w.setsampwidth(2);w.setframerate(SR);w.writeframes(raw)
    meta={'id':'observatory-eight-bars/1','title':'Eight bars / two phrases','kind':'original_generated_audio','composer':'Original demonstration composed for this prototype','provenance':'Deterministic synthesis from supplied note events in prepare_music.py; no external recording or inferred score structure.','sample_rate_hz':SR,'channels':['left','right'],'units':'signed PCM16 / 32768 full-scale amplitude','duration_s':DURATION,'sample_count_per_channel':frames,'bpm':BPM,'meter':'4/4','structure_status':'supplied composition annotations; not inferred','notes':notes,'beats':[{'index':i+1,'time_s':i*.5} for i in range(32)],'bars':[{'index':i+1,'start_s':i*2,'end_s':(i+1)*2} for i in range(8)],'phrases':[{'name':'Opening phrase','start_s':0,'end_s':8},{'name':'Varied return','start_s':8,'end_s':16}],'form':[{'name':'A','start_s':0,'end_s':8},{'name':'A′','start_s':8,'end_s':16}],'synthesis':{'wave':'sin(f)+0.22*sin(2f)+0.08*sin(3f)','envelope':'12ms attack, 55ms release, exp(-1.7*t) decay','pan':'equal-power cos/sin from supplied pan [-1,1]','quantization':'round(sample*32767), then signed PCM16 little-endian','normalization':'none; peak checked below full scale'},'waveform_policy':'Native PCM samples; display uses min/max bins when samples exceed pixels. No waveform is inferred from metadata.','stereo_policy':'Two synchronized channels from one retained PCM source; channel differences are audible/rendered, not an inference of physical phase.','limitations':['A short supplied trajectory, not a music-analysis or structure-inference benchmark.','A composed return is not evidence of feedback regulation.'],'wav_sha256':hashlib.sha256(path.read_bytes()).hexdigest(),'generator_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest()}
    (ROOT/'data/music.json').write_text(json.dumps(meta,indent=2,ensure_ascii=False)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'wav':str(path),'frames':frames,'sha256':meta['wav_sha256']}))
if __name__=='__main__':build()
