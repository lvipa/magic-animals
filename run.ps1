param([string]$Task = 'dev', [Parameter(ValueFromRemainingArguments=$true)][string[]]$Extra)
$candidate = (Get-Command node -ErrorAction Stop).Source
$versionText = & $candidate --version
if ([Version]$versionText.TrimStart('v') -lt [Version]'22.12.0') {
  $bundledNode = Join-Path $env:USERPROFILE '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node.exe'
  if (-not (Test-Path -LiteralPath $bundledNode)) { throw 'Install Node.js 22.12+ or 24 LTS, then use npm install and npm run dev.' }
  $candidate = $bundledNode
}
$npmRoot = Split-Path (Get-Command npm -ErrorAction Stop).Source
$npmCli = Join-Path $npmRoot 'node_modules/npm/bin/npm-cli.js'
$originalPath = $env:PATH
try {
  $env:PATH = (Split-Path $candidate) + ';' + $originalPath
  if ($Task -in @('install','ci','audit')) { & $candidate $npmCli $Task @Extra }
  else { & $candidate $npmCli run $Task -- @Extra }
  $resultCode = $LASTEXITCODE
} finally { $env:PATH = $originalPath }
exit $resultCode
