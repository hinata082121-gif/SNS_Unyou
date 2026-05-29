# WSL2 / Windows運用ルール

## 基本

HermesはWSL2上で動かす。Windowsがスリープ中、再起動中、WSL2が停止中の場合、cronが動かない可能性があります。

## 確認項目

- PCがスリープしていないか
- WSL2が終了していないか
- Gatewayが起動しているか
- systemdサービスが有効か
- lingerが必要な場合は設定済みか
- Windows Update/再起動後にGatewayを確認したか

## パス変換

- Windows: `C:\Users\hinat\Documents\Codex\...`
- WSL: `/mnt/c/Users/hinat/Documents/Codex/...`

## 注意

PowerShellでLinux専用コマンドをそのまま実行しない。WSL2内で実行するコマンドとPowerShellで実行するコマンドを分ける。

