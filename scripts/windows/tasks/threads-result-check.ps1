param([string]$Slot = "all")
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Threads-Verify-$Slot" `
  -Command "npm run threads:post:validate && npm run automation:health:threads" `
  -WorkingDirectory $root `
  -MaxMinutes 10
