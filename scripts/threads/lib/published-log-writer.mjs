import fs from "node:fs";
import path from "node:path";

export function buildSafePublishLog(value) {
  return {
    ok: value.ok,
    commandReached: value.commandReached,
    slot: value.slot,
    postDate: value.postDate,
    publishEnabled: value.publishEnabled,
    dryRun: value.dryRun,
    insideSlotWindow: value.insideSlotWindow,
    apiConfigured: value.apiConfigured,
    planEnsured: value.planEnsured,
    planGenerated: value.planGenerated,
    postPrepared: value.postPrepared,
    postValidated: value.postValidated,
    mediaType: value.mediaType,
    mediaItemCount: value.mediaItemCount,
    contentPillar: value.contentPillar,
    format: value.format,
    hookType: value.hookType,
    targetIndustry: value.targetIndustry ?? null,
    hasQuestion: value.hasQuestion,
    hasCta: value.hasCta,
    hasDirectSalesCta: value.hasDirectSalesCta,
    textLengthBand: value.textLengthBand,
    mediaValidated: value.mediaValidated,
    mediaValidationErrorCount: value.mediaValidationErrorCount,
    wouldPublish: value.wouldPublish,
    published: value.published,
    compensationPostExecuted: value.compensationPostExecuted,
    blockedReason: value.blockedReason,
    postIdPresent: value.postIdPresent,
    postIdHash: value.postIdHash,
    errorSummary: value.errorSummary
  };
}

export function writePublishedLogAtomic(filePath, value) {
  const safe = buildSafePublishLog(value);
  validatePublishedLog(safe);
  const outDir = path.dirname(filePath);
  fs.mkdirSync(outDir, { recursive: true });
  const tmpPath = path.join(outDir, `.${path.basename(filePath)}.${process.pid}.tmp`);
  const json = `${JSON.stringify(safe, null, 2)}\n`;
  fs.writeFileSync(tmpPath, json, { encoding: "utf8", flag: "w" });
  const parsed = JSON.parse(fs.readFileSync(tmpPath, "utf8"));
  validatePublishedLog(parsed);
  fs.renameSync(tmpPath, filePath);
  const finalParsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
  validatePublishedLog(finalParsed);
  return { ok: true, filePath };
}

export function validatePublishedLog(value) {
  const errors = [];
  if (!["11", "19"].includes(String(value?.slot || ""))) errors.push("invalid_slot");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value?.postDate || ""))) errors.push("invalid_post_date");
  if (typeof value?.published !== "boolean") errors.push("invalid_published");
  if (typeof value?.blockedReason !== "string") errors.push("invalid_blocked_reason");
  if (typeof value?.compensationPostExecuted !== "boolean") errors.push("invalid_compensation_flag");
  if (value?.targetIndustry !== null && typeof value?.targetIndustry !== "string") errors.push("invalid_target_industry");
  if (errors.length) {
    const error = new Error("published_log_validation_failed");
    error.code = "published_log_validation_failed";
    error.errors = errors;
    throw error;
  }
  return true;
}
