export type PendingAction = {
  label: string;
  count: number;
};

export type InactiveLoginReminderEmailVars = {
  userName: string;
  lastLoginAt: string;
  /** True when the user has never successfully logged in. */
  neverLoggedIn?: boolean;
  /** Portal sign-in URL shown as a clickable link/button. */
  portalUrl?: string;
  /** Role-scoped pending actions to display in the email. Only items with count > 0. */
  pendingActions?: PendingAction[];
};

export const INACTIVE_LOGIN_REMINDER_EMAIL_SUBJECT =
  "Action Required: Pending Items Awaiting Your Attention";

export const DEFAULT_INACTIVE_LOGIN_PORTAL_URL =
  "https://student-alert.uol.edu.pk/auth/sign-in";

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

function buildPendingActionsBlock(actions: PendingAction[]): string {
  const visible = actions.filter((a) => a.count > 0);
  if (visible.length === 0) return "";

  const rows = visible
    .map(
      (a) => `
        <tr>
          <td style="padding:10px 16px;border-bottom:1px solid #e9f0fb;vertical-align:middle;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
              <tr>
                <td style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:20px;color:#374151;">
                  ${escapeHtml(a.label)}
                </td>
                <td align="right" style="white-space:nowrap;padding-left:16px;">
                  <span style="display:inline-block;background-color:#dc2626;color:#ffffff;font-family:Arial,Helvetica,sans-serif;font-size:13px;font-weight:700;line-height:1;padding:4px 10px;border-radius:12px;min-width:28px;text-align:center;">
                    ${a.count}
                  </span>
                </td>
              </tr>
            </table>
          </td>
        </tr>`
    )
    .join("");

  return `
        <tr>
          <td style="padding:20px 24px 8px 24px;">
            <p style="margin:0 0 10px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;font-weight:700;line-height:20px;color:#1f2937;text-transform:uppercase;letter-spacing:0.05em;">
              Actions Pending
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;background-color:#ffffff;">
              <tr>
                <td style="background-color:#fef2f2;padding:10px 16px;border-bottom:1px solid #fecaca;">
                  <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:18px;color:#991b1b;font-weight:600;">
                    The following items are waiting for your action on the portal:
                  </p>
                </td>
              </tr>
              ${rows}
            </table>
          </td>
        </tr>`;
}

function buildEmailHtml(
  userName: string,
  lastLoginAt: string,
  portalUrlAttr: string,
  portalUrlLabel: string,
  pendingActionsBlock: string
): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:0;padding:0;background-color:#f3f6fb;">
  <tr>
    <td align="center" style="padding:24px 12px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width:680px;background-color:#ffffff;border:1px solid #e6ebf2;border-radius:12px;overflow:hidden;">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(90deg,#1f4a3d 0%,#2e6a58 100%);padding:20px 24px;">
            <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:18px;line-height:26px;font-weight:700;color:#ffffff;">
              Student Alert System &mdash; Login Reminder
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
              Dear ${userName},
            </p>
          </td>
        </tr>

        <!-- Pending actions block (role-scoped, only rendered when items exist) -->
        ${pendingActionsBlock}

        <!-- Last login info -->
        <tr>
          <td style="padding:20px 24px 8px 24px;">
            <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #d7e3f4;border-radius:10px;background-color:#f8fbff;">
              <tr>
                <td style="padding:12px 16px;">
                  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
                    <tr>
                      <td style="padding:3px 12px 3px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:3px 0;"><strong style="color:#1f2937;">Last Login:</strong> ${lastLoginAt}</td>
                    </tr>
                    <tr>
                      <td style="padding:3px 12px 3px 0;vertical-align:top;width:20px;color:#1f4a3d;">&#8226;</td>
                      <td style="padding:3px 0;"><strong style="color:#1f2937;">Portal:</strong> <a href="${portalUrlAttr}" style="color:#1f4a3d;font-weight:600;text-decoration:underline;">${portalUrlLabel}</a></td>
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
                  <a href="${portalUrlAttr}" style="display:inline-block;padding:13px 28px;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:20px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:8px;">
                    Login to Portal Now
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer copy -->
        <tr>
          <td style="padding:18px 24px 10px 24px;">
            <p style="margin:0 0 8px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;font-weight:700;">
              Support Contact
            </p>
            <p style="margin:0 0 20px 0;font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:22px;color:#374151;">
              Shan Muhammad<br/>
              Web Developer &mdash; SPMO, The University of Lahore<br/>
              shan.muhammad@spmo.uol.edu.pk<br/>
              0321-9720819
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

export function buildInactiveLoginReminderEmailSubject(
  hasPendingActions?: boolean
): string {
  if (hasPendingActions) {
    return INACTIVE_LOGIN_REMINDER_EMAIL_SUBJECT;
  }
  return "Friendly Reminder: We Haven't Seen You in a While";
}

export function buildInactiveLoginReminderEmailHtml(
  vars: InactiveLoginReminderEmailVars
): string {
  const userName = escapeHtml(vars.userName.trim() || "Colleague");
  const lastLoginAt = escapeHtml(vars.lastLoginAt.trim() || "Not available");
  const pendingActions = (vars.pendingActions ?? []).filter((a) => a.count > 0);

  const portalUrl = resolvePortalUrl(vars.portalUrl);
  const portalUrlAttr = escapeHtml(portalUrl);
  const portalUrlLabel = escapeHtml(portalUrl);
  const pendingActionsBlock = buildPendingActionsBlock(pendingActions);

  return buildEmailHtml(
    userName,
    lastLoginAt,
    portalUrlAttr,
    portalUrlLabel,
    pendingActionsBlock
  );
}
