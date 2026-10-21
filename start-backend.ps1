[CmdletBinding()]
param(
  [switch]$UseMaven
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = $scriptDir
if (-not (Test-Path -LiteralPath (Join-Path $projectRoot 'package.json') -PathType Leaf)) {
  $projectRoot = (Resolve-Path (Join-Path $scriptDir '..')).Path
}

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "  CryptoConnect - Backend Server Startup   " -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

# 1. Load configuration from .env safely if present
$envFile = Join-Path $projectRoot '.env'
if (Test-Path -LiteralPath $envFile -PathType Leaf) {
  Write-Host "[Config] Loading environment configuration from .env..." -ForegroundColor Gray
  $lines = Get-Content -LiteralPath $envFile -ErrorAction Stop
  foreach ($line in $lines) {
    if ($line -match '^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$' -and $line -notmatch '^\s*#') {
      $k = $matches[1]
      $v = $matches[2].Trim()
      # Set process environment variable if not already set
      $currentVal = [Environment]::GetEnvironmentVariable($k, 'Process')
      if ([string]::IsNullOrWhiteSpace($currentVal)) {
        [Environment]::SetEnvironmentVariable($k, $v, 'Process')
      }
    }
  }
}

# 2. Validate mandatory MONGODB_URI
$mongoUri = [Environment]::GetEnvironmentVariable('MONGODB_URI', 'Process')
if ([string]::IsNullOrWhiteSpace($mongoUri)) {
  throw 'MONGODB_URI is required. Configure it in .env or as an environment variable before starting the backend.'
}

# Safely normalize accidental '<' and '>' around password from Atlas templates
if ($mongoUri -match '^(?i)mongodb(?:\+srv)?://[^:]+:<[^>]+>@') {
  Write-Host "[Notice] Detected and removed accidental '<' and '>' around password in MONGODB_URI." -ForegroundColor Yellow
  $mongoUri = [regex]::Replace($mongoUri, '(?<=mongodb(?:\+srv)?://[^:]+:)<([^>]+)>(?=@)', '$1')
  $env:MONGODB_URI = $mongoUri
}

# Validate URI scheme
if ($mongoUri -notmatch '^(?i)mongodb(?:\+srv)?://') {
  throw 'MONGODB_URI is invalid: must begin with mongodb:// or mongodb+srv://.'
}

# 3. Database name validation and safeguards
$databaseName = [Environment]::GetEnvironmentVariable('MONGODB_DATABASE', 'Process')
if ([string]::IsNullOrWhiteSpace($databaseName)) {
  $databaseName = 'cryptoconnect'
  $env:MONGODB_DATABASE = $databaseName
}

if ($databaseName -notmatch '^[A-Za-z0-9_-]{1,63}$') {
  throw "MONGODB_DATABASE '$databaseName' contains invalid characters. Use letters, numbers, underscores, and hyphens."
}

# Preserve local-test safeguards: if target is cryptoconnect_local_test, must use loopback host
if ($databaseName -eq 'cryptoconnect_local_test') {
  if ($mongoUri -notmatch '^(?i)mongodb://(?:[^/@]+@)?(?:localhost|127\.0\.0\.1)(?::\d+)?/cryptoconnect_local_test(?:\?.*)?$') {
    throw 'Backend startup refused: local test database cryptoconnect_local_test requires a loopback MongoDB URI (localhost/127.0.0.1).'
  }
}

# 4. JWT secret validation. Staging must use a stable secret supplied by protected configuration;
# generating one here would invalidate every token after a restart and hide a configuration error.
$jwtSecret = [Environment]::GetEnvironmentVariable('JWT_SECRET', 'Process')
if ([string]::IsNullOrWhiteSpace($jwtSecret)) {
  throw 'JWT_SECRET is required. Configure a stable secret through protected runtime configuration before starting the backend.'
}

# 5. Application defaults
if (-not $env:PORT) { $env:PORT = '8080' }
if (-not $env:CORS_ORIGIN) { $env:CORS_ORIGIN = 'http://localhost:5173' }
if (-not $env:VITE_API_URL) { $env:VITE_API_URL = "http://127.0.0.1:$($env:PORT)" }
if (-not $env:VITE_APP_MODE) { $env:VITE_APP_MODE = 'api' }

# Check port conflict on 8080
$portNum = [int]$env:PORT
$listeners = @(Get-NetTCPConnection -State Listen -LocalPort $portNum -ErrorAction SilentlyContinue)
if ($listeners.Count -gt 0) {
  $owningPid = $listeners[0].OwningProcess
  throw "Port $portNum is already occupied by process PID $owningPid. Stop the existing process before starting the backend."
}

# 6. Locate Java and Maven
$javaInfo = Get-Command java -ErrorAction SilentlyContinue
if (-not $javaInfo) {
  throw 'Java runtime (JDK 21) was not found on PATH. Install or configure Java 21.'
}

$mavenExecutable = $null
$mavenCommandInfo = Get-Command mvn -ErrorAction SilentlyContinue
if ($mavenCommandInfo) {
  $mavenExecutable = 'mvn'
} else {
  $candidatePaths = @(
    'C:\Program Files\apache-maven-3.10.0\bin\mvn.cmd',
    'C:\Tools\apache-maven-3.10.0\bin\mvn.cmd'
  )
  $mavenExecutable = $candidatePaths | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}

$jarPath = Join-Path $projectRoot 'backend\target\cryptoconnect-backend-0.1.0.jar'
$hasJar = Test-Path -LiteralPath $jarPath -PathType Leaf

Write-Host "[Ready] Configuration validated." -ForegroundColor Green
Write-Host "[Target] Starting CryptoConnect backend on http://127.0.0.1:$($env:PORT)" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the backend.`n" -ForegroundColor Gray

Push-Location (Join-Path $projectRoot 'backend')
try {
  if ($hasJar -and -not $UseMaven) {
    Write-Host "[Launch] Executing packaged JAR (faster startup)..." -ForegroundColor Gray
    & java -Xmx512m -jar $jarPath
  } elseif ($mavenExecutable) {
    Write-Host "[Launch] Executing with Maven spring-boot:run..." -ForegroundColor Gray
    $env:MAVEN_OPTS = "-Xmx512m"
    & $mavenExecutable spring-boot:run
  } else {
    throw "Neither backend JAR ($jarPath) nor Maven was found. Build the project first."
  }
  if ($LASTEXITCODE -ne 0 -and $LASTEXITCODE -ne 130 -and $LASTEXITCODE -ne -1) {
    throw "Backend process exited with code $LASTEXITCODE."
  }
} finally {
  Pop-Location
}
