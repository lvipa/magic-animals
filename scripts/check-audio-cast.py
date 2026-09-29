"""Verify all shipped voice/effect files and the eight-character coverage."""
from pathlib import Path
import json, wave, hashlib, math, struct
root=Path(__file__).resolve().parent.parent
report=json.loads((root/'public/audio/manifest.json').read_text(encoding='utf-8'))
clips={clip['cue']:clip for clip in report['clips']}
ids=['foxy','cat','dog','lion','bunny','bear','panda','elephant']
voices=set()
for id in ids:
    voices.add(clips[f'character-{id}-idle']['voice'])
    for action in ['idle','happy','wave','jump','run','sleep','roar']:
        assert clips[f'character-{id}-{action}']['group']=='characters'
    assert f'call-{id}' in clips
assert len(voices)==8, 'Each friend must have its own base voice'
assert len({clips[f'call-{id}']['sha256'] for id in ids})==8, 'Animal effects must differ'
for cue,clip in clips.items():
    path=root/'public/audio'/clip['group']/f'{cue}.wav'
    assert path.is_file() and path.with_suffix('.mp3').stat().st_size>500
    with wave.open(str(path)) as wav:
        assert wav.getnchannels()==1 and wav.getsampwidth()==2 and wav.getframerate()==24000
        count=wav.getnframes(); samples=struct.unpack('<'+'h'*count,wav.readframes(count))
        duration=count/wav.getframerate()
    assert abs(duration-clip['duration'])<.05
    peak=max(abs(v) for v in samples)/32768
    assert .01<peak<.76, (cue,'silent or clipping audio')
    assert hashlib.sha256(path.read_bytes()).hexdigest()==clip['sha256'], cue
print(f'PASS audio cast: {len(clips)} clips, eight different voices, eight different effects, no silent/clipping WAV files')
