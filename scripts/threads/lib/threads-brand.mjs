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
    tonePolicy: {
      style: String(config.tonePolicy?.style || "casual_practical"),
      professionalism: String(config.tonePolicy?.professionalism || "friendly"),
      emojiMaxPerPost: Number(config.tonePolicy?.emojiMaxPerPost || 1),
      avoidLectureTone: config.tonePolicy?.avoidLectureTone !== false,
      avoidContinuousSalesCta: config.tonePolicy?.avoidContinuousSalesCta !== false
    },
    contentMix: {
      snsTip: Number(config.contentMix?.snsTip || 0.3),
      rewriteDemo: Number(config.contentMix?.rewriteDemo || 0.25),
      humorAndAruaru: Number(config.contentMix?.humorAndAruaru || 0.2),
      behindTheScenes: Number(config.contentMix?.behindTheScenes || 0.1),
      quickFix: Number(config.contentMix?.quickFix || 0.1),
      promotion: Number(config.contentMix?.promotion || 0.05)
    },
    ctaFrequencyPolicy: {
      targetMinRatio: Number(config.ctaFrequencyPolicy?.targetMinRatio || 0.05),
      targetMaxRatio: Number(config.ctaFrequencyPolicy?.targetMaxRatio || 0.15),
      allowedSlots: Array.isArray(config.ctaFrequencyPolicy?.allowedSlots) ? config.ctaFrequencyPolicy.allowedSlots.map(String) : ["19:00"],
      disallowConsecutiveSameCta: config.ctaFrequencyPolicy?.disallowConsecutiveSameCta !== false,
      requireStandaloneValue: config.ctaFrequencyPolicy?.requireStandaloneValue !== false,
      suppressWhenInstagramUnset: config.ctaFrequencyPolicy?.suppressWhenInstagramUnset !== false
    }
  };
}
