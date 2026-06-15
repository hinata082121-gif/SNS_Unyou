$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Gmail-PrepareTomorrow-1720" `
  -Command "npm run gmail:outbox:prepare-and-sync-tomorrow" `
  -WorkingDirectory $root `
  -MaxMinutes 30 `
  -AllowSheetSync
