[CmdletBinding()]
param()
& (Join-Path $PSScriptRoot '..\start-backend.ps1') @args
