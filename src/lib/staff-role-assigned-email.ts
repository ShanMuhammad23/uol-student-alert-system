import { sendSmtpMail } from "@/lib/smtp";

const PORTAL_URL = "https://student-alert.uol.edu.pk";

type StaffRoleAssignedParams = {
  name: string;
  parentFaculty: string;
  registeredEmail: string;
  assignedRole: string;
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function buildStaffRoleAssignedEmailHtml(
  p: StaffRoleAssignedParams
): string {
  const name = escapeHtml(p.name);
  const faculty = escapeHtml(p.parentFaculty);
  const email = escapeHtml(p.registeredEmail);
  const role = escapeHtml(p.assignedRole);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Role Assigned</title>
</head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(15,23,42,0.08);border:1px solid #e2e8f0;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669 0%,#047857 100%);padding:28px 32px;">
              <p style="margin:0;font-size:13px;font-weight:600;letter-spacing:0.06em;color:rgba(255,255,255,0.9);text-transform:uppercase;">Student Early Alert Portal</p>
              <h1 style="margin:12px 0 0;font-size:22px;font-weight:700;line-height:1.25;color:#ffffff;">Welcome — your role has been assigned</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;font-size:15px;line-height:1.65;color:#334155;">
              <p style="margin:0 0 16px;">Dear <strong>${name}</strong>,</p>
              <p style="margin:0 0 16px;">Welcome to the <strong>Student Early Alert Portal</strong>. Your user account has been created with the following details:</p>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;border-collapse:separate;border-spacing:0;border-radius:10px;border:1px solid #e2e8f0;overflow:hidden;background:#f8fafc;">
                <tr>
                  <td style="padding:14px 18px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;background:#f1f5f9;border-bottom:1px solid #e2e8f0;">Parent Faculty</td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;font-size:15px;font-weight:600;color:#0f172a;">${faculty}</td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Registered Email</td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;font-size:15px;color:#0f172a;"><a href="mailto:${email}" style="color:#059669;font-weight:600;text-decoration:none;">${email}</a></td>
                </tr>
                <tr>
                  <td style="padding:14px 18px;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.04em;color:#64748b;background:#f1f5f9;border-top:1px solid #e2e8f0;border-bottom:1px solid #e2e8f0;">Assigned Role</td>
                </tr>
                <tr>
                  <td style="padding:16px 18px;font-size:15px;font-weight:600;color:#0f172a;">${role}</td>
                </tr>
              </table>
              <p style="margin:16px 0;">You can access the portal through <a href="${PORTAL_URL}" style="color:#059669;font-weight:600;text-decoration:none;">${escapeHtml(PORTAL_URL)}</a>. Please note that this portal uses <strong>Single Sign-On</strong> so you can log in using your official university credentials.</p>
              <p style="margin:24px 0 0;color:#64748b;font-size:14px;">Best regards,<br /><strong style="color:#334155;">Early Alert Portal Management Team</strong></p>
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center;">
              This is an automated message — please do not reply directly unless you need support.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

const ROLE_LABELS: Record<string, string> = {
  superadmin: "Superadmin",
  dean: "Dean",
  hod: "Head of Department",
  instructor: "Instructor",
  "wellbeing-head": "Wellbeing Head",
  "wellbeing-counseller": "Wellbeing Counsellor",
};

export function formatStaffRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role;
}

export async function sendStaffRoleAssignedEmail(params: {
  to: string;
  name: string;
  parentFaculty: string;
  registeredEmail: string;
  roleKey: string;
}): Promise<void> {
  const html = buildStaffRoleAssignedEmailHtml({
    name: params.name,
    parentFaculty: params.parentFaculty,
    registeredEmail: params.registeredEmail,
    assignedRole: formatStaffRoleLabel(params.roleKey),
  });
  await sendSmtpMail({
    to: params.to,
    subject: "Student Early Alert Portal – Role Assigned",
    html,
  });
}
