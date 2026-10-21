[CmdletBinding()]
param()
& (Join-Path $PSScriptRoot '..\start-db.ps1') @args
