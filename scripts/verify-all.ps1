# Run every verification layer for dsh-skin-endfield.
#
# Layers, cheapest first:
#   1. typecheck            — the source compiles
#   2. build                — both halves bundle
#   3. verify-client.mjs    — browser-half contract and decor guardrails (no DOM)
#   4. verify-host.mjs      — host-half route, traversal guard, teardown
#   5. verify-install.ps1   — would the running profile be able to load it
#   6. smoke-browser.mjs    — the built bundle in headless Chrome + screenshot
#   7. verify-*-live.mjs    — the REAL GUI, reading computed values back
#
# Layer 7 needs a running `dsh web` and its token in $env:DSH_URL. It is skipped
# with a clear note when either is missing, because "the app is not running" is
# not a skin defect. When it does run it is the only layer that can prove a rule
# WINS against the shell's own styling — and the only one that can prove a
# *colour*: a token value in the bundle and the painted pixel are different
# claims (verify-error-ink-live.mjs exists because "Error" once painted magenta).
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

# The live layer needs the app's current URL; recover it from the launcher's log
# so a normal `make restart-dsh` run needs no manual export.
if (-not $env:DSH_URL) {
    $log = Join-Path $env:USERPROFILE '.dsh-web.out.log'
    if (Test-Path $log) {
        $match = Select-String -Path $log -Pattern 'http://\S*token=\S*' -AllMatches |
            ForEach-Object { $_.Matches } | ForEach-Object { $_.Value } | Select-Object -Last 1
        if ($match) {
            $env:DSH_URL = $match
            Write-Host "using DSH_URL recovered from $log" -ForegroundColor DarkGray
        }
    }
}

Step 'typecheck'        { pnpm run typecheck }
Step 'build'            { pnpm run build }
Step 'verify: client'   { node scripts/verify-client.mjs }
Step 'verify: host'     { node scripts/verify-host.mjs }
Step 'verify: settings' { node scripts/verify-settings-parity.mjs }
Step 'verify: install'  { pwsh -NoProfile -File scripts/verify-install.ps1 }
Step 'smoke: browser'   { node scripts/smoke-browser.mjs }

if ($env:DSH_URL) {
    Step 'live: composition (skin is served)'     { node scripts/verify-composition.mjs }
    Step 'live: corners (composer + code blocks)' { node scripts/verify-corners-live.mjs }
    Step 'live: focus signature'                  { node scripts/verify-focus-signature.mjs }
    Step 'live: tool-block chrome'                { node scripts/verify-tool-block-chrome.mjs }
    Step 'live: shell chrome (sidebar + header)'  { node scripts/verify-sidebar-chrome.mjs }
    Step 'live: typography + message bubble'      { node scripts/verify-typography-and-bubble.mjs }
    Step 'live: corner brackets (composer+bubble)' { node scripts/verify-brackets-live.mjs }
    Step 'live: top bars (header + pane strip)'    { node scripts/verify-top-bars-live.mjs }
    Step 'live: error ink (red, not magenta)'      { node scripts/verify-error-ink-live.mjs }
    Step 'live: composer band is opaque'           { node scripts/verify-composer-opacity.mjs }
    Step 'live: tooltips do not move the page'     { node scripts/verify-tooltip-stability-live.mjs }
    Step 'live: queue strip wears the skin'        { node scripts/verify-queue-dock-live.mjs }
    Step 'live: active session marker (bar only)'  { node scripts/verify-session-marker-live.mjs }
    Step 'live: deliverable summaries (diff list)' { node scripts/verify-deliverables-live.mjs }
} else {
    Write-Host ""
    Write-Host "=== live layers skipped ===" -ForegroundColor Yellow
    Write-Host "No DSH_URL and no token found in ~/.dsh-web.out.log, so the running-GUI"
    Write-Host "checks did not run. Start dsh web, or export DSH_URL with its printed URL."
}

Pop-Location
Write-Host ""
Write-Host "=== summary ===" -ForegroundColor Cyan
$results | Format-Table -AutoSize
$failed = ($results | Where-Object { -not $_.Ok }).Count
Write-Host ("steps: {0} ok, {1} failed" -f ($results.Count - $failed), $failed)
Write-Host "(verify: install is expected to report unregistered checks until the skin is installed)"
exit $failed
