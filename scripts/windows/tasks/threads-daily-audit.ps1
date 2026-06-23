$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Threads-Daily-Audit-1940" `
  -Command "npm run threads:publish:audit -- --expected-slots 11,19" `
  -WorkingDirectory $root `
  -MaxMinutes 10
