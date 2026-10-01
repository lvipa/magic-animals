"""Create the shipped English voice and original cartoon calls offline."""
from pathlib import Path
import json
import hashlib
import subprocess
import sys
import numpy as np
import soundfile as sf
from scipy.signal import butter, sosfilt
from kokoro_onnx import Kokoro
import onnxruntime as ort
import imageio_ffmpeg
sys.stdout.reconfigure(encoding='utf-8')

root = Path(__file__).resolve().parent.parent
cache = root / '.voice-tools/models'
options = ort.SessionOptions()
options.intra_op_num_threads = 3
options.inter_op_num_threads = 1
session = ort.InferenceSession(str(cache / 'kokoro-v1.0.onnx'), sess_options=options, providers=['CPUExecutionProvider'])
kokoro = Kokoro.from_session(session, str(cache / 'voices-v1.0.bin'))
lines = json.loads((root / 'scripts/audio-lines.json').read_text(encoding='utf-8'))
output = root / 'public/audio'
ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
incremental = '--only-new' in sys.argv
manifest_path = output / 'manifest.json'
existing = json.loads(manifest_path.read_text(encoding='utf-8'))['clips'] if incremental and manifest_path.exists() else []
report = list(existing)
sr = 24000

def normalized(samples, peak_db=-4.0):
    samples = np.asarray(samples, dtype=np.float64)
    samples -= np.mean(samples)
    if not np.all(np.isfinite(samples)) or np.max(np.abs(samples)) < 1e-5:
        raise RuntimeError('Invalid or silent generated audio')
    window = max(1, int(sr * .008))
    samples[:window] *= np.linspace(0, 1, window)
    samples[-window:] *= np.linspace(1, 0, window)
    return samples / np.max(np.abs(samples)) * 10 ** (peak_db / 20)

def save(cue, group, samples, text, phonemes='', kind='speech', voice='af_heart', pitch=None):
    report[:] = [entry for entry in report if entry['cue'] != cue]
    path = output / group / f'{cue}.wav'
    path.parent.mkdir(parents=True, exist_ok=True)
    samples = np.asarray(samples, dtype=np.float64)
    if kind == 'speech':
        active = np.flatnonzero(np.abs(samples) > np.max(np.abs(samples)) * .015)
        if len(active): samples = samples[max(0, active[0] - int(sr * .035)):min(len(samples), active[-1] + int(sr * .075))]
    samples = normalized(samples, -4 if kind == 'speech' else -8)
    sf.write(path, samples, sr, subtype='PCM_16')
    target_lufs = -18 if kind == 'speech' else -25
    # Original cartoon timbre: brighten Foxy without accelerating consonants.
    # Learning words use a smaller shift to keep their pronunciation easy to hear.
    semitones = (pitch if pitch is not None else 3.5 if group == 'foxy' else 2.5) if kind == 'speech' else 0
    ratio = 2 ** (semitones / 12)
    cartoon = f'asetrate={sr * ratio},aresample={sr},atempo={1 / ratio},' if semitones else ''
    # Keep a PCM master and generate small, consistent MP3 files for Safari.
    mastered = path.with_name(f'{cue}.master.wav')
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-af', f'{cartoon}loudnorm=I={target_lufs}:TP=-3:LRA=7', '-ar', str(sr), '-ac', '1', str(mastered)], check=True)
    mastered.replace(path)
    subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(path), '-c:a', 'libmp3lame', '-b:a', '96k', str(path.with_suffix('.mp3'))], check=True)
    data, rate = sf.read(path)
    peak = float(20 * np.log10(max(np.max(np.abs(data)), 1e-10)))
    report.append({'cue': cue, 'text': text, 'group': group, 'kind': kind, 'voice': voice if kind == 'speech' else 'original procedural cartoon sound', 'pitchSemitones': semitones, 'phonemes': phonemes, 'duration': round(len(data) / rate, 3), 'peakDBFS': round(peak, 2), 'targetLUFS': target_lufs, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    print(f'{cue}: {len(data) / rate:.2f}s; peak {peak:.1f} dBFS; {phonemes}', flush=True)

for cue, line in lines.items():
    old = next((entry for entry in existing if entry['cue'] == cue), None)
    if old and old['text'] == line['text'] and old['voice'] == line.get('voice','af_heart') and (output / old['group'] / f'{cue}.mp3').exists():
        continue
    phonemes = kokoro.tokenizer.phonemize(line['text'], lang='en-us')
    if 'expectedIPA' in line:
        clean = lambda value: ''.join(c for c in value if c not in 'ˈˌ!?., ')
        if clean(phonemes) != clean(line['expectedIPA']):
            raise RuntimeError(f'Unexpected learning-word phonemes: {cue}: {phonemes}')
    voice=line.get('voice','af_heart')
    samples, sample_rate = kokoro.create(phonemes, voice=voice, speed=line['speed'], is_phonemes=True)
    if sample_rate != sr: raise RuntimeError(f'Unexpected sample rate: {sample_rate}')
    save(cue, line['group'], samples, line['text'], phonemes, voice=voice, pitch=line.get('pitch'))

# Soft original cartoon vocalizations, with deterministic noise and tapered envelopes.
# These deliberately represent friendly toy animals, not field recordings.
rng = np.random.default_rng(14838)
def voiced(duration, pitches, formants, breath=.025):
    t = np.arange(int(sr * duration)) / sr
    pitch = np.interp(t / duration, np.linspace(0, 1, len(pitches)), pitches)
    phase = 2 * np.pi * np.cumsum(pitch) / sr
    signal = sum(np.sin(phase * harmonic) / harmonic ** 1.35 for harmonic in range(1, 13))
    shaped = np.zeros_like(signal)
    for low, high, weight in formants:
        shaped += sosfilt(butter(2, [low, high], 'bandpass', fs=sr, output='sos'), signal) * weight
    shaped += sosfilt(butter(2, 1800, 'lowpass', fs=sr, output='sos'), rng.normal(0, breath, len(t)))
    envelope = np.sin(np.pi * t / duration) ** .65
    return shaped * envelope
if not incremental: save('meow', 'animals', voiced(.73, [560, 850, 700, 400], [(550, 1000, 1), (1500, 2300, .6)], .012), 'Soft cartoon meow', kind='sfx')
woof = voiced(.22, [240, 190, 145], [(220, 650, 1), (950, 1600, .25)], .11)
if not incremental:
    save('woof', 'animals', np.concatenate([woof, np.zeros(int(sr * .09)), woof * .72]), 'Two soft cartoon woofs', kind='sfx')
    save('roar', 'animals', voiced(.76, [160, 135, 125, 150], [(180, 580, 1), (900, 1400, .28)], .09), 'Friendly baby-lion rumble', kind='sfx')

preview = []
for cue in ['hello', 'intro', 'find-cat', 'cat', 'a-cat', 'meow', 'find-dog', 'dog', 'woof', 'find-lion', 'lion', 'roar', 'great']:
    entry = next(e for e in report if e['cue'] == cue)
    data, rate = sf.read(output / entry['group'] / f'{cue}.wav')
    preview.extend([data, np.zeros(int(sr * .36))])
sf.write(root / 'artifacts/foxy-voice-preview.wav', np.concatenate(preview), sr, subtype='PCM_16')
subprocess.run([ffmpeg, '-y', '-hide_banner', '-loglevel', 'error', '-i', str(root / 'artifacts/foxy-voice-preview.wav'), '-c:a', 'libmp3lame', '-b:a', '128k', str(root / 'artifacts/foxy-voice-preview.mp3')], check=True)
manifest = {'voiceModel': 'Kokoro 82M v1.0', 'modelLicense': 'Apache-2.0', 'language': 'en-US', 'voice': 'af_heart', 'generation': 'Offline, build-time only. No model or TTS service is used by the game.', 'modelSource': 'https://huggingface.co/hexgrad/Kokoro-82M', 'runtimeSource': 'https://github.com/thewh1teagle/kokoro-onnx', 'clips': report}
(output / 'manifest.json').write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding='utf-8')
(root / 'src/audio/generated.ts').write_text('// Generated by scripts/generate-neural-audio.py\n' +
    '\n'.join('export const '+name+': Record<string, '+kind+'> = '+json.dumps(value,indent=2)+';'
              for name,kind,value in [('cueDurations','number',{e['cue']:e['duration'] for e in report}),
                                     ('cueTexts','string',{e['cue']:e['text'] for e in report}),
                                     ('cueGroups','string',{e['cue']:e['group'] for e in report})])+'\n', encoding='utf-8')
print('Shipped voice, cartoon calls and preview generated.', flush=True)
