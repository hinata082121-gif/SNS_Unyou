import process from "node:process";

const requiredEnv = ["SHEETS_WEBHOOK_URL", "SHEETS_SECRET_TOKEN"];
const errors = [];

function getEnv(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    errors.push(`${name} is missing. Set it before running Hermes sales tasks.`);
    return "";
  }

  console.log(`OK: ${name} is set.`);
  return value;
}

const webhookUrl = getEnv(requiredEnv[0]);
getEnv(requiredEnv[1]);

if (webhookUrl && !webhookUrl.endsWith("/exec")) {
  errors.push("SHEETS_WEBHOOK_URL must end with /exec.");
} else if (webhookUrl) {
  console.log("OK: Webhook URL looks valid.");
}

if (errors.length > 0) {
  console.error("Sales sheet environment is not ready.");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  console.error("");
  console.error("PowerShell example:");
  console.error('$env:SHEETS_WEBHOOK_URL="https://script.google.com/macros/s/xxxxxxxxxxxxxxxxxxxx/exec"');
  console.error('$env:SHEETS_SECRET_TOKEN="replace-with-your-secret-token"');
  process.exit(1);
}

console.log("Sales sheet environment is ready.");
