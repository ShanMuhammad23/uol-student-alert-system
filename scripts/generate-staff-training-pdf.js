/**
 * Generates docs/staff-training-early-alert-system.pdf
 * Usage: node scripts/generate-staff-training-pdf.js
 */
const fs = require("fs");
const path = require("path");
const { jsPDF } = require("jspdf");

const pdfPath = path.resolve(__dirname, "../docs/staff-training-early-alert-system.pdf");
const ML = 14;
const W = 210;
const H = 297;
const CW = W - 28;
const LH = 5.2;

function createDoc() {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 16;
  let page = 1;

  function footer() {
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(`Student Early Alert System — Staff Training Guide · Page ${page}`, W / 2, H - 8, {
      align: "center",
    });
    doc.setTextColor(0);
  }

  function newPage() {
    footer();
    doc.addPage();
    page++;
    y = 16;
  }

  function ensure(need = LH) {
    if (y + need > H - 14) newPage();
  }

  function h1(text) {
    ensure(14);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.setTextColor(5, 150, 105);
    doc.text(text, ML, y);
    y += 10;
    doc.setTextColor(0);
  }

  function h2(text) {
    ensure(12);
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text(text, ML, y);
    y += 2;
    doc.setDrawColor(5, 150, 105);
    doc.line(ML, y, W - ML, y);
    y += 6;
  }

  function h3(text) {
    ensure(8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text(text, ML, y);
    y += 5;
  }

  function body(text, indent = 0) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    for (const line of doc.splitTextToSize(text, CW - indent)) {
      ensure();
      doc.text(line, ML + indent, y);
      y += LH;
    }
  }

  function bullet(text) {
    body(`• ${text}`, 2);
  }

  function tip(text) {
    ensure(10);
    doc.setFillColor(236, 253, 245);
    const lines = doc.splitTextToSize(text, CW - 8);
    const bh = lines.length * LH + 5;
    if (y + bh > H - 14) newPage();
    doc.rect(ML, y - 3, CW, bh, "F");
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    let by = y + 1;
    for (const line of lines) {
      doc.text(line, ML + 4, by);
      by += LH;
    }
    y += bh + 2;
    doc.setFont("helvetica", "normal");
  }

  function numbered(items) {
    items.forEach((t, i) => body(`${i + 1}. ${t}`));
  }

  // ─── Cover ───
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.setTextColor(5, 150, 105);
  doc.text("Student Early Alert System", W / 2, 50, { align: "center" });
  doc.setFontSize(14);
  doc.setTextColor(60);
  doc.text("Staff Training Guide", W / 2, 62, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.text("Alerts · Access · Adding Interventions · Follow-up", W / 2, 72, {
    align: "center",
  });
  doc.text("University of Lahore", W / 2, 84, { align: "center" });
  doc.setFontSize(9);
  doc.text("For instructors, HoDs, deans & wellbeing staff", W / 2, 94, {
    align: "center",
  });
  doc.setTextColor(0);
  newPage();

  h2("1. Welcome — what this system does");
  body(
    "The Student Early Alert System spots students whose attendance or SGPA is falling, so staff can reach out early — before problems become crises."
  );
  body("Your role is to:");
  numbered([
    "Contact the student and understand what is going wrong",
    "Record what you did (an intervention) in the system",
    "Follow up until resolved or referred to the Wellbeing Centre",
  ]);
  tip("Think of the workflow as: Detect → Discuss → Document → Support → Resolve");

  h2("2. Signing in");
  numbered([
    "Open the system in your web browser",
    "Go to the Sign in page",
    "Enter your university email and password",
    "You are taken to the screen for your role automatically",
  ]);

  h2("3. Who sees what");
  body("Instructor: your own courses and students only.");
  body("Head of Department (HoD): your department(s) — all programs and courses.");
  body("Dean: your whole faculty — all departments.");
  body("Wellbeing counsellor: Wellbeing Dashboard for referred students.");
  body("Wellbeing head: Wellbeing Admin overview.");
  tip("You only see students in your scope. If a student is missing, they may belong elsewhere.");

  newPage();
  h2("4. Types of alerts");
  body("Alerts appear as Yellow (Warning) or Red (Critical) on the dashboard and student profile.");

  h3("Attendance alerts");
  bullet("RED (Critical): attendance is 60% or below.");
  bullet(
    "YELLOW (Warning): attendance above 60% but at least 20 percentage points below the class average."
  );

  h3("SGPA (grade) alerts");
  bullet("RED (Critical): SGPA dropped by 1.5 points or more vs previous semester.");
  bullet("YELLOW (Warning): SGPA dropped by 1.0 to 1.49 points.");

  h3("Combined");
  body("A student may have attendance alert, SGPA alert, or both. Red = highest priority.");
  tip("An alert is a signal to talk to the student — not a punishment. Many need support, not blame.");

  h2("5. The main dashboard");
  h3("Overview cards (top)");
  bullet("Total students in your scope");
  bullet("Attendance alerts — yellow and red counts (click to filter)");
  bullet("SGPA alerts — yellow and red counts");

  h3("Outreach & Intervention chart");
  bullet("Not Started — in alert, no intervention yet");
  bullet("Initiated — first contact recorded");
  bullet("In Progress — ongoing follow-up");
  bullet("Referred — sent to Wellbeing Centre");
  bullet("Resolved — issue addressed / student improved");
  bullet("No Action Required — reviewed, no further action (use with care)");

  h3("Student table");
  body("Filter by department, program, instructor, course, alert colour, or intervention status.");
  body("Click a student row to open their profile.");

  newPage();
  h2("6. Finding a student");
  h3("Method A — Dashboard table");
  numbered([
    "Scroll to the student table on the Dashboard",
    "Apply filters to narrow the list",
    "Click the student to open their profile",
  ]);
  h3("Method B — Intervention search");
  numbered([
    "Switch to the Intervention search tab on the Dashboard",
    "Enter the student SAP ID and press Search",
    "Open the student profile from the results",
  ]);

  h2("7. Student profile");
  body("Shows: student details, course metrics (attendance, SGPA), and Intervention History.");
  body("If you came from a specific course, new interventions link to that class.");

  h2("8. Adding an intervention — steps");
  numbered([
    "Open the student profile",
    "Scroll to Intervention History",
    "Click Add Intervention",
    "Fill in the form (see below)",
    "Click Add Intervention to save",
    "Confirm success message and new row in history",
  ]);

  newPage();
  h2("8.1 Form fields");
  body("Date — when you contacted the student (usually today).");
  body("Type — Attendance, SGPA, or Both (what you discussed).");
  body(
    "No Action Required — tick only if genuinely no follow-up needed; add remarks explaining why."
  );
  body("Mode — Email, WhatsApp, Phone Call, Meeting, or Not Applicable.");
  body(
    "Concluding Status — Referred (to Wellbeing) or Resolved (case closed). Leave blank for Initiated/In Progress."
  );
  body("Remarks — what the student said, agreed actions, concerns. Refer serious issues to Wellbeing.");

  h3("Automatic status");
  bullet("First contact on a course → usually Initiated");
  bullet("Further contact on same course → In Progress");
  bullet("Referred or Resolved → saved as you selected");

  h2("9. Email from the form");
  body("Choose Mode = Email to see the email section.");
  body("SOS Check-In — friendly first email about attendance or SGPA (auto-filled details).");
  body("Student Referral — when status is Referred; notifies Wellbeing team.");
  tip("Use your official university email. All sent emails are logged.");

  h2("10. Following up after adding an intervention");
  body("Adding a record is not the end. Track the case until finished.");
  bullet("Within 3–7 days: follow up if no response or no improvement");
  bullet("After each new contact: add intervention or update status");
  bullet("Stress / mental health / crisis: set Referred and involve Wellbeing");
  bullet("When improved: set Resolved with a short note");

  h3("Update existing intervention");
  numbered([
    "Student profile → Intervention History",
    "Click Edit on the row",
    "Change Status, Mode, or Date",
    "Save Changes",
  ]);

  h3("Or add a new intervention");
  body("For each separate meeting or call, click Add Intervention again for a clear history.");

  h3("Monitor on dashboard");
  body('Check Outreach chart — "Not Started" should decrease as you work cases.');
  body("Filter table by intervention status to see In Progress or Referred students.");

  newPage();
  h2("11. Referring to Wellbeing");
  numbered([
    "Explain support options to the student where possible",
    "Set Concluding Status → Referred",
    "Note reason in Remarks (without excessive private detail)",
    "Send Student Referral email if using email outreach",
    "Wellbeing team sees the case on their dashboard",
    "Keep Referred until wellbeing closes or resolves with you",
  ]);

  h2("12. Lifecycle summary");
  body("Alert → Open student → Add Intervention → Follow-up contacts →");
  body("Resolved OR Referred OR No Action Required");

  h2("13. Good practice checklist");
  bullet("Respond to red alerts quickly — same week if possible");
  bullet("Always add remarks for context");
  bullet("Do not mark Resolved until alert clears or issue is fixed");
  bullet("Use Referred when professional wellbeing support is needed");
  bullet('Check dashboard weekly for "Not Started" cases');
  bullet("Use system email when possible for audit trail");

  h2("14. Status quick reference");
  body("Not Started = alerted, no action yet (system)");
  body("Initiated = first contact made");
  body("In Progress = ongoing support");
  body("Referred = with Wellbeing");
  body("Resolved = back on track");
  body("No Action Required = reviewed, nothing needed");

  h2("15. Getting help");
  bullet("Student not found? Check your scope or ask HoD");
  bullet("Form won't save? Fill Date, Type, and Mode if required");
  bullet("Wrong alert? Wait for next daily data update");
  bullet("Technical issues? Contact faculty IT or system admin");

  footer();
  fs.writeFileSync(pdfPath, Buffer.from(doc.output("arraybuffer")));
  console.log("PDF written to:", pdfPath);
  console.log("HTML guide:", path.resolve(__dirname, "../docs/staff-training-early-alert-system.html"));
}

createDoc();
