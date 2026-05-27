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

const ALLOWED_VALUES = {
  業態: ["美容院", "ネイル/アイラッシュ", "整体", "カフェ・飲食"],
  相性スコア: ["A", "B", "C"],
  出典種別: ["SNS", "公式サイト", "予約フォーム"],
  ステータス: [
    "未検収",
    "検収済",
    "除外",
    "送信済",
    "返信あり",
    "商談化",
    "反応なしクローズ",
  ],
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

function normalizeRow(row, index) {
  assertPlainObject(row, `rows[${index}]`);

  const rowKeys = Object.keys(row);
  const missingColumns = REQUIRED_COLUMNS.filter((column) => !(column in row));
  const unknownColumns = rowKeys.filter((column) => !REQUIRED_COLUMNS.includes(column));

  if (missingColumns.length > 0) {
    fail(`rows[${index}] に必須列がありません: ${missingColumns.join(", ")}`);
  }

  if (unknownColumns.length > 0) {
    fail(`rows[${index}] に未定義の列があります: ${unknownColumns.join(", ")}`);
  }

  const normalized = {};

  for (const column of REQUIRED_COLUMNS) {
    const value = row[column];
    normalized[column] = value == null ? "" : String(value);
  }

  if (normalized["ステータス"].trim() === "") {
    normalized["ステータス"] = "未検収";
  }

  for (const [column, allowedValues] of Object.entries(ALLOWED_VALUES)) {
    const value = normalized[column];

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
