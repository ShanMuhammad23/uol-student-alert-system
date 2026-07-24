export type InactiveLoginReminderEmailVars = {
  userName: string;
  lastLoginAt: string;
  /** True when the user has never successfully logged in. */
  neverLoggedIn?: boolean;
  /** Portal sign-in URL shown as a clickable link/button. */
  portalUrl?: string;
};

export const INACTIVE_LOGIN_REMINDER_EMAIL_SUBJECT =
  "Friendly Reminder: We Haven't Seen You in a While";

export const DEFAULT_INACTIVE_LOGIN_PORTAL_URL =
  "https://student-alert.uol.edu.pk/auth/sign-in";

const INTRO_INACTIVE =
  "We hope you are doing well. This is a friendly reminder that you have not logged in to the Student Alert System for 7 days or more. We would love to see you back on the portal when you have a moment.";

const INTRO_NEVER_LOGGED_IN =
  "We hope you are doing well. Your account is registered on the Student Alert System, but we do not have a record of any login yet. This is a friendly reminder to sign in when you have a moment so you can stay up to date with alerts and updates assigned to you.";

export const INACTIVE_LOGIN_REMINDER_EMAIL_TEMPLATE = `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#f3f6fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(90deg,#1f4a3d 0%,#2e6a58 100%);padding:18px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#ffffff;">
              Friendly Login Reminder
            </p>
            <p style="margin:4px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:20px;color:#d8efe6;">
              A gentle nudge to stay connected
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Dear [User Name],
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              [Intro Message]
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:0 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:10px;background-color:#f8fbff;">
              <tr>
                <td style="padding:14px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Last Login:</strong> [Last Login Date Time]</td>
                    </tr>
                    <tr>
                      <td style="padding:4px 12px 4px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:4px 0;"><strong style="color:#1f2937;">Portal:</strong> <a href="[Portal Url]" style="color:#1f4a3d;font-weight:600;text-decoration:underline;">[Portal Url Label]</a></td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 10px 24px;" align="center">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td align="center" style="border-radius:8px;background-color:#1f4a3d;">
                  <a href="[Portal Url]" style="display:inline-block;padding:12px 22px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Login to Portal
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:18px 24px 10px 24px;">
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Logging in regularly helps you stay up to date with student alerts, interventions, and other important updates assigned to you.
            </p>
            <p style="margin:0 0 16px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              If you are facing any difficulty accessing the portal, please feel free to reach out for support:<br/>
              <strong>
              Shan Muhammad <br/>
              Web Developer <br/>
              SPMO - The University of Lahore <br/>
              shan.muhammad@spmo.uol.edu.pk <br/>
              Cell: 03219720819 <br/>
              </strong>
            </p>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#374151;">
              Thank you for your continued engagement.
            </p>
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:24px;color:#1f2937;">
              Warm regards,<br /><br />
              Student Alert System<br />
              The University of Lahore
            </p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function resolvePortalUrl(value?: string): string {
  const raw = (value ?? "").trim() || DEFAULT_INACTIVE_LOGIN_PORTAL_URL;
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return DEFAULT_INACTIVE_LOGIN_PORTAL_URL;
    }
    return url.toString();
  } catch {
    return DEFAULT_INACTIVE_LOGIN_PORTAL_URL;
  }
}

export function buildInactiveLoginReminderEmailSubject(): string {
  return INACTIVE_LOGIN_REMINDER_EMAIL_SUBJECT;
}

export function buildInactiveLoginReminderEmailHtml(
  vars: InactiveLoginReminderEmailVars
): string {
  const userName = escapeHtml(vars.userName.trim() || "Colleague");
  const neverLoggedIn = Boolean(vars.neverLoggedIn);
  const lastLoginAt = escapeHtml(
    neverLoggedIn
      ? "Never"
      : vars.lastLoginAt.trim() || "Not available"
  );
  const introMessage = neverLoggedIn ? INTRO_NEVER_LOGGED_IN : INTRO_INACTIVE;
  const portalUrl = resolvePortalUrl(vars.portalUrl);
  const portalUrlAttr = escapeHtml(portalUrl);
  const portalUrlLabel = escapeHtml(portalUrl);

  return INACTIVE_LOGIN_REMINDER_EMAIL_TEMPLATE.replace(
    "[User Name]",
    userName
  )
    .replace("[Intro Message]", introMessage)
    .replace("[Last Login Date Time]", lastLoginAt)
    .replace(/\[Portal Url\]/g, portalUrlAttr)
    .replace("[Portal Url Label]", portalUrlLabel);
}
