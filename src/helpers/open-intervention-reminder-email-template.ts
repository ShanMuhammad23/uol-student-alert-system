export type OpenInterventionReminderEmailVars = {
  /** Intervention initiator receiving the reminder. */
  recipientName: string;
  studentName: string;
  studentSapId: string;
  courseLabel: string;
  status: string;
  interventionDate: string;
  /** Absolute URL of the student details page. */
  studentUrl: string;
  /** Sender identity resolved from the session. */
  senderName: string;
  senderRoleLabel: string;
  senderDepartment: string;
  senderFaculty: string;
};

export const OPEN_INTERVENTION_REMINDER_EMAIL_SUBJECT =
  "Resolve the Open Cases in Student alert system";

export const DEFAULT_STUDENT_ALERT_BASE_URL =
  "https://student-alert.uol.edu.pk";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function formatStatus(status: string): string {
  return status
    .split("-")
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join(" ");
}

export function buildOpenInterventionReminderEmailHtml(
  vars: OpenInterventionReminderEmailVars
): string {
  const recipientName = escapeHtml(vars.recipientName.trim() || "Colleague");
  const studentName = escapeHtml(vars.studentName.trim() || vars.studentSapId);
  const studentSapId = escapeHtml(vars.studentSapId.trim());
  const courseLabel = escapeHtml(vars.courseLabel.trim() || "—");
  const status = escapeHtml(formatStatus(vars.status.trim() || "Open"));
  const interventionDate = escapeHtml(vars.interventionDate.trim() || "—");
  const studentUrl = escapeHtml(vars.studentUrl);

  const senderBits = [
    vars.senderRoleLabel.trim(),
    vars.senderDepartment.trim(),
    vars.senderFaculty.trim(),
  ].filter(Boolean);
  const senderLine = `${vars.senderName.trim()}${
    senderBits.length ? ` — ${senderBits.join(", ")}` : ""
  }`;

  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#f3f6fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(90deg,#1f4a3d 0%,#2e6a58 100%);padding:20px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#ffffff;">
              Student Alert System &mdash; Open Case Reminder
            </p>
            <p style="margin:5px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#d8efe6;">
              The University of Lahore
            </p>
          </td>
        </tr>

        <!-- Greeting + intro -->
        <tr>
          <td style="padding:28px 24px 8px 24px;">
            <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Dear ${recipientName},
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
              An intervention you recorded is still open while the student is no longer in alert. Please review the case and set it to <strong>Resolved</strong> or <strong>No Action Required</strong>.
            </p>
          </td>
        </tr>

        <!-- Intervention record -->
        <tr>
          <td style="padding:20px 24px 8px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:10px;background-color:#f8fbff;">
              <tr>
                <td style="padding:12px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    <tr>
                      <td style="padding:3px 12px 3px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:3px 0;"><strong style="color:#1f2937;">Student:</strong> ${studentName} (${studentSapId})</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 12px 3px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:3px 0;"><strong style="color:#1f2937;">Course:</strong> ${courseLabel}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 12px 3px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:3px 0;"><strong style="color:#1f2937;">Status:</strong> ${status} &nbsp;&bull;&nbsp; <strong style="color:#1f2937;">Date:</strong> ${interventionDate}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- CTA button -->
        <tr>
          <td style="padding:18px 24px 10px 24px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:8px;background-color:#1f4a3d;">
                  <a href="${studentUrl}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Open Student Details
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer copy -->
        <tr>
          <td style="padding:18px 24px 10px 24px;">
            <p style="margin:0 0 14px 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#6b7280;">
              Reminder requested by ${escapeHtml(senderLine)}
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#1f2937;">
              Warm regards,<br /><br />
              <strong>Student Alert System</strong><br />
              The University of Lahore
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>`;
}
