import fs from "node:fs";
import path from "node:path";

const DEFAULT_CONFIG = path.join(process.cwd(), "config", "threads", "brand.json");

export function loadThreadsBrandConfig(filePath = DEFAULT_CONFIG) {
  try {
    const config = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return normalizeBrandConfig(config);
  } catch {
    return normalizeBrandConfig({});
  }
}

export function hasInstagramDestination(config) {
  return Boolean(String(config.instagramHandle || "").trim() || String(config.instagramProfileUrl || "").trim());
}

export function selectInstagramCta(config, index) {
  if (!hasInstagramDestination(config)) return "";
  const templates = Array.isArray(config.instagramCtaTemplates) ? config.instagramCtaTemplates.filter(Boolean) : [];
  if (!templates.length) return "";
  return templates[Math.abs(index) % templates.length];
}

function normalizeBrandConfig(config) {
  return {
    brandName: String(config.brandName || "ICHI Social"),
    purpose: String(config.purpose || "小規模店舗・個人事業主向けSNS整理支援"),
    instagramHandle: String(config.instagramHandle || "").trim(),
    instagramProfileUrl: String(config.instagramProfileUrl || "").trim(),
    profileDraft: String(config.profileDraft || ""),
    pinnedPostDraft: String(config.pinnedPostDraft || ""),
    instagramCtaTemplates: Array.isArray(config.instagramCtaTemplates) ? config.instagramCtaTemplates.map(String) : [],
    ctaFrequencyPolicy: {
      targetMinRatio: Number(config.ctaFrequencyPolicy?.targetMinRatio || 0.25),
      targetMaxRatio: Number(config.ctaFrequencyPolicy?.targetMaxRatio || 0.4),
      allowedSlots: Array.isArray(config.ctaFrequencyPolicy?.allowedSlots) ? config.ctaFrequencyPolicy.allowedSlots.map(String) : ["19:00"],
      disallowConsecutiveSameCta: config.ctaFrequencyPolicy?.disallowConsecutiveSameCta !== false,
      requireStandaloneValue: config.ctaFrequencyPolicy?.requireStandaloneValue !== false,
      suppressWhenInstagramUnset: config.ctaFrequencyPolicy?.suppressWhenInstagramUnset !== false
    }
  };
}
