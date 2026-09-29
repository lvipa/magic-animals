$projectRoot = Split-Path $PSScriptRoot
$voicePython = Join-Path $projectRoot '.voice-tools/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $voicePython)) { throw 'Prepare the voice tools as described in AUDIO_PRODUCTION.md.' }
& $voicePython -X utf8 (Join-Path $PSScriptRoot 'generate-neural-audio.py')
exit $LASTEXITCODE
