$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Threads-Weekly-Friday-2000" `
  -Command "npm run threads:weekly:analyze && npm run sales:kpi:summary" `
  -WorkingDirectory $root `
  -MaxMinutes 15
