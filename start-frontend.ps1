[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json') -PathType Leaf)) {
  $projectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  CryptoConnect - Frontend Server Startup " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Load configuration from .env if present
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile -PathType Leaf) {
  $lines = Get-Content -LiteralPath $envFile -ErrorAction Stop
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$' -and $line -notmatch '^\s*#') {
      $k = $matches[1]
      $v = $matches[2].Trim()
      $current = [Environment]::GetEnvironmentVariable($k, 'Process')
      if ([string]::IsNullOrWhiteSpace($current)) {
        [Environment]::SetEnvironmentVariable($k, $v, 'Process')
      }
    }
  }
}

# 2. Validate frontend configuration
if (-not $env:VITE_APP_MODE) {
  $env:VITE_APP_MODE = 'api'
}

if (-not $env:VITE_API_URL) {
  $env:VITE_API_URL = 'http://127.0.0.1:8080'
}

# Validate URL format
try {
  $uriCheck = [System.Uri]$env:VITE_API_URL
  if (-not ($uriCheck.Scheme -in @('http', 'https'))) {
    throw 'Scheme must be http or https.'
  }
} catch {
  throw "Invalid VITE_API_URL ('$env:VITE_API_URL'). It must be a valid HTTP or HTTPS URL (e.g., http://127.0.0.1:8080)."
}

Write-Host "[Config] Mode:     $($env:VITE_APP_MODE)" -ForegroundColor Gray
Write-Host "[Config] API URL:  $($env:VITE_API_URL)" -ForegroundColor Gray

# 3. Check for port 5173 conflicts
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  $owningPid = $listeners[0].OwningProcess
  throw "Port 5173 is already occupied by process PID $owningPid. Stop the existing process before starting the frontend."
}

# 4. Check backend readiness
Write-Host "`nChecking backend readiness at $($env:VITE_API_URL)/health/ready..." -ForegroundColor Cyan
try {
  $health = Invoke-RestMethod -Uri "$($env:VITE_API_URL.TrimEnd('/'))/health/ready" -TimeoutSec 3 -ErrorAction Stop
  if ($health.status -eq 'UP') {
    Write-Host "[Success] Backend is UP and database is ready." -ForegroundColor Green
  } else {
    Write-Host "[Advisory] Backend reported status: $($health.status). Ensure the database is connected." -ForegroundColor Yellow
  }
} catch {
  Write-Host "[Advisory] Backend is not currently responding at $($env:VITE_API_URL)." -ForegroundColor Yellow
  Write-Host "           Make sure to run '.\start-backend.ps1' in Terminal 2." -ForegroundColor Yellow
  Write-Host "           Starting frontend dev server (it will connect once backend is online)..." -ForegroundColor Gray
}

# 5. Check npm availability
$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npmCmd) {
  throw 'Node.js / npm was not found on PATH. Install Node.js before running the frontend.'
}

# 6. Start Vite
Write-Host "`n--------------------------------------------------" -ForegroundColor Cyan
Write-Host "Starting Vite frontend dev server on http://localhost:5173" -ForegroundColor Green
Write-Host "Press Ctrl+C to stop the frontend server." -ForegroundColor Gray
Write-Host "--------------------------------------------------`n" -ForegroundColor Cyan

Push-Location $projectRoot
try {
  & npm run dev
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130 -and $LASTEXITCODE -ne -1) {
    throw "Vite dev server exited with code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}
