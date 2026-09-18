# Check that the plugin can actually be loaded by the running DSH profile.
#
# Deliberately does NOT install anything: `dsh plugin add` and a `dsh web`
# restart touch the user's live environment, so this script only inspects the
# contract and reports what the install step would need to do.
#
# Usage: pwsh -File scripts/verify-install.ps1 [-Profile web]
param(
    [string]$Profile = 'web',
    [string]$Repo = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
)

$ErrorActionPreference = 'Continue'
$fail = 0
function Check([string]$Name, [bool]$Ok, [string]$Detail = '') {
    $mark = if ($Ok) { 'PASS' } else { 'FAIL'; }
    if (-not $Ok) { $script:fail++ }
    Write-Host ("[{0}] {1}{2}" -f $mark, $Name, $(if ($Detail) { "`n        $Detail" } else { '' }))
}

$dshHome = Join-Path $env:USERPROFILE '.dsh'
$profileDir = Join-Path $dshHome "profiles\$Profile"
$packageJson = Join-Path $profileDir 'package.json'

Check 'profile directory exists' (Test-Path $profileDir) $profileDir
Check 'package.json is valid JSON' $true $(try { (Get-Content $packageJson -Raw | ConvertFrom-Json) | Out-Null; 'parsed' } catch { 'PARSE ERROR' })

# ── package contract ────────────────────────────────────────────────────────
$pkg = Get-Content (Join-Path $Repo 'package.json') -Raw | ConvertFrom-Json
$name = $pkg.name
Check 'package name is the bundle row id' ($name -eq 'dsh-skin-endfield') $name
Check 'dsh.bundle.patch is declared' ($pkg.dsh.bundle.patch -eq './cordis.patch.yml') $pkg.dsh.bundle.patch
Check 'dsh.client.platform is "web"' ($pkg.dsh.client.platform -eq 'web') $pkg.dsh.client.platform

# The harness discovers the browser bundle through
# require.resolve(<row name> + '/package.json'), so the row name must equal the
# package name and the file must exist at the declared export.
$clientPath = Join-Path $Repo ($pkg.exports.'./client'.TrimStart('.').TrimStart('/'))
Check 'exports["./client"] resolves to an existing file' (Test-Path $clientPath) $clientPath

$patchPath = Join-Path $Repo $pkg.dsh.bundle.patch
Check 'cordis patch file exists' (Test-Path $patchPath) $patchPath
$patch = Get-Content $patchPath -Raw
$rowName = ([regex]::Match($patch, "name:\s*'([^']+)'")).Groups[1].Value
Check 'patch row name equals the package name' ($rowName -eq $name) "row name: '$rowName'"

# The loader resolves the row through node resolution from the profile dir, so
# the package must be reachable from there. A junction under ~/.dsh/plugins is
# the convention this workspace uses.
$junction = Join-Path $dshHome "plugins\$name"
if (Test-Path $junction) {
    $item = Get-Item $junction -Force
    $target = $item.Target
    Check 'plugins/<name> exists and points at this checkout' ($item.LinkType -eq 'Junction' -and "$target" -like "*dsh-skin-endfield*") "$($item.LinkType) -> $target"
} else {
    Check 'plugins/<name> junction exists' $false "missing $junction — create it before installing (dsh plugin add links it)"
}

# ── profile registration state ──────────────────────────────────────────────
$profile = Get-Content $packageJson -Raw | ConvertFrom-Json
$bundles = @($profile.dsh.profile.bundles)
$dependency = $profile.dependencies.$name
Check 'profile bundles already contains the skin' ($bundles -contains $name) `
    $(if ($bundles -contains $name) { 'already registered' } else { "not registered (install step will add it); current: $($bundles -join ', ')" })
Check 'profile dependency already present' ($null -ne $dependency) `
    $(if ($dependency) { $dependency } else { 'not present (install step will add it as a link: dependency)' })

# ── host half loads under node ──────────────────────────────────────────────
Push-Location $Repo
try {
    $hostCheck = node -e "import('./lib/index.js').then(m => console.log(JSON.stringify({ name: m.name, inject: m.inject, hasApply: typeof m.apply === 'function' }))).catch(e => { console.error(e.message); process.exit(1) })" 2>&1
    Check 'host half imports under node' ($LASTEXITCODE -eq 0) ($hostCheck -join ' ').Trim()
} finally { Pop-Location }

Write-Host ''
if ($fail -eq 0) {
    Write-Host 'install contract OK'
} else {
    Write-Host "$fail check(s) failed"
}
exit $fail
