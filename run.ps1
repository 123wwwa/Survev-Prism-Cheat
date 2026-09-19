param([ValidateSet('build', 'deploy', 'watch', 'test')][string]$Mode = 'build')
$ErrorActionPreference = 'Stop'
$runtimeRoot = Join-Path $env:USERPROFILE '.cache\codex-runtimes\codex-primary-runtime\dependencies'
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    $bundledNode = Join-Path $runtimeRoot 'node\bin\node.exe'
    if (-not (Test-Path -LiteralPath $bundledNode)) {
        throw 'Node.js 22.18+ or 24 is required. Install Node.js or run inside Codex.'
    }
    $env:PATH = (Split-Path $bundledNode) + ';' + $env:PATH
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    $bundledPnpm = Join-Path $runtimeRoot 'bin\fallback\pnpm.cmd'
    if (-not (Test-Path -LiteralPath $bundledPnpm)) {
        throw 'pnpm is required. Install pnpm, then rerun this command.'
    }
    $env:PATH = (Split-Path $bundledPnpm) + ';' + $env:PATH
}
Push-Location $PSScriptRoot
try {
    if ($Mode -eq 'test') { & node --test 'tests/*.test.mjs' }
    else { & node scripts/pipeline.mjs $Mode }
    $result = $LASTEXITCODE
} finally { Pop-Location }
exit $result
