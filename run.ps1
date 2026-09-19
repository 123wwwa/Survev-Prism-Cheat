param([ValidateSet('login', 'check', 'build', 'update', 'deploy', 'watch', 'userscript', 'test')][string]$Mode = 'check')
$ErrorActionPreference = 'Stop'
if ($Mode -eq 'login') {
    $gitPath = if ($env:GIT_BIN) { $env:GIT_BIN }
        elseif (Test-Path -LiteralPath 'C:\Program Files\Git\cmd\git.exe') { 'C:\Program Files\Git\cmd\git.exe' }
        else { (Get-Command git -ErrorAction Stop).Source }
    $settings = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'pipeline.config.json') -Raw | ConvertFrom-Json
    if ($settings.publishRepository -notmatch '^https://github\.com/([\w.-]+)/[\w.-]+$') {
        throw 'Expected a GitHub HTTPS publishing repository in pipeline.config.json.'
    }
    $githubOwner = $Matches[1]
    $env:GCM_INTERACTIVE = 'true'
    $env:GIT_TERMINAL_PROMPT = '1'
    Write-Host 'Complete the GitHub device authorization shown below. Keep this terminal open until login finishes.'
    & $gitPath credential-manager github login --username $githubOwner --device --no-ui
    $loginResult = $LASTEXITCODE
    if ($loginResult -eq 0) { Write-Host 'GitHub login completed. Run .\run.cmd update to retry publication.' }
    exit $loginResult
}
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
