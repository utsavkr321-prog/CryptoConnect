Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$databaseName = 'cryptoconnect_local_test'
$mongoUri = [Environment]::GetEnvironmentVariable('MONGODB_URI', 'Process')
if ([string]::IsNullOrWhiteSpace($mongoUri)) {
  throw 'Set MONGODB_URI in this PowerShell session to the existing local MongoDB test database. The value is never displayed or loaded from a file.'
}
if ($mongoUri -notmatch '^(?i)mongodb://(?:[^/@]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?/cryptoconnect_local_test(?:\?.*)?$') {
  throw 'Backend startup refused: MONGODB_URI must point to the local loopback host and cryptoconnect_local_test database. The URI value is not displayed.'
}
if ($env:MONGODB_DATABASE -and $env:MONGODB_DATABASE -cne $databaseName) {
  throw 'Backend startup refused: MONGODB_DATABASE must equal cryptoconnect_local_test.'
}
$env:MONGODB_DATABASE = $databaseName
$env:PORT = '8080'
$env:CORS_ORIGIN = 'http://localhost:5173'
$env:VITE_API_URL = 'http://127.0.0.1:8080'
$env:VITE_APP_MODE = 'api'

$generatedJwtSecret = [string]::IsNullOrWhiteSpace($env:JWT_SECRET)
if ($generatedJwtSecret) {
  $secretBytes = New-Object byte[] 32
  $random = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $random.GetBytes($secretBytes); $env:JWT_SECRET = [Convert]::ToBase64String($secretBytes) }
  finally { [Array]::Clear($secretBytes, 0, $secretBytes.Length); $random.Dispose() }
}

$listeners = @(Get-NetTCPConnection -State Listen -LocalPort 8080 -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  throw 'Port 8080 is already occupied. Identify the owning application and stop it gracefully; this script will not terminate processes.'
}

$mavenCommandInfo = Get-Command mvn -ErrorAction SilentlyContinue
$mavenExecutable = 'mvn'
if (-not $mavenCommandInfo) {
  $candidatePaths = @(
    'C:\Program Files\apache-maven-3.10.0\bin\mvn.cmd',
    'C:\Tools\apache-maven-3.10.0\bin\mvn.cmd'
  )
  $foundMaven = $candidatePaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
  if ($foundMaven) { $mavenExecutable = $foundMaven }
  else { throw 'Maven is unavailable. Install/configure Maven before starting the backend.' }
}

Write-Host 'Starting CryptoConnect against the configured loopback MongoDB test database on http://127.0.0.1:8080.'
Push-Location (Join-Path $projectRoot 'backend')
try {
  & $mavenExecutable spring-boot:run
  if ($LASTEXITCODE -ne 0) { throw "Backend exited with code $LASTEXITCODE." }
} finally {
  Pop-Location
  if ($generatedJwtSecret) { Remove-Item Env:JWT_SECRET -ErrorAction SilentlyContinue }
}
