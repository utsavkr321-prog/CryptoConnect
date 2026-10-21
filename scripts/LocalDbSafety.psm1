Set-StrictMode -Version Latest

function Resolve-LocalPostgresAction {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][ValidateSet('Running','Stopped','Unknown')][string]$ClusterStatus,
    [Parameter(Mandatory)][string]$DataDirectory,
    [Parameter(Mandatory)][int]$Port,
    [Parameter(Mandatory)][AllowEmptyCollection()][object[]]$Listeners,
    [Parameter(Mandatory)][bool]$PidFilePresent,
    [string[]]$PidFileLines = @(),
    [Parameter(Mandatory)][ValidateSet('Absent','Present','Unknown')][string]$PidProcessState,
    [bool]$ProcessIdentityVerified = $false,
    [string]$ExpectedHost = '127.0.0.1'
  )

  if ($ClusterStatus -eq 'Unknown') { throw 'Cluster status is ambiguous; refusing startup.' }
  if ($ClusterStatus -eq 'Running') {
    if (-not $PidFilePresent -or $PidFileLines.Count -lt 4 -or $PidFileLines[0].Trim() -notmatch '^\d+$' -or
        [int]$PidFileLines[0].Trim() -le 0 -or
        $PidFileLines[1].Trim().Replace('/', '\').TrimEnd('\') -ine $DataDirectory.TrimEnd('\') -or
        $PidFileLines[3].Trim() -ne [string]$Port) {
      throw 'Running cluster PID file does not match the approved cluster and port.'
    }
    $pid = [int]$PidFileLines[0].Trim()
    if ($PidProcessState -ne 'Present' -or -not $ProcessIdentityVerified) { throw 'Running postmaster process identity is ambiguous.' }
    $owned = @($Listeners | Where-Object { $_.LocalAddress -eq $ExpectedHost -and $_.OwningProcess -eq $pid })
    if ($Listeners.Count -ne 1 -or $owned.Count -ne 1) { throw 'Running postmaster does not uniquely own the approved listener.' }
    return 'Healthy'
  }

  if ($Listeners.Count -ne 0) { throw "Port $Port is occupied while the approved cluster is stopped." }
  if (-not $PidFilePresent) { return 'Start' }
  if ($PidFileLines.Count -lt 4 -or $PidFileLines[0].Trim() -notmatch '^\d+$' -or
      [int]$PidFileLines[0].Trim() -le 0 -or
      $PidFileLines[1].Trim().Replace('/', '\').TrimEnd('\') -ine $DataDirectory.TrimEnd('\') -or
      $PidFileLines[3].Trim() -ne [string]$Port) {
    throw 'Remaining postmaster.pid does not match the approved cluster and port.'
  }
  if ($PidProcessState -ne 'Absent') { throw 'PID exists or cannot be positively inspected; refusing to remove postmaster.pid.' }
  return 'RemoveStaleAndStart'
}

function Test-ConfirmedProcessAbsent {
  [CmdletBinding()]
  param([Parameter(Mandatory)][System.Management.Automation.ErrorRecord]$ErrorRecord)
  return ($ErrorRecord.CategoryInfo.Category -eq [System.Management.Automation.ErrorCategory]::ObjectNotFound -and
    $ErrorRecord.Exception.Message -match '(?i)^cannot find a process with the process identifier \d+\.$')
}

function Wait-LocalPostgresReadiness {
  [CmdletBinding()]
  param(
    [Parameter(Mandatory)][scriptblock]$Probe,
    [int]$TimeoutSeconds = 30,
    [int]$PollMilliseconds = 500
  )
  $deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  do {
    if (& $Probe) { return $true }
    if ([DateTime]::UtcNow -lt $deadline) { Start-Sleep -Milliseconds $PollMilliseconds }
  } while ([DateTime]::UtcNow -lt $deadline)
  return $false
}

function New-LocalPostgresLogPaths {
  [CmdletBinding()]
  param([Parameter(Mandatory)][string]$Directory)
  if (-not (Test-Path -LiteralPath $Directory -PathType Container)) {
    New-Item -ItemType Directory -Path $Directory -ErrorAction Stop | Out-Null
  }
  $id = '{0}-{1}' -f (Get-Date -Format 'yyyyMMdd-HHmmss-fff'), ([guid]::NewGuid().ToString('N').Substring(0, 8))
  $serverLog = Join-Path $Directory "postgres-$id.log"
  $diagnosticLog = Join-Path $Directory "startup-$id.log"
  $stream = [IO.File]::Open($diagnosticLog, [IO.FileMode]::CreateNew, [IO.FileAccess]::Write, [IO.FileShare]::None)
  $stream.Dispose()
  return [pscustomobject]@{ ServerLog = $serverLog; DiagnosticLog = $diagnosticLog }
}

Export-ModuleMember -Function Resolve-LocalPostgresAction, Test-ConfirmedProcessAbsent, Wait-LocalPostgresReadiness, New-LocalPostgresLogPaths
