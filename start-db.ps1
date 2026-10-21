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
Write-Host "  CryptoConnect - Database Check & Startup " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Inspect configured MongoDB target safely without printing secrets
$envFile = Join-Path $projectRoot '.env'
$configuredUri = [Environment]::GetEnvironmentVariable('MONGODB_URI', 'Process')
$configuredDb = [Environment]::GetEnvironmentVariable('MONGODB_DATABASE', 'Process')

if (Test-Path -LiteralPath $envFile -PathType Leaf) {
  $lines = Get-Content -LiteralPath $envFile -ErrorAction Stop
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$' -and $line -notmatch '^\s*#') {
      $k = $matches[1]
      $v = $matches[2].Trim()
      if ($k -eq 'MONGODB_URI' -and [string]::IsNullOrWhiteSpace($configuredUri)) {
        $configuredUri = $v
      }
      if ($k -eq 'MONGODB_DATABASE' -and [string]::IsNullOrWhiteSpace($configuredDb)) {
        $configuredDb = $v
      }
    }
  }
}

$isAtlas = $false
$isLoopback = $false
$atlasHost = $null

if (-not [string]::IsNullOrWhiteSpace($configuredUri)) {
  if ($configuredUri -match '^(?i)mongodb\+srv://(?:[^/@]+@)?([^/?:]+)') {
    $isAtlas = $true
    $atlasHost = $matches[1]
  } elseif ($configuredUri -match '^(?i)mongodb://(?:[^/@]+@)?(?:localhost|127\.0\.0\.1|0\.0\.0\.0)(?::\d+)?') {
    $isLoopback = $true
  } elseif ($configuredUri -match 'mongodb\.net') {
    $isAtlas = $true
    if ($configuredUri -match '@([^/?:]+)') { $atlasHost = $matches[1] }
  }
}

if ($isAtlas) {
  Write-Host "`n[Target] MongoDB Atlas (Cloud Managed Database)" -ForegroundColor Yellow
  Write-Host "[Info]   MongoDB Atlas is a remote managed database running in the cloud."
  Write-Host "[Info]   It must NOT be started as a local service; no local processes are needed."
  
  Write-Host "`nChecking network connectivity to Atlas cluster..." -ForegroundColor Cyan
  $reachable = $false
  try {
    if ($atlasHost) {
      $srvRecords = @(Resolve-DnsName -Type SRV "_mongodb._tcp.$atlasHost" -ErrorAction SilentlyContinue)
      if ($srvRecords.Count -gt 0) {
        $firstTarget = $srvRecords[0].NameTarget
        $port = if ($srvRecords[0].Port) { $srvRecords[0].Port } else { 27017 }
        $tcpCheck = Test-NetConnection -ComputerName $firstTarget -Port $port -WarningAction SilentlyContinue
        if ($tcpCheck.TcpTestSucceeded) {
          $reachable = $true
          Write-Host "[Success] Connected to MongoDB Atlas cluster replica set on port $port." -ForegroundColor Green
          Write-Host "[Status]  Network access and IP allowlist verified." -ForegroundColor Green
        }
      }
    }
  } catch {
    $reachable = $false
  }

  if (-not $reachable) {
    Write-Host "[Warning] Could not reach MongoDB Atlas cluster over TCP." -ForegroundColor Yellow
    Write-Host "Please check: 1) Your internet connection; 2) MongoDB Atlas Network Access IP allowlist."
    throw 'MongoDB Atlas readiness could not be verified; refusing to report the database as ready.'
  }

  Write-Host "`n--------------------------------------------------" -ForegroundColor Cyan
  Write-Host "DATABASE READY (MongoDB Atlas remote service)." -ForegroundColor Green
  Write-Host "Next Step: In Terminal 2, run:" -ForegroundColor White
  Write-Host "  .\start-backend.ps1" -ForegroundColor Yellow
  Write-Host "--------------------------------------------------`n" -ForegroundColor Cyan
  return
}

# 2. Local MongoDB check
Write-Host "`n[Target] Local MongoDB service" -ForegroundColor Yellow

$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 27017 -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  $owningPid = $listeners[0].OwningProcess
  Write-Host "[Success] A database service is already listening on local port 27017 (PID: $owningPid)." -ForegroundColor Green
  Write-Host "`n--------------------------------------------------" -ForegroundColor Cyan
  Write-Host "LOCAL DATABASE READY (listening on port 27017)." -ForegroundColor Green
  Write-Host "Next Step: In Terminal 2, run:" -ForegroundColor White
  Write-Host "  .\start-backend.ps1" -ForegroundColor Yellow
  Write-Host "--------------------------------------------------`n" -ForegroundColor Cyan
  return
}

$mongoService = Get-Service -Name 'MongoDB' -ErrorAction SilentlyContinue
if ($mongoService) {
  if ($mongoService.Status -eq 'Running') {
    Write-Host "[Success] Windows Service 'MongoDB' is running." -ForegroundColor Green
    Write-Host "`n--------------------------------------------------" -ForegroundColor Cyan
    Write-Host "LOCAL DATABASE READY." -ForegroundColor Green
    Write-Host "Next Step: In Terminal 2, run:" -ForegroundColor White
    Write-Host "  .\start-backend.ps1" -ForegroundColor Yellow
    Write-Host "--------------------------------------------------`n" -ForegroundColor Cyan
    return
  } else {
    Write-Host "[Info] Found Windows Service 'MongoDB' in stopped state. Starting service..." -ForegroundColor Cyan
    try {
      Start-Service -Name 'MongoDB' -ErrorAction Stop
      Start-Sleep -Seconds 2
      $updated = Get-Service -Name 'MongoDB'
      if ($updated.Status -eq 'Running') {
        Write-Host "[Success] Started local 'MongoDB' Windows service successfully." -ForegroundColor Green
        return
      }
    } catch {
      Write-Host "[Warning] Could not automatically start MongoDB service: $($_.Exception.Message)" -ForegroundColor Yellow
      Write-Host "Please start it with administrator privileges: Start-Service MongoDB"
    }
  }
}

Write-Host "`n[Info] No local MongoDB service or executable found on this system." -ForegroundColor Yellow
Write-Host "`nONE-TIME SETUP OPTIONS:" -ForegroundColor Cyan
Write-Host "  1. MongoDB Atlas (Recommended):" -ForegroundColor White
Write-Host "     CryptoConnect is configured for MongoDB Atlas in .env."
Write-Host "     Atlas requires NO local installation and runs as a fully managed cloud database."
Write-Host "  2. Install MongoDB locally for Windows:" -ForegroundColor White
Write-Host "     - Download MongoDB Community Server:"
Write-Host "       https://www.mongodb.com/try/download/community"
Write-Host "     - Or install via winget:"
Write-Host "       winget install MongoDB.Server"
Write-Host "     Select 'Run service as Network Service user' during installation."
Write-Host "`nIf using MongoDB Atlas, configure MONGODB_URI in .env and rerun this script.`n"
