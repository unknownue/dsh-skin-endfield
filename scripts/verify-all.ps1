# Run every verification layer for dsh-skin-endfield.
#
# Layers, cheapest first:
#   1. typecheck            — the source compiles
#   2. build                — both halves bundle
#   3. verify-client.mjs    — browser-half contract and decor guardrails (no DOM)
#   4. verify-host.mjs      — host-half route, traversal guard, teardown
#   5. smoke-browser.mjs    — the built bundle in headless Chrome + screenshot
#   6. verify-install.ps1   — would the running profile be able to load it
#
# Usage: pwsh -File scripts/verify-all.ps1
$ErrorActionPreference = 'Continue'
$root = Resolve-Path (Join-Path $PSScriptRoot '..')
Push-Location $root
$results = New-Object System.Collections.Generic.List[object]

function Step([string]$Name, [scriptblock]$Body) {
    Write-Host ""
    Write-Host "=== $Name ===" -ForegroundColor Cyan
    & $Body
    $code = $LASTEXITCODE
    $results.Add([pscustomobject]@{ Step = $Name; Exit = $code; Ok = ($code -eq 0) })
    if ($code -ne 0) { Write-Host "  -> exit $code" -ForegroundColor Red }
}

Step 'typecheck'        { pnpm run typecheck }
Step 'build'            { pnpm run build }
Step 'verify: client'   { node scripts/verify-client.mjs }
Step 'verify: host'     { node scripts/verify-host.mjs }
Step 'verify: install'  { pwsh -NoProfile -File scripts/verify-install.ps1 }
Step 'smoke: browser'   { node scripts/smoke-browser.mjs }

Pop-Location
Write-Host ""
Write-Host "=== summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$failed = ($results | Where-Object { -not $_.Ok }).Count
Write-Host ("steps: {0} ok, {1} failed" -f ($results.Count - $failed), $failed)
Write-Host "(verify: install is expected to report unregistered checks until the skin is installed)"
exit $failed
