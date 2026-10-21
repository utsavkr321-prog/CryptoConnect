Import-Module (Join-Path $PSScriptRoot '..\..\scripts\LocalDbSafety.psm1') -Force
$script:cluster = 'C:\cryptoconnect-test-db-new'
$script:port = 55433
$script:pidLines = @('27684', 'C:/cryptoconnect-test-db-new', '1792428677', '55433', '', '127.0.0.1')
$script:goodListener = [pscustomobject]@{ LocalAddress = '127.0.0.1'; LocalPort = 55433; OwningProcess = 27684 }

Describe 'isolated PostgreSQL startup decisions' {
  It 'normalizes an empty port-listener result before passing it to the safety guard' {
    $source = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot '..\..\scripts\start-local-db.ps1')
    $source | Should Match '(?m)^\$listeners\s*=\s*@\(Get-ApprovedPortListeners\)\s*$'
  }

  It 'accepts only Get-Process ObjectNotFound as proof that a PID is absent' {
    $missing = try { Get-Process -Id 27684 -ErrorAction Stop | Out-Null; $null } catch { $_ }
    Test-ConfirmedProcessAbsent -ErrorRecord $missing | Should Be $true
    $denied = try { Write-Error 'Access denied' -Category PermissionDenied -ErrorAction Stop } catch { $_ }
    Test-ConfirmedProcessAbsent -ErrorRecord $denied | Should Be $false
  }

  It 'treats a positively identified healthy isolated server as already running' {
    Resolve-LocalPostgresAction -ClusterStatus Running -DataDirectory $script:cluster -Port $script:port `
      -Listeners @($script:goodListener) -PidFilePresent $true -PidFileLines $script:pidLines `
      -PidProcessState Present -ProcessIdentityVerified $true | Should Be 'Healthy'
  }

  It 'allows removal only for a valid stale PID with stopped cluster and empty approved port' {
    Resolve-LocalPostgresAction -ClusterStatus Stopped -DataDirectory $script:cluster -Port $script:port `
      -Listeners @() -PidFilePresent $true -PidFileLines $script:pidLines -PidProcessState Absent | Should Be 'RemoveStaleAndStart'
  }

  It 'blocks an existing but unidentifiable PID' {
    { Resolve-LocalPostgresAction -ClusterStatus Stopped -DataDirectory $script:cluster -Port $script:port `
        -Listeners @() -PidFilePresent $true -PidFileLines $script:pidLines -PidProcessState Unknown } | Should Throw
  }

  It 'blocks a PID that still exists when the cluster reports stopped' {
    { Resolve-LocalPostgresAction -ClusterStatus Stopped -DataDirectory $script:cluster -Port $script:port `
        -Listeners @() -PidFilePresent $true -PidFileLines $script:pidLines -PidProcessState Present } | Should Throw
  }

  It 'blocks an unrelated listener on port 55433' {
    $unrelated = [pscustomobject]@{ LocalAddress = '127.0.0.1'; LocalPort = 55433; OwningProcess = 99999 }
    { Resolve-LocalPostgresAction -ClusterStatus Stopped -DataDirectory $script:cluster -Port $script:port `
        -Listeners @($unrelated) -PidFilePresent $false -PidProcessState Absent } | Should Throw
  }

  It 'blocks a running process whose listener is not uniquely owned' {
    $unrelated = [pscustomobject]@{ LocalAddress = '0.0.0.0'; LocalPort = 55433; OwningProcess = 99999 }
    { Resolve-LocalPostgresAction -ClusterStatus Running -DataDirectory $script:cluster -Port $script:port `
        -Listeners @($unrelated) -PidFilePresent $true -PidFileLines $script:pidLines `
        -PidProcessState Present -ProcessIdentityVerified $true } | Should Throw
  }

  It 'blocks PID metadata for any other cluster or port' {
    $wrongTarget = @('27684', 'C:/other-cluster', '1792428677', '5432')
    { Resolve-LocalPostgresAction -ClusterStatus Stopped -DataDirectory $script:cluster -Port $script:port `
        -Listeners @() -PidFilePresent $true -PidFileLines $wrongTarget -PidProcessState Absent } | Should Throw
  }
}

Describe 'bounded startup and safe logs' {
  It 'returns false when readiness never succeeds before the timeout' {
    Wait-LocalPostgresReadiness -TimeoutSeconds 1 -PollMilliseconds 10 -Probe { $false } | Should Be $false
  }

  It 'returns true when readiness succeeds and subsequent invocation is idempotent' {
    Wait-LocalPostgresReadiness -TimeoutSeconds 1 -PollMilliseconds 10 -Probe { $true } | Should Be $true
    Resolve-LocalPostgresAction -ClusterStatus Running -DataDirectory $script:cluster -Port $script:port `
      -Listeners @($script:goodListener) -PidFilePresent $true -PidFileLines $script:pidLines `
      -PidProcessState Present -ProcessIdentityVerified $true | Should Be 'Healthy'
  }

  It 'creates unique log names without overwriting earlier logs' {
    $dir = Join-Path $TestDrive 'logs'
    $first = New-LocalPostgresLogPaths -Directory $dir
    Set-Content -LiteralPath $first.DiagnosticLog -Value 'preserve-me'
    $second = New-LocalPostgresLogPaths -Directory $dir
    $first.ServerLog | Should Not Be $second.ServerLog
    $first.DiagnosticLog | Should Not Be $second.DiagnosticLog
    (Get-Content -Raw -LiteralPath $first.DiagnosticLog).Trim() | Should Be 'preserve-me'
    (Split-Path $first.ServerLog -Parent) | Should Be $dir
  }

  It 'fails safely when the log path cannot be created and leaves the blocker untouched' {
    $blockedPath = Join-Path $TestDrive 'not-a-directory'
    Set-Content -LiteralPath $blockedPath -Value 'preserve-me'
    { New-LocalPostgresLogPaths -Directory $blockedPath } | Should Throw
    (Get-Content -Raw -LiteralPath $blockedPath).Trim() | Should Be 'preserve-me'
  }
}

Describe 'database password lifetime' {
  It 'uses a hidden secure prompt and exposes PGPASSWORD only for the identity query' {
    $source = Get-Content -Raw -LiteralPath (Join-Path $PSScriptRoot '..\..\scripts\start-local-db.ps1')
    $source | Should Match "Read-Host 'Password for the isolated cc_new_app database role' -AsSecureString"
    $startIndex = $source.IndexOf('$startOutput = @(& $pgCtl')
    $passwordEnvironmentIndex = $source.IndexOf('$env:PGPASSWORD = $plainPassword')
    $queryIndex = $source.IndexOf('$identity = & $psql')
    $cleanupIndex = $source.IndexOf('Remove-Item Env:PGPASSWORD')
    ($startIndex -ge 0 -and $passwordEnvironmentIndex -gt $startIndex -and $queryIndex -gt $passwordEnvironmentIndex -and $cleanupIndex -gt $queryIndex) | Should Be $true
    $source | Should Match 'ZeroFreeBSTR\(\$passwordPtr\)'
    $source | Should Match '\$plainPassword = \$null'
  }
}
