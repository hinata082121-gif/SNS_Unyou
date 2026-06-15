param([string]$Slot = "all")
$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Threads-Plan-$Slot" `
  -Command "npm run threads:plan:ensure:rolling && npm run threads:plan:validate" `
  -WorkingDirectory $root `
  -MaxMinutes 10
