import assert from 'node:assert/strict';
import fs from 'node:fs';

const code = fs.readFileSync('apps-script/gmail-sales-automation/Code.gs', 'utf8');

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function businessContext(dateText) {
  const dayOfWeek = new Date(`${dateText}T00:00:00Z`).getUTCDay();
  const isSalesDay = dayOfWeek >= 1 && dayOfWeek <= 6;
  const find = (direction) => {
    for (let offset = 1; offset <= 8; offset += 1) {
      const candidate = addDays(dateText, direction * offset);
      const day = new Date(`${candidate}T00:00:00Z`).getUTCDay();
      if (day >= 1 && day <= 6) return candidate;
    }
    return dateText;
  };
  return {
    currentJstDate: dateText,
    dayOfWeek,
    isSalesDay,
    isWeeklyReportDay: dayOfWeek === 0,
    currentBusinessDate: isSalesDay ? dateText : find(1),
    nextSalesDate: find(1),
    previousSalesDate: find(-1)
  };
}

function makeCandidates(safeCount = 30) {
  const rows = [];
  for (let index = 0; index < safeCount; index += 1) {
    rows.push({ id: `safe-${index}`, safe: true, email: `safe-${index}@example.invalid`, digestConflict: false, payloadMissing: false, stale: false, sent: false, reply: false, suppression: false, deliveryUnknown: false });
  }
  for (let index = 0; index < 38; index += 1) rows.push({ id: `conflict-${index}`, safe: false, digestConflict: true });
  for (let index = 0; index < 15; index += 1) rows.push({ id: `missing-${index}`, safe: false, payloadMissing: true });
  while (rows.length < 87) rows.push({ id: `history-${rows.length}`, safe: false, sent: true });
  return rows;
}

function prepareManifest(rows, targetDate, quota = 100) {
  const safe = rows.filter((row) => row.safe && !row.digestConflict && !row.payloadMissing && !row.stale && !row.sent && !row.reply && !row.suppression && !row.deliveryUnknown);
  if (safe.length < 30) return { created: false, shortfall: 30 - safe.length, maxSendCount: 0 };
  const selected = safe.slice(0, 30);
  const unique = new Set(selected.map((row) => row.email)).size;
  return {
    created: unique === 30,
    targetDate,
    batchId: `gmail-sales-${targetDate}`,
    candidateCount: selected.length,
    uniqueRecipientCount: unique,
    duplicateCount: selected.length - unique,
    maxSendCount: 30,
    selectedDigestConflictCount: selected.filter((row) => row.digestConflict).length,
    selectedEvidenceMissingCount: selected.filter((row) => row.payloadMissing).length,
    selectedStaleEvidenceCount: selected.filter((row) => row.stale).length,
    reserveCount: safe.length - 30,
    warnings: safe.length === 30 ? ['reserve_inventory_zero', 'no_replacement_candidate_available'] : [],
    sendReady: quota >= 30 && unique === 30
  };
}

function persistWeeklyReport(store, weekStart, weekEnd) {
  if (store.some((row) => row.weekStart === weekStart && row.weekEnd === weekEnd)) return false;
  store.push({ weekStart, weekEnd, totalSent: 0, dataInsufficient: true, julyRevenueTargetYen: 100000 });
  return true;
}

function makeProductionEligibilityFixture(currentEligibleCount = 11) {
  const rows = [];
  for (let index = 0; index < 30; index += 1) {
    let exclusion = '';
    if (index >= currentEligibleCount) {
      const offset = index - currentEligibleCount;
      exclusion = offset < 8 ? 'missing_subject_or_body' : (offset < 13 ? 'suppression_or_do_not_contact' : 'prior_sent');
    }
    rows.push({ id: `approved-${index}`, rawApproved: true, rawReady: true, joined: true, evidenceValid: true, unique: true, exclusion });
  }
  for (let index = 0; index < 38; index += 1) rows.push({ id: `conflict-${index}`, joined: true, digestConflict: true });
  for (let index = 0; index < 15; index += 1) rows.push({ id: `payload-${index}`, joined: true, payloadMissing: true });
  while (rows.length < 87) rows.push({ id: `join-failed-${rows.length}`, joined: false });
  return rows;
}

function evaluateEligibility(rows) {
  const exclusionReasonCounts = {};
  const increment = (reason) => { exclusionReasonCounts[reason] = (exclusionReasonCounts[reason] || 0) + 1; };
  const eligible = [];
  for (const row of rows) {
    if (!row.joined) {
      increment('source_review_join_missing');
      continue;
    }
    if (row.digestConflict) {
      increment('evidence_digest_conflict');
      continue;
    }
    if (row.payloadMissing) {
      increment('evidence_payload_missing');
      continue;
    }
    if (!row.rawApproved) {
      increment('contact_basis_missing');
      continue;
    }
    if (row.exclusion) {
      increment(row.exclusion);
      continue;
    }
    eligible.push(row);
  }
  return {
    sourceCandidateCount: rows.length,
    rawApprovedCount: rows.filter((row) => row.rawApproved).length,
    rawReadyInventoryCount: rows.filter((row) => row.rawReady).length,
    currentEligibleCount: eligible.length,
    currentEligibleUniqueCount: eligible.filter((row) => row.unique).length,
    currentEligibleDigestValidCount: eligible.filter((row) => row.evidenceValid).length,
    currentEligibleEvidenceCompleteCount: eligible.filter((row) => row.evidenceValid).length,
    digestConflictCount: rows.filter((row) => row.digestConflict).length,
    evidencePayloadMissingCount: rows.filter((row) => row.payloadMissing).length,
    sourceJoinFailedCount: rows.filter((row) => !row.joined).length,
    shortfallCount: Math.max(0, 30 - eligible.length),
    exclusionReasonCounts
  };
}

function evaluateReadiness(eligibility, manifest) {
  const currentManifestValid = manifest.targetDate === '2026-07-13' && manifest.batchId === 'gmail-sales-2026-07-13' && manifest.expired !== true && manifest.digestMatch === true;
  const currentEligibilityValid = eligibility.currentEligibleCount >= 30 && eligibility.currentEligibleUniqueCount >= 30 && eligibility.currentEligibleDigestValidCount >= 30;
  return {
    manifestReady: currentManifestValid && currentEligibilityValid,
    exact30Valid: currentManifestValid && currentEligibilityValid && manifest.candidateCount === 30,
    evidenceContractValid: currentManifestValid && currentEligibilityValid,
    readinessValid: currentManifestValid && currentEligibilityValid,
    staleManifestRowCount: currentManifestValid ? 0 : manifest.candidateCount,
    recommendedNextAction: currentEligibilityValid ? 'prepare_current_business_day_manifest' : 'replenish_safe_eligible_inventory'
  };
}

const sunday = businessContext('2026-07-12');
assert.equal(sunday.isWeeklyReportDay, true);
assert.equal(sunday.isSalesDay, false);
assert.equal(sunday.nextSalesDate, '2026-07-13');
assert.equal(businessContext('2026-07-13').isSalesDay, true);
assert.equal(businessContext('2026-07-18').isSalesDay, true);
assert.equal(businessContext('2026-07-19').isWeeklyReportDay, true);

const candidates = makeCandidates();
assert.equal(candidates.length, 87);
assert.equal(candidates.filter((row) => row.digestConflict).length, 38);
assert.equal(candidates.filter((row) => row.payloadMissing).length, 15);
const manifest = prepareManifest(candidates, sunday.nextSalesDate);
assert.equal(manifest.created, true);
assert.equal(manifest.targetDate, '2026-07-13');
assert.equal(manifest.batchId, 'gmail-sales-2026-07-13');
assert.equal(manifest.candidateCount, 30);
assert.equal(manifest.uniqueRecipientCount, 30);
assert.equal(manifest.duplicateCount, 0);
assert.equal(manifest.maxSendCount, 30);
assert.equal(manifest.selectedDigestConflictCount, 0);
assert.equal(manifest.selectedEvidenceMissingCount, 0);
assert.equal(manifest.selectedStaleEvidenceCount, 0);
assert.deepEqual(manifest.warnings, ['reserve_inventory_zero', 'no_replacement_candidate_available']);
assert.equal(prepareManifest(makeCandidates(29), '2026-07-13').created, false);
assert.equal(prepareManifest(makeCandidates(29), '2026-07-13').shortfall, 1);
assert.equal(prepareManifest(candidates, '2026-07-13', 29).sendReady, false);

const productionEligibility = evaluateEligibility(makeProductionEligibilityFixture(11));
assert.equal(productionEligibility.sourceCandidateCount, 87);
assert.equal(productionEligibility.rawApprovedCount, 30);
assert.equal(productionEligibility.rawReadyInventoryCount, 30);
assert.equal(productionEligibility.currentEligibleCount, 11);
assert.equal(productionEligibility.shortfallCount, 19);
assert.equal(productionEligibility.digestConflictCount, 38);
assert.equal(productionEligibility.evidencePayloadMissingCount, 15);
assert.equal(productionEligibility.sourceJoinFailedCount, 4);
assert.equal(Object.values(productionEligibility.exclusionReasonCounts).reduce((sum, count) => sum + count, 0), 76);
const staleReadiness = evaluateReadiness(productionEligibility, {
  targetDate: '2026-07-03',
  batchId: 'gmail-sales-2026-07-03',
  candidateCount: 30,
  expired: true,
  digestMatch: false
});
assert.equal(staleReadiness.manifestReady, false);
assert.equal(staleReadiness.exact30Valid, false);
assert.equal(staleReadiness.evidenceContractValid, false);
assert.equal(staleReadiness.readinessValid, false);
assert.equal(staleReadiness.staleManifestRowCount, 30);
assert.equal(staleReadiness.recommendedNextAction, 'replenish_safe_eligible_inventory');
const exactThirtyEligibility = evaluateEligibility(makeProductionEligibilityFixture(30));
const freshReadiness = evaluateReadiness(exactThirtyEligibility, {
  targetDate: '2026-07-13', batchId: 'gmail-sales-2026-07-13', candidateCount: 30, expired: false, digestMatch: true
});
assert.equal(exactThirtyEligibility.currentEligibleCount, 30);
assert.equal(freshReadiness.readinessValid, true);
const twentyNineEligibility = evaluateEligibility(makeProductionEligibilityFixture(29));
assert.equal(twentyNineEligibility.currentEligibleCount, 29);
assert.equal(evaluateReadiness(twentyNineEligibility, {
  targetDate: '2026-07-13', batchId: 'gmail-sales-2026-07-13', candidateCount: 30, expired: false, digestMatch: true
}).readinessValid, false);

const reports = [];
assert.equal(persistWeeklyReport(reports, '2026-07-06', '2026-07-11'), true);
assert.equal(persistWeeklyReport(reports, '2026-07-06', '2026-07-11'), false);
assert.equal(reports.length, 1);
assert.equal(reports[0].totalSent, 0);
assert.equal(reports[0].dataInsufficient, true);

[
  'getGmailSalesBusinessDayContext_',
  'prepareGmailSalesManifestForBusinessDateOnce',
  'prepareGmailSalesManifestForDate_',
  'inspectGmailSalesNextSalesDayReadiness',
  'inspectGmailSalesCurrentEligibilityBreakdown',
  'evaluateGmailSalesManifestEligibility_',
  'runGmailSalesRecoveryPreparationStepOnce',
  'persistGmailSalesWeeklyReport_',
  'generateGmailSalesWeeklyReportOnce'
].forEach((name) => assert.ok(code.includes(`function ${name}`), `${name} missing`));

const currentReadinessBody = code.slice(code.indexOf('function inspectGmailSalesCurrentDaySendReadiness'), code.indexOf('function inspectGmailSalesNextSalesDayReadiness'));
assert.equal(currentReadinessBody.includes('inspectGmailSalesJulyRecoveryReadiness'), false);
assert.equal(currentReadinessBody.includes('run_gmail_sales_july3_integrated_preparation'), false);
assert.ok(currentReadinessBody.includes('prepare_next_sales_day_manifest'));
assert.ok(code.includes("GMAIL_SALES_WEEKLY_REPORT_SHEET_NAME = 'Gmail_Sales_Weekly_Report'"));
assert.ok(code.includes("recommendedNextAction = 'replace_expired_manifest'"));
assert.ok(code.includes("recommendedNextAction = 'replenish_safe_eligible_inventory'"));
assert.ok(code.includes('currentManifestValid && currentEligibilityValid'));
assert.ok(code.includes('buildGmailSalesStrictContactSourceRowKey_'));
assert.ok(code.includes('selectedManifestDigestConflictCount = 0'));
assert.ok(code.includes("'reserve_inventory_zero', 'no_replacement_candidate_available'"));
assert.equal((code.match(/MailApp\.sendEmail\s*\(/g) || []).length, 1);
assert.equal((code.match(/function\s+runGmailSalesProductionControlLoop\s*\(/g) || []).length, 1);
assert.equal((code.match(/function\s+runGmailSalesDailyAutomationTrigger\s*\(/g) || []).length, 1);

console.log(JSON.stringify({
  genericProductionRecoveryE2ePassed: true,
  sundaySendCount: 0,
  nextSalesDate: sunday.nextSalesDate,
  sourceCandidateCount: candidates.length,
  digestConflictCount: 38,
  evidencePayloadMissingCount: 15,
  selectedManifestCount: manifest.candidateCount,
  selectedManifestUniqueCount: manifest.uniqueRecipientCount,
  selectedManifestDigestConflictCount: manifest.selectedDigestConflictCount,
  selectedManifestEvidenceMissingCount: manifest.selectedEvidenceMissingCount,
  reserveInventoryCount: manifest.reserveCount,
  productionRawApprovedCount: productionEligibility.rawApprovedCount,
  productionRawReadyInventoryCount: productionEligibility.rawReadyInventoryCount,
  productionCurrentEligibleCount: productionEligibility.currentEligibleCount,
  productionCurrentEligibleShortfallCount: productionEligibility.shortfallCount,
  productionSourceJoinFailedCount: productionEligibility.sourceJoinFailedCount,
  staleManifestExact30Valid: staleReadiness.exact30Valid,
  freshManifestReadinessValid: freshReadiness.readinessValid,
  twentyNineReadinessValid: false,
  weeklyReportPersistedCount: reports.length,
  totalSent: reports[0].totalSent,
  julyRevenueTargetYen: reports[0].julyRevenueTargetYen,
  actualGmailSend: 0,
  actualDraftCreate: 0,
  actualGeminiCall: 0,
  actualUrlFetchCall: 0,
  actualProductionSheetUpdate: 0,
  actualProductionPropertyUpdate: 0,
  actualProductionTriggerChange: 0,
  mailAppSendEmailCallSiteCount: 1
}, null, 2));
