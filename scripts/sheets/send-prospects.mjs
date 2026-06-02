import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const REQUIRED_COLUMNS = [
  "店名",
  "業態",
  "地域",
  "概要",
  "相性スコア",
  "スコア理由",
  "課題仮説",
  "問い合わせフォームURL",
  "連絡手段",
  "出典URL",
  "出典種別",
  "ステータス",
  "送信日",
  "反応",
  "次アクション日",
];

const OPTIONAL_COLUMNS = [
  "Instagram URL",
  "Instagramユーザー名",
  "Instagramフォロワー数",
  "フォロワー区分",
  "最終投稿確認日",
  "Instagram運用課題",
  "Instagram営業優先度",
  "Instagram営業切り口",
  "手動DM文案",
  "手動コメント案",
  "自社コンテンツ提案余地",
];

const ALL_COLUMNS = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS];

const JSON_FIELD_TO_COLUMN = {
  name: "店名",
  businessType: "業態",
  area: "地域",
  summary: "概要",
  fitScore: "相性スコア",
  fitReason: "スコア理由",
  issueHypothesis: "課題仮説",
  contactFormUrl: "問い合わせフォームURL",
  contactMethod: "連絡手段",
  sourceUrl: "出典URL",
  sourceType: "出典種別",
  status: "ステータス",
  sentDate: "送信日",
  response: "反応",
  nextActionDate: "次アクション日",
  instagramUrl: "Instagram URL",
  instagramUsername: "Instagramユーザー名",
  instagramFollowers: "Instagramフォロワー数",
  followerSegment: "フォロワー区分",
  instagramLastPostCheckedAt: "最終投稿確認日",
  instagramIssueHypothesis: "Instagram運用課題",
  instagramSalesPriority: "Instagram営業優先度",
  instagramSalesAngle: "Instagram営業切り口",
  manualDmDraft: "手動DM文案",
  manualCommentDraft: "手動コメント案",
  selfContentOpportunity: "自社コンテンツ提案余地",
};

const ALLOWED_VALUES = {
  業態: ["美容室", "ネイル/アイラッシュ", "整体", "カフェ・飲食", "パーソナルジム/ピラティススタジオ", "ピラティススタジオ", "ペットサロン/ペット預かりサービス", "トリミングサロン", "フォトスタジオ/写真館", "整骨院", "ヨガスタジオ", "リフォーム会社", "ペットサロン", "パーソナルジム"],
  相性スコア: ["A", "B", "C"],
  出典種別: ["SNS", "公式サイト", "予約フォーム", "Instagram"],
  ステータス: [
    "未検収",
    "検収済",
    "除外",
    "送信済",
    "返信あり",
    "商談化",
    "反応なしクローズ",
  ],
  フォロワー区分: ["under_500", "500_999", "1000_1999", "2000_4999", "5000_over", "unknown"],
  Instagram営業優先度: ["A", "B", "C", "除外"],
};

function fail(message) {
  console.error(`Error: ${message}`);
  process.exit(1);
}

function getRequiredEnv(name) {
  const value = process.env[name];

  if (!value || value.trim() === "") {
    fail(`${name} が未設定です。PowerShellで $env:${name}=\"...\" を設定してください。`);
  }

  return value.trim();
}

function assertPlainObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} はオブジェクトである必要があります。`);
  }
}

function toCanonicalRow(row) {
  const canonical = {};

  for (const [key, value] of Object.entries(row)) {
    const column = JSON_FIELD_TO_COLUMN[key] ?? key;
    canonical[column] = value;
  }

  return canonical;
}

function normalizeInstagramFollowers(value, index) {
  if (value == null || value === "") {
    return "";
  }

  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) {
      fail(`rows[${index}] の Instagramフォロワー数 は0以上の数値またはnullである必要があります。`);
    }

    return String(Math.trunc(value));
  }

  const normalized = String(value).replaceAll(",", "").trim();

  if (normalized === "") {
    return "";
  }

  if (!/^\d+$/.test(normalized)) {
    fail(`rows[${index}] の Instagramフォロワー数 は数値またはnullである必要があります。推測値や単位付き文字列は使わないでください。`);
  }

  return normalized;
}

function normalizeRow(row, index) {
  assertPlainObject(row, `rows[${index}]`);
  const canonicalRow = toCanonicalRow(row);

  const rowKeys = Object.keys(canonicalRow);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in canonicalRow));
  const unknownColumns = rowKeys.filter((column) => !ALL_COLUMNS.includes(column));

  if (missingColumns.length > 0) {
    fail(`rows[${index}] に必須列がありません: ${missingColumns.join(", ")}`);
  }

  if (unknownColumns.length > 0) {
    fail(`rows[${index}] に未定義の列があります: ${unknownColumns.join(", ")}`);
  }

  const normalized = {};

  for (const column of ALL_COLUMNS) {
    const value = canonicalRow[column];
    normalized[column] =
      column === "Instagramフォロワー数"
        ? normalizeInstagramFollowers(value, index)
        : value == null
          ? ""
          : String(value);
  }

  if (normalized["ステータス"].trim() === "") {
    normalized["ステータス"] = "未検収";
  }

  if (normalized["業態"] === "美容院") {
    console.warn(
      `Warning: rows[${index}] の 業態 "美容院" は非推奨のため "美容室" に変換しました。`,
    );
    normalized["業態"] = "美容室";
  }

  for (const [column, allowedValues] of Object.entries(ALLOWED_VALUES)) {
    const value = normalized[column];

    if (value.trim() === "" && OPTIONAL_COLUMNS.includes(column)) {
      continue;
    }

    if (!allowedValues.includes(value)) {
      fail(
        `rows[${index}] の ${column} が無効です: "${value}"。許可値: ${allowedValues.join(" / ")}`,
      );
    }
  }

  return normalized;
}

async function loadProspects(filePath) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  let content;

  try {
    content = await readFile(absolutePath, "utf8");
  } catch (error) {
    fail(`JSONファイルを読み込めません: ${absolutePath}\n${error.message}`);
  }

  let data;

  try {
    data = JSON.parse(content);
  } catch (error) {
    fail(`JSON構文が不正です: ${absolutePath}\n${error.message}`);
  }

  assertPlainObject(data, "JSONルート");

  if (!Array.isArray(data.rows)) {
    fail("JSONには rows 配列が必要です。");
  }

  if (data.rows.length === 0) {
    fail("rows 配列が空です。1件以上の見込み客を指定してください。");
  }

  return data.rows.map((row, index) => normalizeRow(row, index));
}

async function postRows(webhookUrl, token, rows) {
  let response;

  try {
    response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ token, rows }),
    });
  } catch (error) {
    fail(`Webhookへの送信に失敗しました。\n${error.message}`);
  }

  const responseText = await response.text();

  if (!response.ok) {
    fail(`WebhookがHTTP ${response.status}を返しました。\n${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch (error) {
    fail(`Apps ScriptのレスポンスがJSONではありません。\n${responseText}\n${error.message}`);
  }
}

async function main() {
  const filePath = process.argv[2];

  if (!filePath) {
    fail("JSONファイルパスを指定してください。例: node scripts/sheets/send-prospects.mjs data/prospects/test-prospect.json");
  }

  const webhookUrl = getRequiredEnv("SHEETS_WEBHOOK_URL");
  const token = getRequiredEnv("SHEETS_SECRET_TOKEN");
  const rows = await loadProspects(filePath);

  console.log(`Validated ${rows.length} row(s). Sending to Google Sheets webhook...`);

  const result = await postRows(webhookUrl, token, rows);

  console.log("Apps Script response:");
  console.log(JSON.stringify(result, null, 2));

  if (result.ok === true) {
    const inserted = result.inserted ?? rows.length;
    console.log(`Success: inserted ${inserted} row(s).`);
    return;
  }

  fail(`Apps Script error: ${result.error ?? "unknown error"}`);
}

main();
