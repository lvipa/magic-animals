"""Reproducible first-song demo: CC0 sung verse + original bell arrangement.

Run with .voice-tools/Scripts/python.exe. Requires praat-parselmouth,
numpy, scipy, soundfile, imageio-ffmpeg. Downloads no account/private data.
"""
from pathlib import Path
import hashlib, json, subprocess, urllib.request
import numpy as np
import soundfile as sf
import parselmouth
from parselmouth.praat import call
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/music/twinkle-v1'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE = ROOT / 'artifacts/singing/twinkle-source.ogg'
SOURCE.parent.mkdir(parents=True, exist_ok=True)
URL = 'https://upload.wikimedia.org/wikipedia/commons/4/4f/Twinkle_Twinkle_Little_Star_-_sung_with_full_lyrics.ogg'
if not SOURCE.exists():
    req = urllib.request.Request(URL, headers={'User-Agent': 'MagicAnimals/1.0'})
    SOURCE.write_bytes(urllib.request.urlopen(req, timeout=60).read())
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
raw = SOURCE.with_suffix('.wav')
subprocess.run([ffmpeg, '-y', '-i', str(SOURCE), '-ar', '24000', '-ac', '1', str(raw)], check=True, capture_output=True)
x, sr = sf.read(raw)
# Breath boundaries in the first verse of the source recording.
bounds = [0.2, 4.7, 9.3, 13.8, 18.4, 22.8, 27.3]
notes = [[60,60,67,67,69,69,67], [65,65,64,64,62,62,60],
         [67,67,65,65,64,64,62], [67,67,65,65,64,64,62],
         [60,60,67,67,69,69,67], [65,65,64,64,62,62,60]]
duration = 26.0
voice = np.zeros(round(duration * sr))
music = np.zeros_like(voice)
for line, melody in enumerate(notes):
    start, end = bounds[line:line+2]
    segment = parselmouth.Sound(x[round(start*sr):round(end*sr)], sr)
    # A lighter timbre; pitch follows the melody rather than spoken TTS.
    segment = call(segment, 'Change gender', 75, 600, 1.18, 0, 1, 1)
    manipulation = call(segment, 'To Manipulation', .01, 75, 700)
    tier = call(manipulation, 'Extract pitch tier')
    call(tier, 'Remove points between', 0, segment.duration)
    for n, midi in enumerate(melody):
        onset = n * segment.duration / 8
        freq = 440 * 2 ** ((midi - 69) / 12)
        call(tier, 'Add point', max(.001, onset + .025), freq)
        call(tier, 'Add point', min(segment.duration-.001, (n+1 if n<6 else 8)*segment.duration/8-.025), freq)
    call([tier, manipulation], 'Replace pitch tier')
    dt = call(manipulation, 'Extract duration tier')
    call(dt, 'Add point', segment.duration / 2, 4 / segment.duration)
    call([dt, manipulation], 'Replace duration tier')
    tuned = call(manipulation, 'Get resynthesis (overlap-add)')
    a = tuned.values[0]
    # Exact phrase boundaries; trim/pad trailing silence only.
    a = np.pad(a[:4*sr], (0, max(0,4*sr-len(a))))
    fade = min(240, len(a)//2)
    a[:fade] *= np.linspace(0,1,fade); a[-fade:] *= np.linspace(1,0,fade)
    at = round((1+line*4)*sr)
    voice[at:at+len(a)] = a
    for n, midi in enumerate(melody):
        t = np.arange(round((.43 if n<6 else .93)*sr))/sr
        f = 440*2**((midi-69)/12)
        bell = (np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*2*f*t)+.08*np.sin(2*np.pi*3*f*t))
        bell *= (1-np.exp(-t*100))*np.exp(-t*4)*.13
        i=round((1+line*4+n*.5)*sr)
        music[i:i+len(bell)] += bell
    # Warm sustained tonic/chord pad, quiet enough for a child's own singing.
    t=np.arange(4*sr)/sr
    chord=([48,52,55] if line in [0,4,5] else [53,57,60] if line==1 else [55,59,62])
    pad=sum(np.sin(2*np.pi*(440*2**((m-69)/12))*t) for m in chord)*.017
    pad *= np.sin(np.pi*np.minimum(t/.3,1)/2)*np.sin(np.pi*np.minimum((4-t)/.4,1)/2)
    music[at:at+len(pad)] += pad
voice *= .78 / max(.001, np.max(np.abs(voice)))
for name, data in [('vocal',voice),('instrumental',music)]:
    wav=SOURCE.parent/f'{name}.wav'; sf.write(wav,data,sr)
    loudness = 'loudnorm=I=-19:TP=-1.5:LRA=7' if name == 'vocal' else 'loudnorm=I=-25:TP=-3:LRA=7'
    subprocess.run([ffmpeg,'-y','-i',str(wav),'-af',loudness,'-ar','24000','-codec:a','libmp3lame','-b:a','128k',str(OUT/f'{name}.mp3')],check=True,capture_output=True)
credits = {'song':'Twinkle, Twinkle, Little Star', 'lyrics':'Jane Taylor, 1806 (first verse)',
 'melody':'Traditional French melody, Ah! vous dirai-je, maman',
 'vocalAuthor':'Derrick Coetzee / Dcoetzee', 'sourcePage':'https://commons.wikimedia.org/wiki/File:Twinkle_Twinkle_Little_Star_-_sung_with_full_lyrics.ogg',
 'sourceURL':URL,'sourceSHA256':hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
 'vocalLicense':'CC0 1.0','licenseURL':'https://creativecommons.org/publicdomain/zero/1.0/',
 'changes':'First verse extracted; formant adjustment, melody pitch correction, phrase duration normalization, fades, loudness normalization, MP3 encoding.',
 'arrangement':'Original synthesized bell and pad accompaniment by Magic Animals. CC0 1.0.',
 'status':'Prototype guide vocal; requires listening review before final child-facing voice production.',
 'duration':duration, 'phraseStart':[1,5,9,13,17,21], 'phraseEnd':[5,9,13,17,21,25]}
(OUT/'credits.json').write_text(json.dumps(credits,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated synchronized 26-second vocal and instrumental stems.')
