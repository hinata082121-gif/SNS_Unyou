$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Gmail-TomorrowCheck-1730" `
  -Command "npm run automation:health:gmail" `
  -WorkingDirectory $root `
  -MaxMinutes 15
