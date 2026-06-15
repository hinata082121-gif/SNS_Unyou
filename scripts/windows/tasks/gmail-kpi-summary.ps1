$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Gmail-KPI-1230" `
  -Command "npm run sales:kpi:summary" `
  -WorkingDirectory $root `
  -MaxMinutes 15
