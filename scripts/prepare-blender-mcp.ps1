param([string]$Python = 'python')
$ErrorActionPreference = 'Stop'
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$ToolsRoot = Join-Path $ProjectRoot '.tools'
$BlenderRoot = Join-Path $ToolsRoot 'blender-5.1.2-windows-x64'
$SourceRoot = Join-Path $ToolsRoot 'blender-mcp-official'
$VenvRoot = Join-Path $ToolsRoot 'blender-mcp-venv'
$Archive = Join-Path $ToolsRoot 'blender-5.1.2-windows-x64.zip'
$ExpectedHash = '345bedea7b0acf7cc9666423d8553f9129622aea34ded65c23e8cb70f83f14ff'
$ExpectedCommit = '2cea8d566dde07fbac28a61d698909d69724e853'
New-Item -ItemType Directory -Path $ToolsRoot -Force | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $BlenderRoot 'blender.exe'))) {
    if (-not (Test-Path -LiteralPath $Archive)) {
        & curl.exe --fail --location --output $Archive 'https://download.blender.org/release/Blender5.1/blender-5.1.2-windows-x64.zip'
        if ($LASTEXITCODE -ne 0) { throw 'Blender download failed.' }
    }
    if ((Get-FileHash -LiteralPath $Archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $ExpectedHash) {
        throw 'Blender archive checksum mismatch. No extraction performed.'
    }
    Expand-Archive -LiteralPath $Archive -DestinationPath $ToolsRoot
}
if (-not (Test-Path -LiteralPath $SourceRoot)) {
    & git clone --branch v1.0.3 --depth 1 'https://projects.blender.org/lab/blender_mcp.git' $SourceRoot
    if ($LASTEXITCODE -ne 0) { throw 'Official MCP clone failed.' }
}
$ActualCommit = & git -C $SourceRoot rev-parse HEAD
if ($LASTEXITCODE -ne 0 -or $ActualCommit -ne $ExpectedCommit) {
    throw 'MCP source is not the pinned official revision; existing files preserved.'
}
if (-not (Test-Path -LiteralPath (Join-Path $VenvRoot 'Scripts/python.exe'))) {
    & $Python -m venv $VenvRoot
    if ($LASTEXITCODE -ne 0) { throw 'Python venv creation failed. Python 3.10+ is required.' }
}
& (Join-Path $VenvRoot 'Scripts/python.exe') -m pip install (Join-Path $SourceRoot 'mcp')
if ($LASTEXITCODE -ne 0) { throw 'MCP package installation failed.' }
Write-Output 'Local Blender and official MCP are ready. See BLENDER_WORKFLOW.md.'
