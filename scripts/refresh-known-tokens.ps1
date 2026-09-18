# Regenerate scripts/known-tokens.json from the installed DSH theme package.
#
# The skin may only override tokens the shell actually declares. This script
# extracts every `--dsw-alias-*` name from the theme bundle so verify-client.mjs
# can reject a typo instead of silently shipping a no-op override.
#
# Usage: pwsh -File scripts/refresh-known-tokens.ps1 [-DshRoot <path>]
param(
    [string]$DshRoot = 'C:\Users\duzihui\scoop\persist\nodejs-lts\bin\node_modules\@deepseek-ai\dsh'
)

$ErrorActionPreference = 'Stop'
$theme = Join-Path $DshRoot 'node_modules\@deepseek-ai\dsh-client-ui-theme\lib\client.js'
if (-not (Test-Path $theme)) { throw "theme bundle not found: $theme" }

$version = (Get-Content (Join-Path $DshRoot 'node_modules\@deepseek-ai\dsh-client-ui-theme\package.json') -Raw | ConvertFrom-Json).version
$css = Get-Content $theme -Raw
$tokens = [regex]::Matches($css, '--dsw-alias-[a-z0-9-]+') | ForEach-Object { $_.Value } | Sort-Object -Unique

$out = [ordered]@{
    generatedFrom = "dsh-client-ui-theme@$version/lib/client.js"
    generatedAt   = (Get-Date).ToUniversalTime().ToString('yyyy-MM-dd')
    count         = $tokens.Count
    tokens        = @($tokens)
}
$target = Join-Path $PSScriptRoot 'known-tokens.json'
($out | ConvertTo-Json -Depth 3) | Set-Content -Path $target -Encoding utf8
Write-Host "wrote $($tokens.Count) token names to $target (theme $version)"
