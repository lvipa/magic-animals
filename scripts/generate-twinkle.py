"""Reproducible first-song demo: CC0 sung verse + original bell arrangement.

Run with .voice-tools/Scripts/python.exe. Requires numpy, soundfile,
imageio-ffmpeg. Natural vocal: no pitch/formant correction or resynthesis.
"""
from pathlib import Path
import hashlib, json, subprocess, urllib.request
import numpy as np
import soundfile as sf
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/music/twinkle-v2-natural'
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
duration = 28.1
voice = np.zeros(round(duration * sr))
music = np.zeros_like(voice)
# Keep the original performance timing, breathing, vibrato and singer's timbre.
voice[sr:round(duration*sr)] = x[round(bounds[0]*sr):round(bounds[-1]*sr)]
for line, melody in enumerate(notes):
    start, end = bounds[line:line+2]
    phrase_duration = end-start
    at = round((1+start-bounds[0])*sr)
    for n, midi in enumerate(melody):
        t = np.arange(round((.43 if n<6 else .93)*phrase_duration/4*sr))/sr
        # Original singer's tonic is C sharp; transpose the accompaniment only.
        f = 440*2**((midi+1-69)/12)
        bell = (np.sin(2*np.pi*f*t)+.22*np.sin(2*np.pi*2*f*t)+.08*np.sin(2*np.pi*3*f*t))
        bell *= (1-np.exp(-t*100))*np.exp(-t*4)*.13
        i=at+round(n*phrase_duration/8*sr)
        music[i:i+len(bell)] += bell
    # Warm sustained tonic/chord pad, quiet enough for a child's own singing.
    t=np.arange(round(phrase_duration*sr))/sr
    chord=([48,52,55] if line in [0,4,5] else [53,57,60] if line==1 else [55,59,62])
    pad=sum(np.sin(2*np.pi*(440*2**((m+1-69)/12))*t) for m in chord)*.017
    pad *= np.sin(np.pi*np.minimum(t/.3,1)/2)*np.sin(np.pi*np.minimum((phrase_duration-t)/.4,1)/2)
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
 'changes':'First verse extracted at original tempo and pitch; one-second silent lead-in, loudness normalization and MP3 encoding. No formant alteration, pitch quantization, autotune or time stretching.',
 'arrangement':'Original synthesized bell and pad accompaniment by Magic Animals. CC0 1.0.',
 'status':'Prototype guide vocal; requires listening review before final child-facing voice production.',
 'duration':duration, 'phraseStart':[round(1+b-bounds[0],2) for b in bounds[:-1]], 'phraseEnd':[round(1+b-bounds[0],2) for b in bounds[1:]]}
(OUT/'credits.json').write_text(json.dumps(credits,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print('Generated natural 28.1-second vocal and matching accompaniment.')
