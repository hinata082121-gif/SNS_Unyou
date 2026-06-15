$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Gmail-PreflightMonitor-1135" `
  -Command "npm run gmail:sheet:verify-ready" `
  -WorkingDirectory $root `
  -MaxMinutes 15
