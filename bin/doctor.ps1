#Requires -Version 5.1
$ErrorActionPreference = 'Stop'
$RepoRoot = Split-Path -Parent $PSScriptRoot
Push-Location $RepoRoot
try {
  $BuiltCli = Join-Path $RepoRoot 'dist\index.js'
  if (Test-Path -LiteralPath $BuiltCli) {
    & node $BuiltCli doctor --pretty
  }
  else {
    throw 'Missing built CLI (dist\index.js). Run pnpm build or re-download the complete release.'
  }
  exit $LASTEXITCODE
}
finally {
  Pop-Location
}
