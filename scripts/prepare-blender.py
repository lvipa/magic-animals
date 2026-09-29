"""Use a portable, checksummed official Blender release only inside this workspace."""
from pathlib import Path
import urllib.request, zipfile, hashlib, subprocess
root = Path(__file__).resolve().parent.parent
tools = root / '.tools'
tools.mkdir(exist_ok=True)
version = '4.5.14'
base = 'https://download.blender.org/release/Blender4.5/'
filename = f'blender-{version}-windows-x64.zip'
archive = tools / filename
manifest_path = tools / 'blender.sha256'
subprocess.run(['curl.exe','-f','-L','--max-time','30','-sS',base + f'blender-{version}.sha256','-o',str(manifest_path)],check=True)
manifest = manifest_path.read_text()
expected = next(line.split()[0] for line in manifest.splitlines() if filename in line)
if not archive.exists():
    print('Downloading official portable Blender...',flush=True)
    subprocess.run(['curl.exe','-f','-L','--max-time','600','-sS',base + filename,'-o',str(archive)],check=True)
if hashlib.sha256(archive.read_bytes()).hexdigest() != expected: raise RuntimeError('Blender checksum mismatch')
print('Checksum verified. Extracting within .tools...',flush=True)
with zipfile.ZipFile(archive) as zip:
    for item in zip.infolist():
        target = (tools / item.filename).resolve()
        if not target.is_relative_to(tools.resolve()): raise RuntimeError('Unsafe archive path')
    zip.extractall(tools)
print(tools / f'blender-{version}-windows-x64/blender.exe',flush=True)
