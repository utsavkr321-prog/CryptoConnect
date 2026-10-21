Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 5173 -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  throw 'Port 5173 is already occupied. Identify the owning application and stop it gracefully; Vite is configured to fail instead of switching ports.'
}

try {
  $health = Invoke-RestMethod -Uri 'http://127.0.0.1:8080/health/ready' -TimeoutSec 3
  if ($health.status -ne 'UP') { throw 'Backend readiness returned DOWN.' }
} catch {
  throw 'Backend is unavailable or its database is not ready at http://127.0.0.1:8080/health/ready. Start it with scripts\start-local-backend.ps1 and resolve its diagnostics first.'
}

$env:VITE_APP_MODE = 'api'
$env:VITE_API_URL = 'http://127.0.0.1:8080'
Push-Location $projectRoot
try { & npm run dev; if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130 -and $LASTEXITCODE -ne -1) { throw "Vite exited with code $LASTEXITCODE. Check the npm/Vite output." } }
finally { Pop-Location }
