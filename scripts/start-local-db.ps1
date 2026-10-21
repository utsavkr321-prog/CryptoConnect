[CmdletBinding()]
param()

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# Deliberately fixed: this launcher must never inherit a database target.
$dataDirectory = 'C:\cryptoconnect-test-db-new'
$approvedHost = '127.0.0.1'
$approvedPort = 55433
$approvedDatabase = 'cryptoconnect_local_test'
$approvedRole = 'cc_new_app'
$postgresBin = 'C:\Program Files\PostgreSQL\18\bin'
$pgCtl = Join-Path $postgresBin 'pg_ctl.exe'
$pgIsReady = Join-Path $postgresBin 'pg_isready.exe'
$psql = Join-Path $postgresBin 'psql.exe'
$pidFile = Join-Path $dataDirectory 'postmaster.pid'
$logDirectory = 'C:\cryptoconnect-test-db-new-logs'
Import-Module (Join-Path $PSScriptRoot 'LocalDbSafety.psm1') -Force

function Get-ApprovedPortListeners {
  try { return @(Get-NetTCPConnection -State Listen -LocalPort $approvedPort -ErrorAction Stop) }
  catch {
    if ($_.Exception.Message -match '(?i)no matching|cannot find|no objects') { return @() }
    throw "Could not safely inspect listener ownership for port $approvedPort. No files or processes were changed."
  }
}

function Get-ProcessRecord([int]$ProcessId) {
  # Get-Process distinguishes a genuinely absent PID from access/inspection failures.
  # CIM can be denied by local policy even for an absent PID; use it only if the process exists.
  try { $localProcess = Get-Process -Id $ProcessId -ErrorAction Stop }
  catch {
    if (Test-ConfirmedProcessAbsent -ErrorRecord $_) { return $null }
    throw "Could not positively determine whether PID $ProcessId exists. No files or processes were changed."
  }
  if (-not $localProcess) { throw "PID $ProcessId lookup returned an ambiguous empty result. No files or processes were changed." }
  try {
    $all = @(Get-CimInstance -ClassName Win32_Process -Filter "ProcessId = $ProcessId" -ErrorAction Stop)
  } catch { throw "Could not positively identify PID $ProcessId (process inspection failed). No files or processes were changed." }
  if ($all.Count -ne 1) { throw "PID $ProcessId exists but detailed process inspection is unavailable or ambiguous. No files or processes were changed." }
  $record = $all[0]
  if ([string]::IsNullOrWhiteSpace($record.ExecutablePath) -or [string]::IsNullOrWhiteSpace($record.CommandLine)) {
    throw "PID $ProcessId exists but its executable path or command line is inaccessible. No files or processes were changed."
  }
  return $record
}

function Test-ApprovedPostgresIdentity($ProcessRecord) {
  $expectedExe = Join-Path $postgresBin 'postgres.exe'
  if ($ProcessRecord.ExecutablePath -ine $expectedExe) { return $false }
  $line = [string]$ProcessRecord.CommandLine
  $normalizedData = [regex]::Escape($dataDirectory.Replace('/', '\'))
  $dataArgument = '(?i)(?:-D\s+"?' + $normalizedData + '"?(?:\s|$)|--pgdata(?:=|\s+)"?' + $normalizedData + '"?(?:\s|$))'
  return ($line -match $dataArgument -and
    $line -match '(?i)(?:-p\s+55433|--port(?:=|\s+)55433)' -and
    $line -match '(?i)(?:-h\s+127\.0\.0\.1|listen_addresses=127\.0\.0\.1)')
}

foreach ($toolPath in @($pgCtl, $pgIsReady, $psql)) {
  if (-not (Test-Path -LiteralPath $toolPath -PathType Leaf)) { throw "PostgreSQL 18 tool not found at '$toolPath'. No server was started." }
}
if (-not (Test-Path -LiteralPath $dataDirectory -PathType Container)) { throw "The approved isolated cluster directory '$dataDirectory' was not found. No server was started." }
if ((Get-Content -LiteralPath (Join-Path $dataDirectory 'PG_VERSION') -Raw).Trim() -ne '18') { throw 'The approved data directory is not a PostgreSQL 18 cluster. No server was started.' }

$statusOutput = @(& $pgCtl -D $dataDirectory status 2>&1)
$statusExitCode = $LASTEXITCODE
$statusText = $statusOutput -join "`n"
$reportsRunning = $statusText -match '(?i)server is running'
$reportsStopped = $statusText -match '(?i)no server running'
if (($statusExitCode -eq 0 -and -not $reportsRunning) -or ($statusExitCode -eq 3 -and -not $reportsStopped) -or ($statusExitCode -notin @(0, 3))) {
  throw 'Could not determine the approved isolated cluster status from pg_ctl. No startup was attempted.'
}
$clusterRunning = $statusExitCode -eq 0 -and $reportsRunning
$listeners = @(Get-ApprovedPortListeners)
$pidFilePresent = Test-Path -LiteralPath $pidFile -PathType Leaf
$pidLines = if ($pidFilePresent) { @(Get-Content -LiteralPath $pidFile -TotalCount 8) } else { @() }

if ($clusterRunning) {
  $pidMatch = [regex]::Match($statusText, '\bPID:\s*(\d+)')
  if (-not $pidMatch.Success) { throw 'pg_ctl reports a running cluster but supplied no PID. No connection or startup was attempted.' }
  $clusterPid = [int]$pidMatch.Groups[1].Value
  $process = Get-ProcessRecord $clusterPid
  $identityVerified = $process -and (Test-ApprovedPostgresIdentity $process)
  $action = Resolve-LocalPostgresAction -ClusterStatus Running -DataDirectory $dataDirectory -Port $approvedPort -ExpectedHost $approvedHost -Listeners $listeners -PidFilePresent $pidFilePresent -PidFileLines $pidLines -PidProcessState $(if ($process) { 'Present' } else { 'Absent' }) -ProcessIdentityVerified ([bool]$identityVerified)
  if ($action -ne 'Healthy') { throw 'The approved cluster did not resolve to a healthy state.' }
} else {
  $pidProcessState = 'Absent'
  if ($pidFilePresent) {
    if ($pidLines.Count -lt 1 -or $pidLines[0].Trim() -notmatch '^\d+$') { throw 'The remaining postmaster.pid has no valid PID. No files were changed.' }
    $stalePid = [int]$pidLines[0].Trim()
    $process = Get-ProcessRecord $stalePid
    if ($process) { $pidProcessState = 'Present' }
  }
  $action = Resolve-LocalPostgresAction -ClusterStatus Stopped -DataDirectory $dataDirectory -Port $approvedPort -ExpectedHost $approvedHost -Listeners $listeners -PidFilePresent $pidFilePresent -PidFileLines $pidLines -PidProcessState $pidProcessState
  if ($action -eq 'RemoveStaleAndStart') {
    # pg_ctl status, a successful PID lookup showing absence, and an empty exact-port listener check agree.
    Remove-Item -LiteralPath $pidFile -Force
    Write-Host "Removed a verified stale postmaster.pid for absent PID $stalePid from the approved cluster."
  }
}

$logPaths = New-LocalPostgresLogPaths -Directory $logDirectory
$serverLog = $logPaths.ServerLog
$diagnosticLog = $logPaths.DiagnosticLog

$securePassword = Read-Host 'Password for the isolated cc_new_app database role' -AsSecureString
$passwordPtr = [IntPtr]::Zero
$plainPassword = $null

try {
  if (-not $clusterRunning) {
    $serverOptions = '-h 127.0.0.1 -p 55433 -c listen_addresses=127.0.0.1'
    Write-Host "Starting the approved isolated PostgreSQL cluster; logs: $serverLog"
    $startOutput = @(& $pgCtl -D $dataDirectory -o $serverOptions -l $serverLog -w -t 30 start 2>&1)
    $startExit = $LASTEXITCODE
    if ($startOutput.Count) { $startOutput | ForEach-Object { [IO.File]::AppendAllText($diagnosticLog, ([string]$_ + [Environment]::NewLine)) } }
    if ($startExit -ne 0) {
      $safeOutput = ($startOutput -join ' ' -replace '[\r\n]+', ' ')
      if ($safeOutput.Length -gt 500) { $safeOutput = $safeOutput.Substring(0, 500) }
      throw "Isolated PostgreSQL startup failed (exit $startExit): $safeOutput. Diagnostics: $diagnosticLog; server log: $serverLog"
    }
  }

  $ready = Wait-LocalPostgresReadiness -TimeoutSeconds 30 -PollMilliseconds 500 -Probe {
    & $pgIsReady -h $approvedHost -p $approvedPort -d $approvedDatabase -U $approvedRole -t 2 *> $null
    return $LASTEXITCODE -eq 0
  }
  if (-not $ready) { throw "The approved endpoint did not become ready within 30 seconds. Diagnostics: $diagnosticLog; server log: $serverLog" }

  # PostgreSQL is already started and does not inherit the password. Expose PGPASSWORD
  # only to the single psql identity query, then remove it even if psql fails.
  $passwordPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($securePassword)
  try { $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($passwordPtr) }
  finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr)
    $passwordPtr = [IntPtr]::Zero
  }
  try {
    $env:PGPASSWORD = $plainPassword
    $identity = & $psql -X -w -h $approvedHost -p $approvedPort -d $approvedDatabase -U $approvedRole -Atq -v ON_ERROR_STOP=1 -c 'SELECT current_database() || chr(9) || current_user || chr(9) || inet_server_addr() || chr(9) || inet_server_port()' 2>$null
  } finally {
    Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
    $plainPassword = $null
  }
  if ($LASTEXITCODE -ne 0) { throw "Could not verify database identity. Diagnostics: $diagnosticLog; server log: $serverLog" }
  $expectedIdentity = "$approvedDatabase`t$approvedRole`t$approvedHost`t$approvedPort"
  if ([string]$identity -cne $expectedIdentity) { throw 'Connected endpoint identity did not match the approved database, role, address, and port. Do not start the backend.' }
  if ($clusterRunning) { Write-Host 'The already-running isolated PostgreSQL cluster passed readiness and exact database identity checks.' }
  else { Write-Host 'The isolated PostgreSQL cluster started and passed readiness and exact database identity checks.' }
} finally {
  Remove-Item Env:PGPASSWORD -ErrorAction SilentlyContinue
  $plainPassword = $null
  if ($passwordPtr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($passwordPtr) }
  $securePassword.Dispose()
}
