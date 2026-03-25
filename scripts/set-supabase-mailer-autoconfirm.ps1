# Menonaktifkan verifikasi email wajib (mailer_autoconfirm) lewat Supabase Management API.
# Butuh Personal Access Token: https://supabase.com/dashboard/account/tokens
# Scope token: project_admin_write + auth_config_write (atau "All" untuk dev).
#
# Set SUPABASE_ACCESS_TOKEN di environment atau di .env.local (jangan commit).

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$envFile = Join-Path $root ".env.local"

function Get-DotEnvValue([string]$path, [string]$key) {
  if (-not (Test-Path $path)) { return $null }
  foreach ($line in Get-Content $path) {
    if ($line -match "^\s*${key}\s*=\s*(.+)$") {
      return $matches[1].Trim().Trim('"').Trim("'")
    }
  }
  return $null
}

$token = $env:SUPABASE_ACCESS_TOKEN
if (-not $token) { $token = Get-DotEnvValue $envFile "SUPABASE_ACCESS_TOKEN" }
if (-not $token) {
  Write-Error "SUPABASE_ACCESS_TOKEN tidak ada. Tambahkan di .env.local atau environment."
}

$url = $env:NEXT_PUBLIC_SUPABASE_URL
if (-not $url) { $url = Get-DotEnvValue $envFile "NEXT_PUBLIC_SUPABASE_URL" }
if (-not $url -or $url -notmatch "https://([a-z0-9]+)\.supabase\.co") {
  Write-Error "NEXT_PUBLIC_SUPABASE_URL tidak valid di .env.local"
}
$ref = $Matches[1]

$uri = "https://api.supabase.com/v1/projects/$ref/config/auth"
$body = '{"mailer_autoconfirm":true}'
Write-Host "PATCH $uri (mailer_autoconfirm=true) ..."

try {
  Invoke-RestMethod -Uri $uri -Method PATCH `
    -Headers @{
      Authorization = "Bearer $token"
      "Content-Type"  = "application/json"
    } -Body $body | Out-Null
  Write-Host "Berhasil: email signup tidak wajib konfirmasi (autoconfirm on)."
} catch {
  Write-Error "API gagal: $($_.Exception.Message). Pastikan token punya auth_config_write dan project ref benar."
}
