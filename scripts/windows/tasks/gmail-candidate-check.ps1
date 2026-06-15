$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Gmail-Candidates-1030" `
  -Command "npm run gmail:pool:validate" `
  -WorkingDirectory $root `
  -MaxMinutes 15
