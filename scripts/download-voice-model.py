"""Download public Kokoro build-time weights; never shipped to the game."""
from pathlib import Path
from urllib.request import urlopen, Request
from concurrent.futures import ThreadPoolExecutor

cache = Path('.voice-tools/models')
cache.mkdir(parents=True, exist_ok=True)
release = 'https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/'
files = ['kokoro-v1.0.onnx', 'voices-v1.0.bin']

def download(name):
    path = cache / name
    if path.exists() and path.stat().st_size > 1000000:
        print(f'Cached {name}', flush=True)
        return
    url = release + name
    try:
        response = urlopen(Request(url, headers={'User-Agent': 'MagicAnimals-asset-builder'}), timeout=60)
    except Exception:
        url = url.replace('model-files-v1.0', 'model-files-v1.1')
        response = urlopen(Request(url, headers={'User-Agent': 'MagicAnimals-asset-builder'}), timeout=60)
    partial = path.with_suffix(path.suffix + '.partial')
    with response, partial.open('wb') as out:
        count = 0
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
            count += len(chunk)
            if count % (32 * 1024 * 1024) == 0:
                print(f'{name}: {count // 1024 // 1024} MiB', flush=True)
    partial.replace(path)
    print(f'Downloaded {name}: {path.stat().st_size} bytes', flush=True)

with ThreadPoolExecutor(max_workers=2) as pool:
    list(pool.map(download, files))
