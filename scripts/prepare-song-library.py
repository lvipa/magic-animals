"""Prepare licensed recordings for the interactive song scenes.

Run with .voice-tools/Scripts/python.exe; needs curl-cffi and imageio-ffmpeg.
No TTS, pitch correction, vocal resynthesis or time stretching. The sung mix
already contains its original accompaniment; never layer another backing on it.
Raw recordings/exports are excluded from GitHub (Pixabay standalone restriction).
"""
from pathlib import Path
import json, hashlib, subprocess
from curl_cffi import requests
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
catalog = json.loads((ROOT/'src/singing/catalog.json').read_text(encoding='utf-8'))
cache = ROOT/'artifacts/singing/studio-sources'
cache.mkdir(parents=True, exist_ok=True)
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
limits = {'twinkle-v1': {'duration': 26, 'echo': 72, 'lines': 6},
          'twinkle-v2-natural': {'duration': 28.1, 'echo': 72, 'lines': 6}}
def add_limit(song):
    echo = sum(2*(l['end']-l['start'])+1 for l in song['lines'])
    limits[song['id']] = {'duration':song['duration'], 'concert':song.get('concert',{}).get('duration',song['duration']),
                         'echo':round(echo,3), 'lines':len(song['lines']), 'video':bool(song.get('video'))}
for previous in json.loads((ROOT/'src/singing/legacyCatalog.json').read_text(encoding='utf-8')):
    add_limit(previous)
for song in catalog:
    add_limit(song)
    if song.get('video'):
        continue # Official video embeds: never download or extract their audio.
    out = ROOT/'public'/Path(song['mix'].lstrip('/')).parent
    out.mkdir(parents=True, exist_ok=True)
    recording = song['recording']
    hashes = {}
    for kind, url, length in [('mix', recording['sourceURL'], recording['clip']),
                              ('instrumental', recording['backingURL'], recording['backingClip'])]:
        source = cache/(song['id']+'-'+kind+'.mp3')
        if not source.exists():
            response = requests.get(url, impersonate='chrome', timeout=45)
            response.raise_for_status()
            source.write_bytes(response.content)
        hashes[kind] = hashlib.sha256(source.read_bytes()).hexdigest()
        # Preserve the recording's original pace and timbre. Only gain/trim/fades.
        fade = max(0, length-.15)
        filters = f'afade=t=out:st={fade}:d=0.15,adelay=1000:all=1,loudnorm=I=-18:TP=-1.5:LRA=11'
        subprocess.run([ffmpeg,'-y','-i',str(source),'-af',filters,'-ar','44100',
                        '-codec:a','libmp3lame','-b:a','192k',str(out/(kind+'.mp3'))],
                       check=True,capture_output=True)
    credits = {**recording, 'song': song['title'], 'sourceSHA256': hashes,
               'changes': 'Complete source recording; one-second lead-in, short tail fade, loudness normalization, MP3 encoding. Sung performance and its original accompaniment preserved together. Instrumental concert is a separate recording by the same musician.',
               'usage': 'Embedded in interactive animated English lessons. Do not distribute these recordings as a standalone audio pack.',
               'reference': 'https://kolibelnie-pesni.com/media/twinkle-twinkle-little-star' if song['id'].startswith('twinkle') else None,
               'referenceIncluded': False}
    (out/'credits.json').write_text(json.dumps(credits,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    # Echo gives at least a full phrase plus half a second for celebration.
    print('Prepared',song['title'],flush=True)
(ROOT/'public/music/song-limits.json').write_text(json.dumps(limits,indent=2)+'\n',encoding='utf-8')
