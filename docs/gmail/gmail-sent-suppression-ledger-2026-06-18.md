# Gmail Sent Suppression Ledger - 2026-06-18

## 目的

2026-06-11以降に一度でもGmail Sentに存在する営業メール宛先を、正誤を問わず恒久的な再送禁止対象として扱う。

この文書にはメールアドレス、営業先名、本文、返信本文、Gmailスレッド情報、Sheet ID、Apps Script URL、トークンを記載しない。

## 確認済み事実

- 2026-06-11以降、対象件名のGmail Sent実体が150件存在する。
- 同一送信先への複数日再送が発生している。
- 同一営業先へ最大5回送信されている例がある。
- 2026-06-18 00:38-00:40 JSTの30件には、過去送信済み宛先が含まれている。
- 一部メールでは冒頭の営業先名が欠落している。
- 2026-06-18の追加送信は中止する。

## Apps Script監査関数

人間がApps Script管理画面で以下を実行する。

```text
runSentHistoryIncidentAuditOnly()
```

この関数は送信処理を呼ばず、Gmail Sentを読み取り、以下のみを安全ログに出す。

- totalSent
- uniqueRecipients
- duplicatedRecipients
- duplicateRecipientCount
- maxSendCount
- missingGreetingCount
- outsideWindowCount
- invalidNotCountedCount
- suppressedCount
- dailyCounts

## Suppression Ledger

Apps ScriptのScript Propertiesに、ハッシュ化済みのsuppression ledgerを分割保存する。

保存される情報:

- recipientHash
- normalizedDomainHash
- businessFingerprint
- firstSentAt
- lastSentAt
- sendCount
- batchIds
- deliveryStatus
- salesCompletionStatus
- invalidReasons
- suppressed=true
- futureEligible=false

6月11日以降に一度でも送った宛先は、誤送信であっても `futureEligible=false` とする。

## 営業実績分類

有効実績として扱えるのは、初回送信で、宛名が本文と一致し、許可時間内に送られたものだけ。

以下は `invalid_not_counted` とする。

- duplicate
- wrong_name
- missing_name
- outside_window
- unverified

## 明日以降の候補選定

新規候補は以下をすべて満たす必要がある。

- suppression ledgerに存在しない
- Gmail Sentにも存在しない
- Sheet送信履歴にも存在しない
- email重複なし
- business重複なし
- domain重複なし
- source rowの営業先名が本文に含まれる
- 宛名が空でない
- preview生成済み
- source freshness合格
- 人間承認済み

30件未満なら安全件数だけを扱い、水増ししない。0件なら送信しない。

## Private Report

人間確認用の実値CSVはGit管理外に置く。

```text
tmp/gmail-incident/sent-history-private.csv
```

このファイルは標準出力へ表示せず、Gitにも追加しない。
