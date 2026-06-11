import fs from "node:fs";
import path from "node:path";

export function loadLocalEnv(options = {}) {
  const cwd = options.cwd || process.cwd();
  const override = options.override === true;
  const files = [".env", ".env.local"];
  const loaded = [];

  for (const file of files) {
    const fullPath = path.join(cwd, file);
    if (!fs.existsSync(fullPath)) continue;
    const values = parseEnvFile(fs.readFileSync(fullPath, "utf8"));
    for (const [key, value] of Object.entries(values)) {
      if (!override && process.env[key] !== undefined) continue;
      process.env[key] = value;
    }
    loaded.push(file);
  }

  return {
    envExists: loaded.includes(".env"),
    envLocalExists: loaded.includes(".env.local"),
  };
}

function parseEnvFile(source) {
  const result = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    result[key] = parseValue(line.slice(separator + 1).trim());
  }
  return result;
}

function parseValue(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    const unquoted = value.slice(1, -1);
    return value.startsWith('"')
      ? unquoted
          .replace(/\\n/g, "\n")
          .replace(/\\r/g, "\r")
          .replace(/\\t/g, "\t")
          .replace(/\\"/g, '"')
          .replace(/\\\\/g, "\\")
      : unquoted;
  }
  return value.replace(/\s+#.*$/, "").trim();
}
