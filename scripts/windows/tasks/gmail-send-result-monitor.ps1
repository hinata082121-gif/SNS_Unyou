$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Gmail-SendResult-1210" `
  -Command "npm run gmail:post-send:sync" `
  -WorkingDirectory $root `
  -MaxMinutes 15
