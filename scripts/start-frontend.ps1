[CmdletBinding()]
param()
& (Join-Path $PSScriptRoot '..\start-frontend.ps1') @args
