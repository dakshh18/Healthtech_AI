import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { structure } from "../pipeline/structure";
import { checkFaithfulness } from "./faithfulness";
import { complaintMatch, listRecall, icdCounts, redactionRecall } from "./score";
import type { GoldCase } from "./types";

const here = path.dirname(fileURLToPath(import.meta.url));
const goldDir = path.join(here, "gold");

const THRESHOLDS = {
  schemaValid: 0.9,
  complaint: 0.7,
  meds: 0.7,
  icdRecall: 0.5,
  faithfulness: 0.9,
  redaction: 0.95,
};

function loadGold(): GoldCase[] {
  if (!fs.existsSync(goldDir)) return [];
  return fs
    .readdirSync(goldDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(fs.readFileSync(path.join(goldDir, f), "utf8")) as GoldCase);
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0);

function check(label: string, value: number, threshold: number): boolean {
  const pass = value >= threshold;
  const pct = (value * 100).toFixed(1).padStart(6);
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label.padEnd(18)} ${pct}%  (>= ${(threshold * 100).toFixed(0)}%)`);
  return pass;
}

async function main() {
  const cases = loadGold();
  if (cases.length === 0) {
    console.error("No gold cases found. Run `npm run synth` first.");
    process.exit(1);
  }

  let valid = 0;
  const complaintScores: number[] = [];
  const medScores: number[] = [];
  const allergyScores: number[] = [];
  const faithScores: number[] = [];
  let icdTp = 0, icdPred = 0, icdExp = 0;
  let phiMasked = 0, phiTotal = 0;
  const rows: Record<string, string | number>[] = [];

  for (const c of cases) {
    let soap;
    try {
      soap = await structure(c.transcript);
      valid++;
    } catch {
      rows.push({ case: c.id, valid: "no" });
      continue;
    }

    const complaint = complaintMatch(soap.chiefComplaint, c.expected.chiefComplaint) ? 1 : 0;
    const meds = listRecall(soap.medications, c.expected.medications);
    const allergies = listRecall(soap.allergies, c.expected.allergies);
    const faith = checkFaithfulness(soap, c.transcript);
    const icd = icdCounts(soap.icdCodes.map((x) => x.code), c.expected.icdCodes);
    const red = redactionRecall(c.plantedPhi, c.transcript);

    complaintScores.push(complaint);
    medScores.push(meds);
    allergyScores.push(allergies);
    faithScores.push(faith.score);
    icdTp += icd.tp; icdPred += icd.pred; icdExp += icd.exp;
    phiMasked += red.masked; phiTotal += red.total;

    rows.push({
      case: c.id,
      valid: "yes",
      complaint,
      meds: meds.toFixed(2),
      icd: `${icd.tp}/${icd.exp}`,
      faith: faith.score.toFixed(2),
      phi: `${red.masked}/${red.total}`,
    });
  }

  const summary = {
    schemaValid: valid / cases.length,
    complaint: avg(complaintScores),
    meds: avg(medScores),
    allergies: avg(allergyScores),
    icdPrecision: icdPred ? icdTp / icdPred : 0,
    icdRecall: icdExp ? icdTp / icdExp : 0,
    faithfulness: avg(faithScores),
    redaction: phiTotal ? phiMasked / phiTotal : 0,
  };

  console.log("\nPer-case results:");
  console.table(rows);

  console.log("Summary vs thresholds:");
  const results = [
    check("schema valid", summary.schemaValid, THRESHOLDS.schemaValid),
    check("complaint acc", summary.complaint, THRESHOLDS.complaint),
    check("meds recall", summary.meds, THRESHOLDS.meds),
    check("icd recall", summary.icdRecall, THRESHOLDS.icdRecall),
    check("faithfulness", summary.faithfulness, THRESHOLDS.faithfulness),
    check("redaction recall", summary.redaction, THRESHOLDS.redaction),
  ];
  console.log(
    `\n  (info) icd precision ${(summary.icdPrecision * 100).toFixed(1)}%  |  allergies recall ${(summary.allergies * 100).toFixed(1)}%`
  );

  const allPass = results.every(Boolean);
  console.log(`\nOverall: ${allPass ? "PASS" : "FAIL"}\n`);
  process.exit(allPass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
