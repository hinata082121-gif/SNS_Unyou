$root = (Resolve-Path (Join-Path $PSScriptRoot "..\..\..")).Path
& (Join-Path $root "scripts\windows\run-scheduled-task.ps1") `
  -TaskName "Threads-Post-1100" `
  -Command "python scripts\threads\run_scheduled_thread.py --slot 11" `
  -WorkingDirectory $root `
  -MaxMinutes 5 `
  -AllowLivePublish
