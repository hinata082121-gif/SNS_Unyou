$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Threads-Post-1900" `
  -Command "npm run threads:plan:ensure:rolling && npm run threads:plan:validate && npm run threads:post:19" `
  -WorkingDirectory $root `
  -MaxMinutes 10 `
  -AllowLivePublish
