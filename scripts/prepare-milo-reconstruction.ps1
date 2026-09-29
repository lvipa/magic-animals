param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsRoot = Join-Path $ProjectRoot '.tools'
$SourceRoot = Join-Path $ToolsRoot 'triposr-source'
$VenvRoot = Join-Path $ToolsRoot 'triposr-venv'
$ModelRoot = Join-Path $ToolsRoot 'triposr-models'
$SourceCommit = '107cefdc244c39106fa830359024f6a2f1c78871'
$ModelRevision = '5b521936b01fbe1890f6f9baed0254ab6351c04a'
$ModelHash = '429e2c6b22a0923967459de24d67f05962b235f79cde6b032aa7ed2ffcd970ee'
& $Python -c 'import sys; assert sys.version_info[:2] == (3,11), "Use Python 3.11 for the pinned Windows CPU environment."'
if ($LASTEXITCODE -ne 0) { throw 'Python 3.11 is required.' }
New-Item -ItemType Directory -Force -Path $ToolsRoot,$ModelRoot | Out-Null
if (-not (Test-Path -LiteralPath $SourceRoot)) {
    & git init $SourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'Git init failed.' }
    & git -C $SourceRoot remote add origin 'https://github.com/VAST-AI-Research/TripoSR.git'
    if ($LASTEXITCODE -ne 0) { throw 'Git remote setup failed.' }
    & git -C $SourceRoot fetch --depth 1 origin $SourceCommit
    if ($LASTEXITCODE -ne 0) { throw 'Pinned source fetch failed.' }
    & git -C $SourceRoot checkout --detach FETCH_HEAD
    if ($LASTEXITCODE -ne 0) { throw 'Pinned source checkout failed.' }
}
if ((& git -C $SourceRoot rev-parse HEAD) -ne $SourceCommit) { throw 'Existing source is another revision; preserved.' }
if (-not (Test-Path -LiteralPath (Join-Path $VenvRoot 'Scripts/python.exe'))) {
    & $Python -m venv $VenvRoot
    if ($LASTEXITCODE -ne 0) { throw 'Venv creation failed.' }
}
$Runtime = Join-Path $VenvRoot 'Scripts/python.exe'
& $Runtime -m pip install -r (Join-Path $PSScriptRoot 'triposr-cpu-requirements.txt')
if ($LASTEXITCODE -ne 0) { throw 'CPU dependencies failed.' }
& $Runtime -m pip install torch==2.2.2 torchvision==0.17.2 --index-url https://download.pytorch.org/whl/cpu --no-deps
if ($LASTEXITCODE -ne 0) { throw 'Official PyTorch CPU wheel installation failed.' }
& $Runtime -m pip check
if ($LASTEXITCODE -ne 0) { throw 'Inconsistent Python dependencies.' }
$Checkpoint = Join-Path $ModelRoot 'model.ckpt'
if (-not (Test-Path -LiteralPath $Checkpoint)) {
    $PartialCheckpoint = Join-Path $ModelRoot 'model.ckpt.partial'
    & curl.exe --fail --location --output $PartialCheckpoint "https://huggingface.co/stabilityai/TripoSR/resolve/$ModelRevision/model.ckpt"
    if ($LASTEXITCODE -ne 0) { throw 'Model download failed.' }
    if ((Get-FileHash -LiteralPath $PartialCheckpoint -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ModelHash) { throw 'Model checksum mismatch.' }
    Move-Item -LiteralPath $PartialCheckpoint -Destination $Checkpoint
}
if ((Get-FileHash -LiteralPath $Checkpoint -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ModelHash) { throw 'Existing model checksum mismatch.' }
& curl.exe --fail --location --output (Join-Path $ModelRoot 'config.yaml') "https://huggingface.co/stabilityai/TripoSR/resolve/$ModelRevision/config.yaml"
if ($LASTEXITCODE -ne 0) { throw 'Model config download failed.' }
Write-Output 'Local CPU reconstruction environment is ready; see BLENDER_WORKFLOW.md.'
