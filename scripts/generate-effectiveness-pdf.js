/**
 * Generates docs/effectiveness-fei-guide.pdf (no browser required).
 * Usage: node scripts/generate-effectiveness-pdf.js
 */
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");

const pdfPath = path.resolve(__dirname, "../docs/effectiveness-fei-guide.pdf");

const MARGIN_L = 14;
const MARGIN_R = 14;
const MARGIN_T = 16;
const PAGE_W = 210;
const PAGE_H = 297;
const CONTENT_W = PAGE_W - MARGIN_L - MARGIN_R;
const LINE = 5.2;
const FOOTER_Y = PAGE_H - 10;

function createDoc() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = MARGIN_T;
  let page = 1;

  function footer() {
    doc.setFontSize(8);
    doc.setTextColor(120);
    doc.text(
      `UOL Student Early Alert System — FEI Guide · Page ${page}`,
      PAGE_W / 2,
      FOOTER_Y,
      { align: "center" }
    );
    doc.setTextColor(0);
  }

  function newPage() {
    footer();
    doc.addPage();
    page += 1;
    y = MARGIN_T;
  }

  function ensure(h = LINE) {
    if (y + h > PAGE_H - 18) newPage();
  }

  function title(text) {
    ensure(12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(5, 150, 105);
    doc.text(text, MARGIN_L, y);
    y += 9;
    doc.setTextColor(0);
  }

  function h2(text) {
    ensure(10);
    y += 3;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, MARGIN_L, y);
    y += 2;
    doc.setDrawColor(5, 150, 105);
    doc.line(MARGIN_L, y, PAGE_W - MARGIN_R, y);
    y += 6;
  }

  function h3(text) {
    ensure(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.text(text, MARGIN_L, y);
    y += 5.5;
  }

  function body(text, indent = 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    const lines = doc.splitTextToSize(text, CONTENT_W - indent);
    for (const line of lines) {
      ensure();
      doc.text(line, MARGIN_L + indent, y);
      y += LINE;
    }
  }

  function plain(text) {
    ensure(14);
    doc.setFillColor(236, 253, 245);
    doc.setDrawColor(5, 150, 105);
    const lines = doc.splitTextToSize(text, CONTENT_W - 8);
    const boxH = lines.length * LINE + 6;
    if (y + boxH > PAGE_H - 18) newPage();
    doc.rect(MARGIN_L, y - 3, CONTENT_W, boxH, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    let by = y + 2;
    for (const line of lines) {
      doc.text(line, MARGIN_L + 4, by);
      by += LINE;
    }
    y += boxH + 2;
  }

  function formula(text) {
    ensure(12);
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    const lines = doc.splitTextToSize(text, CONTENT_W - 8);
    const boxH = lines.length * LINE + 6;
    if (y + boxH > PAGE_H - 18) newPage();
    doc.rect(MARGIN_L, y - 3, CONTENT_W, boxH, "FD");
    doc.setFont("courier", "normal");
    doc.setFontSize(9);
    let by = y + 2;
    for (const line of lines) {
      doc.text(line, MARGIN_L + 4, by);
      by += LINE;
    }
    y += boxH + 3;
    doc.setFont("helvetica", "normal");
  }

  function table(headers, rows, colWidths) {
    const rowH = 7;
    const totalW = colWidths.reduce((a, b) => a + b, 0);
    ensure(rowH * (rows.length + 2));

    function drawRow(cells, bold = false) {
      if (y + rowH > PAGE_H - 18) newPage();
      let x = MARGIN_L;
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setFontSize(8.5);
      for (let i = 0; i < cells.length; i++) {
        doc.rect(x, y - 4.5, colWidths[i], rowH);
        const cellLines = doc.splitTextToSize(String(cells[i]), colWidths[i] - 2);
        doc.text(cellLines[0] || "", x + 1.5, y);
        x += colWidths[i];
      }
      y += rowH;
    }

    drawRow(headers, true);
    for (const row of rows) drawRow(row);
    y += 2;
  }

  // ─── Content ───
  title("Faculty & Department Effectiveness (FEI)");
  body("Student Early Alert System — metrics, scoring formulas, and plain-language guide.");
  body("Version: June 2026 · Matches src/lib/effectiveness.ts");
  y += 2;

  plain(
    "Purpose: Measure whether faculties use the alert system to support student wellbeing — not only to flag at-risk students."
  );

  h2("1. What is FEI?");
  body(
    "FEI (Faculty Effectiveness Index) is a score from 0 to 100 with letter grade A–E. It combines outreach, wellbeing referrals, student recovery, and data quality."
  );
  plain("In simple terms: When the system flags a struggling student, does this faculty help them — and do students improve?");
  table(
    ["Grade", "FEI", "Meaning"],
    [
      ["A", "85–100", "Exemplary support and outcomes"],
      ["B", "70–84", "Effective with minor gaps"],
      ["C", "55–69", "Developing — weak response or outcomes"],
      ["D", "40–54", "At risk — major support gaps"],
      ["E", "<40", "Critical — support largely absent"],
    ],
    [18, 22, CONTENT_W - 40]
  );

  h2("2. Overall FEI formula");
  formula(
    "FEI = round( 0.30×Outcome + 0.25×Wellbeing + 0.25×Response + 0.10×Readiness + 0.10×Sustained , 2 )"
  );
  table(
    ["Component", "Weight", "Measures"],
    [
      ["Outcome", "30%", "Recovery + repeat-alert control"],
      ["Wellbeing", "25%", "Referrals + wellbeing uptake"],
      ["Response", "25%", "Coverage, speed, stale cases"],
      ["Readiness", "10%", "Attendance posting quality"],
      ["Sustained", "10%", "Recovery + repeat (emphasis)"],
    ],
    [28, 18, CONTENT_W - 46]
  );

  h2("3. Percentage helper");
  formula("If denominator d > 0:  Rate% = round( (n ÷ d) × 100 , 2 decimals )\nIf d = 0:  Rate% is empty (shown as —)");

  h2("4. Raw counts");
  table(
    ["Count", "Meaning"],
    [
      ["N_total", "Students enrolled in faculty/department"],
      ["N_alerted", "Students with warning or critical alert"],
      ["N_crit_alerted", "Students with critical alert"],
      ["N_intervened", "Alerted students with ≥1 intervention"],
      ["N_crit_intervened", "Critical alerted + intervention"],
      ["N_referred", "Latest intervention status = referred"],
      ["N_wellbeing", "Referred + wellbeing case exists"],
      ["N_recovered", "Intervened + no longer in alert"],
      ["N_repeat", "In alert but prior case was resolved"],
      ["N_open / N_stale", "Open cases / open >14 days"],
    ],
    [38, CONTENT_W - 38]
  );

  newPage();
  h2("5. Dashboard columns");
  const cols = [42, CONTENT_W - 42];

  h3("Coverage %");
  formula("Coverage% = pct(N_intervened , N_alerted)");
  plain("Plain English: Of flagged at-risk students, what % did staff contact? Example: 74÷165 = 44.9%");

  h3("Critical coverage %");
  formula("Critical coverage% = pct(N_crit_intervened , N_crit_alerted)");
  plain("Plain English: Same as coverage, but only for critical (most serious) alerts.");

  h3("TTFC (median days)");
  formula("Δ_S = (first intervention date − first alert date) in days\nTTFC = median(Δ_S)");
  plain("Plain English: How fast staff respond after the first alert. Lower is better. — if history missing.");

  h3("Wellbeing %");
  formula("Wellbeing% = pct(N_wellbeing , N_referred)");
  plain("Plain English: Of referred students, how many reached the wellbeing centre records?");

  h3("Recovery %");
  formula("Recovery% = pct(N_recovered , N_intervened)");
  plain("Plain English: After intervention, how many students cleared their alert?");

  h3("Alerted");
  formula("Alerted = N_alerted");
  plain("Plain English: Current number of at-risk students — workload indicator, not quality alone.");

  h2("6. Scoring each parameter (0–100)");
  body("Each rate is mapped to a score using bands. Missing data → score 50 (neutral).");

  h3("Higher is better — f↑(x)");
  table(
    ["Condition", "Score"],
    [
      ["x ≥ Excellent", "100"],
      ["x ≥ Good", "85"],
      ["x ≥ Fair", "70"],
      ["x ≥ Poor", "55"],
      ["Below poor", "35"],
      ["Missing", "50"],
    ],
    [60, CONTENT_W - 60]
  );

  h3("Lower is better — f↓(x)");
  table(
    ["Condition", "Score"],
    [
      ["x ≤ Excellent", "100"],
      ["x ≤ Good", "85"],
      ["x ≤ Fair", "70"],
      ["x ≤ Poor", "55"],
      ["Above poor", "35"],
      ["Missing", "50"],
    ],
    [60, CONTENT_W - 60]
  );

  newPage();
  h3("Band thresholds");
  table(
    ["Parameter", "Type", "Exc.", "Good", "Fair", "Poor"],
    [
      ["Coverage %", "↑", "≥95", "≥85", "≥70", "≥50"],
      ["Critical cov. %", "↑", "≥95", "≥90", "≥75", "≥60"],
      ["TTFC (days)", "↓", "≤3", "≤7", "≤14", "≤21"],
      ["Stale %", "↓", "≤10", "≤20", "≤35", "≤50"],
      ["Referral rate %", "↑", "≥40", "≥25", "≥15", "≥8"],
      ["Wellbeing %", "↑", "≥80", "≥65", "≥50", "≥35"],
      ["Recovery %", "↑", "≥60", "≥45", "≥30", "≥15"],
      ["Repeat alert %", "↓", "≤5", "≤10", "≤20", "≤30"],
      ["Attendance post. %", "↑", "≥95", "≥90", "≥80", "≥70"],
    ],
    [36, 10, 14, 14, 14, 14]
  );

  h2("7. Component scores");
  h3("Response (25% of FEI)");
  formula(
    "Response = avg( f↑(Coverage), f↑(Critical cov.), f↓(TTFC), f↓(Stale%) )"
  );
  plain("Plain English: Reaching flagged students quickly, including critical cases, without abandoning open cases.");

  h3("Wellbeing (25% of FEI)");
  formula("Wellbeing = avg( f↑(Referral rate%), f↑(Wellbeing uptake%) )");
  plain("Plain English: Identifying distress and handing students to wellbeing services.");

  h3("Outcome (30% of FEI)");
  formula("Outcome = avg( f↑(Recovery%), f↓(Repeat alert%) )");
  plain("Plain English: Students improving and not cycling back into crisis.");

  h3("Readiness (10% of FEI)");
  formula("Readiness = f↑(Attendance posting%)");
  plain("Plain English: Reliable attendance data so alerts are trustworthy.");

  h3("Sustained (10% of FEI)");
  formula("Sustained = avg( f↑(Recovery%), f↓(Repeat alert%) )");
  plain("Plain English: Same as outcome — emphasises lasting improvement.");

  h2("8. Worked example — Social Sciences");
  table(
    ["Step", "Calculation", "Result"],
    [
      ["Coverage", "74 ÷ 165 × 100", "44.9%"],
      ["Score", "44.9% < 50 poor band", "35"],
      ["Recovery", "0 ÷ 74", "0% → score 35"],
      ["TTFC", "No daily history", "— → 50"],
      ["FEI", "Weighted blend", "≈57 (C)"],
    ],
    [32, 58, CONTENT_W - 90]
  );
  plain(
    "Despite best coverage in the university, FEI stays at C because recovery is 0%, wellbeing handoff is not visible, and TTFC cannot be measured."
  );

  h2("9. Key reminders");
  body("• FEI highlights support gaps — not student failure.");
  body("• High Alerted often means detection works.");
  body("• Low coverage + high alerts = outreach has not kept pace.");
  body("• Scores refresh daily via ETL (/api/cron/effectiveness).");

  footer();
  fs.writeFileSync(pdfPath, Buffer.from(doc.output("arraybuffer")));
  console.log("PDF written to:", pdfPath);
}

createDoc();
